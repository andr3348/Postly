# n8n — Publicación programada e inmediata

> Estado: workflow `Post Content` activo en el n8n local (`http://localhost:5678`).
> El backend es la fuente de verdad de la cola; n8n solo reclama, publica y reporta.

## 1. Contrato con el backend

```text
POST /api/v1/dispatch/claim
  header: x-api-key: <N8N_API_KEY>
  → 200 { publication, targets: [{ target, credentials }] }

POST /api/v1/dispatch/targets/:targetId/report
  header: x-api-key: <N8N_API_KEY>
  body: { status: "SUCCESS" | "FAILED", externalPostId?, externalPostUrl?, errorMessage? }
```

- Un claim vacío responde `200` con `{ publication: null, targets: [] }`; el
  workflow termina sin publicar.
- El claim marca la publicación como `PROCESSING` con un lease de 15 minutos.
  Si n8n muere, el watchdog del backend la reencola o la marca `FAILED`.
- Cada target del claim ya trae `target.platform`, `target.format`
  (`FEED | REEL`), `target.id` y `credentials` descifradas. El workflow **debe
  reportar todos los targets**, incluso cuando uno falle.
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
| Instagram Feed video | `INSTAGRAM`, `FEED`, `VIDEO` | `POST /{ig-id}/media` (`media_type=VIDEO`, `video_url`) → polling → `media_publish` |
| Instagram Reel | `INSTAGRAM`, `REEL` | `POST /{ig-id}/media` (`media_type=REELS`, `share_to_feed=true`) → polling → `media_publish` |

Notas de Meta (Graph API `v25.0`):

- Facebook Reels solo se publican en Pages y requieren un video vertical
  9:16 (mínimo 540×960). Un video 16:9 puede funcionar como Feed, no como Reel.
- El upload de Reels acepta una URL pública en el header `file_url` de
  `rupload.facebook.com`; no se sube el binario por n8n.
- Instagram exige crear el contenedor, esperar `status_code=FINISHED` y recién
  entonces llamar a `media_publish`. El workflow espera 15 s y reintenta hasta
  20 veces (5 minutos); si expira, reporta el target como `FAILED`.
- Facebook procesa el video de forma asíncrona: el reporte `SUCCESS` significa
  que la carga/publicación fue aceptada, no que el procesamiento terminó.

## 4. Reporte y estados

Cada rama termina en un nodo de reporte:

- Éxito: `status=SUCCESS` + `externalPostId` (el `id` del post o video).
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
