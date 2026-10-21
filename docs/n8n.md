# n8n — Publicación programada e inmediata

> Estado: workflow `Post Content` activo en el n8n local (`http://localhost:5678`).
> El backend es la fuente de verdad de la cola; n8n solo reclama, publica y reporta.

## 1. Contrato con el backend

```text
POST /api/v1/dispatch/claim
  header: x-api-key: <N8N_API_KEY>
  → 200 { publication, targets: [{ target, credentials, caption }] }

POST /api/v1/dispatch/targets/:targetId/report
  header: x-api-key: <N8N_API_KEY>
  body: { status: "SUCCESS" | "FAILED", externalPostId?, externalPostUrl?, errorMessage? }
```

- Un claim vacío responde `200` con `{ publication: null, targets: [] }`; el
  workflow termina sin publicar.
- El claim marca la publicación como `PROCESSING` con un lease de 15 minutos.
  Si n8n muere, el watchdog del backend la reencola o la marca `FAILED`.
- Cada target del claim ya trae `target.platform`, `target.format`
  (`FEED | REEL`), `target.id`, `credentials` descifradas y `caption`: el
  texto único que publican las APIs actuales, ya compuesto por el backend
  (título + línea en blanco + descripción; sin título es `copy` intacto). El
  workflow **debe reportar todos los targets**, incluso cuando uno falle.
- `caption` es aditivo: un workflow que aún lea `publication.copy` sigue
  funcionando; para publicar el título basta usar `target.caption` en las
  expresiones que arman `caption`/`description`.
- Las credenciales quedan congeladas en el claim: si se cambia la cuenta o el
  token, hay que volver a reclamar (o esperar al siguiente ciclo).

## 2. Disparadores

| Disparador | Ruta | Uso |
| --- | --- | --- |
| Schedule | cada 5 minutos | Red de seguridad; publica lo que esté vencido. |
| Webhook | `POST /webhook/publish-now` | Solo despierta el flujo tras un “publicar ahora”. |

El webhook:

- Usa Header Auth con `x-webhook-secret` = `INTERNAL_WEBHOOK_SECRET`.
- No lleva body y responde de inmediato (`Respond Immediately`).
- No publica por sí mismo: después del disparo se ejecuta el mismo
  `POST /dispatch/claim`.
- En desarrollo, la URL de prueba es `/webhook-test/publish-now`; en producción
  (workflow activo) es `/webhook/publish-now`. El API debe apuntar a la URL de
  producción en `N8N_DISPATCH_WEBHOOK_URL`.

## 3. Ramas de publicación

Después del claim, el workflow normaliza la respuesta, hace `Split Out` de
`targets` y ramifica con `platform + format + mediaType`:

| Rama | Condición | Llamada |
| --- | --- | --- |
| Facebook Feed imagen | `FACEBOOK`, `FEED`, `IMAGE` | `POST /{page-id}/photos` (`url`, `caption`) |
| Facebook Feed video | `FACEBOOK`, `FEED`, `VIDEO` | `POST /{page-id}/videos` (`file_url`, `description`) |
| Facebook Reel | `FACEBOOK`, `REEL` | `video_reels` start → upload al `upload_url` con header `file_url` → finish (`video_state=PUBLISHED`) |
| Instagram Feed imagen | `INSTAGRAM`, `FEED`, `IMAGE` | `POST /{ig-id}/media` (`image_url`) → `media_publish` |
| Instagram Feed video | `INSTAGRAM`, `FEED`, `VIDEO` | `POST /{ig-id}/media` (`media_type=REELS`, `share_to_feed=true`) → polling → `media_publish` |
| Instagram Reel | `INSTAGRAM`, `REEL` | `POST /{ig-id}/media` (`media_type=REELS`, `share_to_feed=true`) → polling → `media_publish` |

Todas las ramas que aceptan texto publican `target.caption` (título +
descripción ya fusionados por el backend); la tabla lista el argumento de cada
API (`caption`/`description`).

Notas de Meta (Graph API `v25.0`):

- Facebook Reels solo se publican en Pages y requieren un video vertical
  9:16 (mínimo 540×960). Un video 16:9 puede funcionar como Feed, no como Reel.
- El upload de Reels acepta una URL pública en el header `file_url` de
  `rupload.facebook.com`; no se sube el binario por n8n.
- Instagram exige crear el contenedor, esperar `status_code=FINISHED` y recién
  entonces llamar a `media_publish`. El workflow espera 15 s y reintenta hasta
  20 veces (5 minutos); si expira, reporta el target como `FAILED`.
- Meta ya no acepta `media_type=VIDEO` para videos de Instagram. Feed y Reel se
  crean con `media_type=REELS` y ambos usan `share_to_feed=true` para que
  aparezcan en el feed y en la pestaña Reels. La distinción `FEED`/`REEL` se
  conserva en la base y en la UI (y sí cambia el flujo de Facebook), pero en
  Instagram no altera la visibilidad del feed. Los videos deben cumplir las
  especificaciones de Reels (hasta 15 min; 9:16 recomendado).
- Facebook procesa el video de forma asíncrona: el reporte `SUCCESS` significa
  que la carga/publicación fue aceptada, no que el procesamiento terminó.

## 4. Reporte y estados

Cada rama termina en un nodo de reporte:

- Éxito: `status=SUCCESS` + `externalPostId` (el `id` del post o video) y,
  cuando se conoce, `externalPostUrl`.
- Error: `status=FAILED` + `errorMessage` (mensaje de Graph o timeout).
- El backend recalcula la publicación cuando ya no quedan targets `PENDING`:
  todo éxito → `PUBLISHED`; mezcla → `PARTIAL`; todo fallo → `FAILED`.

## 5. Operación

1. Importar/editar el workflow en n8n y activarlo.
2. Configurar el webhook con Header Auth (`x-webhook-secret`) y respuesta
   inmediata.
3. Verificar `N8N_DISPATCH_WEBHOOK_URL` en `apps/api/.env`:
   `http://localhost:5678/webhook/publish-now`.
4. Reiniciar el API después de cambiar el `.env`.
5. Probar el disparo inmediato solo con una publicación de prueba; el cron
   también reclamará cualquier `SCHEDULED` vencida.

El workflow no guarda secretos en el repositorio: la API key y el secreto del
webhook viven en las credenciales de n8n y en el `.env` local.

## 6. Diagnóstico

- Las ejecuciones del webhook de producción aparecen en **Executions** con
  `mode=webhook`; no se ven con "Listen for test event" (esa URL es
  `/webhook-test/...`).
- `POST /webhook/publish-now` responde `200 Workflow was started`; el endpoint
  del API responde `202` aunque el webhook falle (el cron es la garantía).
- El cron de 5 min aparece como ejecución programada; un claim vacío termina
  sin publicar y no es un error.
- Para verificar una publicación: revisar `targets[].target.format` en el claim,
  el reporte de cada target y el `externalPostId`/permalink en la red.
- n8n distingue **draft** y versión publicada: tras editar/importar hay que
  publicar y reiniciar; una edición en el editor no cambia el workflow activo
  hasta ese paso.
- Un post de Instagram ya publicado no puede cambiarse a `share_to_feed=true`
  por API; si se creó como Reel-only, hay que borrarlo y volver a publicarlo.
