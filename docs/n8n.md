# n8n — Publicación programada e inmediata

> Estado: workflow `Post Content` activo en el n8n local (`http://localhost:5678`).
> Publicado con los cambios de §7; el cron corre cada minuto.
> El backend es la fuente de verdad de la cola; n8n solo reclama, publica y reporta.
> Snapshot importable: [`n8n/post-content.workflow.json`](./n8n/post-content.workflow.json).
> Es solo para importación manual; el backend no lo lee en runtime.

## 1. Contrato con el backend

```text
POST /api/v1/dispatch/claim
  header: x-api-key: <N8N_API_KEY>
  → 200 {
      publication: { id, ..., dispatchAttemptId },
      targets: [{ target, credentials, caption }]
    }

POST /api/v1/dispatch/targets/:targetId/report
  header: x-api-key: <N8N_API_KEY>
  body: {
    dispatchAttemptId: string,          // el del claim vigente
    status: "SUCCESS" | "FAILED",
    stage?: "MEDIA_PREPARATION" | "PUBLISH",
    externalPostId?: string,            // obligatorio en SUCCESS
    externalPostUrl?: string,
    errorMessage?: string,              // obligatorio en FAILED (o error)
    error?: {                           // recomendado: error crudo de Meta
      code?, subcode?, message?, type?,
      isTransient?, httpStatus?, traceId?, retryAfterSeconds?
    },
    metrics?: { impressions?, likes?, comments?, shares?, clicks? }
  }
```

- Un claim vacío responde `200` con `{ publication: null, targets: [] }`; el
  workflow termina sin publicar.
- El claim marca la publicación como `PROCESSING` con un lease de 15 minutos y
  genera un `dispatchAttemptId` nuevo. **Todos los reportes deben enviar ese
  mismo id**; uno de un intento anterior responde `409` y no toca la
  publicación. Un reintento manual genera un intento nuevo.
- Si n8n muere, el watchdog del backend reencola o cierra la publicación. Un
  reporte duplicado con el mismo estado es idempotente; con otro estado
  responde `409` para no sobrescribir un resultado ya confirmado.
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
| Schedule | cada 1 minuto | Red de seguridad; publica lo que esté vencido. |
| Webhook | `POST /webhook/publish-now` | Solo despierta el flujo tras un “publicar ahora”. |

El webhook:

- Usa Header Auth con `x-webhook-secret` = `INTERNAL_WEBHOOK_SECRET` en la
  credencial `Webhook Credential`. No usa `Nest.js Backend` (esa credencial ya
  no existe en n8n).
- No lleva body y responde de inmediato (`Respond Immediately`).
- No publica por sí mismo: después del disparo se ejecuta el mismo
  `POST /dispatch/claim`.
- En desarrollo, la URL de prueba es `/webhook-test/publish-now`; en producción
  (workflow activo) es `/webhook/publish-now`. El API debe apuntar a la URL de
  producción en `N8N_DISPATCH_WEBHOOK_URL`.

## 3. Ramas de publicación

Después del claim, el workflow normaliza la respuesta, hace `Split Out` de
`targets` y ramifica con `platform + format + mediaType`:

- El nodo `Split Out` debe apuntar al campo `targets` y, si el flujo usa
  `$json.targets.*` aguas abajo, configurar
  `options.destinationFieldName = "targets"`. Sin eso, cada item sale como
  `{ target, credentials }` y `$json.targets.target` queda vacío.
- La alternativa es dejar el `Split Out` por defecto y cambiar las expresiones
  de las ramas a `$json.target.*` y `$json.credentials.*`.
- El `dispatchAttemptId` vive en la publicación del claim, no en cada target.
  Los nodos de reporte deben leerlo con una expresión del nodo de claim, por
  ejemplo `$('Claim').item.json.publication.dispatchAttemptId`, o propagarlo en
  un nodo `Set` antes de la bifurcación.

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

## 4. Reporte, fallos y reintento

Cada rama termina en un nodo de reporte:

- Éxito: `status=SUCCESS` + `externalPostId` (el `id` del post o video) y
  `externalPostUrl`. Facebook lo obtiene con `permalink_url` y, si esa consulta
  falla, lo construye desde `post_id`/`id`; Instagram lo obtiene con
  `permalink` después de `media_publish` y, si falla, reporta el éxito sin URL
  (la publicación ya existe; no se debe convertir en fallo).
- Error: `status=FAILED` + `stage` + `errorMessage` (mensaje de Graph o
  timeout) y, si se puede, `error` estructurado. El backend clasifica el fallo:
  causa, acción sugerida, código/subcódigo y si es seguro reintentar.
- El backend recalcula la publicación cuando ya no quedan targets `PENDING`:
  todo éxito → `PUBLISHED`; mezcla → `PARTIAL`; todo fallo → `FAILED`.

`stage` no es decorativo: define si un error es seguro de reintentar.

- `MEDIA_PREPARATION`: creación del contenedor de Instagram, polling de
  `status_code`, upload de Reels o cualquier paso **antes** del publish final.
  Un timeout/5xx aquí no creó el post; puede ser reintentable.
- `PUBLISH`: llamada final que crea el post (`media_publish`, `/photos`,
  `/videos`, finish de Reel). Un timeout/5xx **sin código de Meta** aquí es
  `UNKNOWN_OUTCOME`: el post pudo crearse y la UI no ofrece reintento. El
  usuario debe revisar la red social.
- Los errores 4xx con código de Meta se clasifican por subcódigo → código →
  HTTP/`is_transient`. Un 4xx desconocido se considera rechazo seguro (no creó
  post) y permite reintento; auth, permisos, contenido inválido y cuenta
  bloqueada no lo permiten.

Ejemplo de mapeo del error crudo de Graph en el nodo de reporte:

```json
{
  "dispatchAttemptId": "{{ $('Claim').item.json.publication.dispatchAttemptId }}",
  "status": "FAILED",
  "stage": "PUBLISH",
  "errorMessage": "{{ $json.error.message }}",
  "error": {
    "code": "{{ $json.error.code }}",
    "subcode": "{{ $json.error.error_subcode }}",
    "message": "{{ $json.error.message }}",
    "type": "{{ $json.error.type }}",
    "isTransient": "{{ $json.error.is_transient }}",
    "traceId": "{{ $json.error.fbtrace_id }}"
  }
}
```

### Reintento manual desde el dashboard

`POST /api/publications/:id/retry` (solo ADMIN, `202`) con
`{ platforms: ["FACEBOOK" | "INSTAGRAM"] }`:

- Solo acepta publicaciones `PARTIAL` o `FAILED`.
- Solo selecciona targets `FAILED` con fallo clasificado como seguro y menos de
  3 reintentos manuales.
- Pone únicamente esos targets en `PENDING`, limpia su error y deja la
  publicación en `SCHEDULED`. Los targets que ya salieron bien no se tocan.
- Reutiliza la aprobación original: no pide re-aprobación ni cambia
  `approvedBy`/`approvedAt`.
- Despierta a n8n con el mismo webhook de “publicar ahora”; el cron de 1 minuto
  es la garantía si el webhook falla. n8n reclama solo los targets `PENDING`.
- LinkedIn/TikTok no tienen reintento en esta fase. Un fallo no reintentable
  muestra la causa y la acción, pero no botón.

## 5. Operación

1. Importar/editar el workflow en n8n y activarlo. El snapshot saneado y las
   instrucciones de importación están en
   [`n8n/post-content.workflow.json`](./n8n/post-content.workflow.json) y
   [`n8n/README.md`](./n8n/README.md).
2. Configurar el webhook con Header Auth (`x-webhook-secret`) y respuesta
   inmediata.
3. Configurar la API key del backend como credencial Header Auth
   (`x-api-key`), no como texto fijo en un nodo. Si estuvo hardcodeada, rotarla
   y actualizar `N8N_API_KEY` en el API y en n8n.
4. Verificar `N8N_DISPATCH_WEBHOOK_URL` en `apps/api/.env`:
   `http://localhost:5678/webhook/publish-now`.
5. Reiniciar el API después de cambiar el `.env`.
6. Probar el disparo inmediato solo con una publicación de prueba. Para pruebas
   de contrato/backend, **pausar el workflow en n8n** para que el cron no
   publique de verdad; el backend permite simular claim/report con la API key.
7. Mantener el cron en **cada 1 minuto**; también es el barrido perezoso de
   leases vencidos.

El workflow no guarda secretos en el repositorio: la API key y el secreto del
webhook viven en las credenciales de n8n y en el `.env` local.

**Requisitos de Meta para que el workflow publique**

- El Page token del claim viene del OAuth del dashboard (o de un token manual
  verificado). Facebook e Instagram comparten el mismo token; si la cuenta
  está `EXPIRED`, hay que reconectar Facebook antes de reintentar.
- La Page debe tener tareas `MANAGE`/`CREATE_CONTENT` (o `PROFILE_PLUS_*`) y
  una cuenta de Instagram profesional vinculada. Si el rol viene de Business
  Manager, Meta exige además `ads_read` o `ads_management` para IG.
- PPA (*Page Publishing Authorization*) y 2FA pueden bloquear la publicación
  aunque el token sea válido.
- Si en la app de Meta se activa **Require App Secret**, n8n debe enviar
  `appsecret_proof` (HMAC-SHA256 del token con el App Secret) en cada llamada
  a Graph. La API no lo implementa; la opción recomendada es dejar esa
  configuración desactivada. Ver `docs/backend.md` §6.

## 6. Diagnóstico

- Las ejecuciones del webhook de producción aparecen en **Executions** con
  `mode=webhook`; no se ven con "Listen for test event" (esa URL es
  `/webhook-test/...`).
- `POST /webhook/publish-now` responde `200 Workflow was started`; el endpoint
  del API responde `202` aunque el webhook falle (el cron es la garantía).
- El cron de 1 minuto aparece como ejecución programada; un claim vacío termina
  sin publicar y no es un error.
- Para verificar una publicación: revisar `targets[].target.format` en el claim,
  el reporte de cada target y el `externalPostId`/permalink en la red.
- Un reporte con `dispatchAttemptId` viejo responde `409`; volver a reclamar
  antes de reportar. Un `409` por target ya reportado significa que n8n está
  duplicando un reporte con otro estado: no reintentar el POST.
- Si la UI muestra `Estado desconocido` (`UNKNOWN_OUTCOME`), revisar la red
  social antes de crear otra publicación: el post pudo haberse creado aunque
  n8n haya visto un timeout.
- n8n distingue **draft** y versión publicada: tras editar/importar hay que
  publicar y reiniciar; una edición en el editor no cambia el workflow activo
  hasta ese paso.
- Un post de Instagram ya publicado no puede cambiarse a `share_to_feed=true`
  por API; si se creó como Reel-only, hay que borrarlo y volver a publicarlo.

## 7. Cambios aplicados al workflow local (`Post Content`)

El workflow local ya refleja este contrato:

- **Credencial Header Auth** `Postly Dispatch API` (`x-api-key`): el claim y
  todos los reportes la referencian; la API key ya no está escrita en el JSON
  del workflow y se rotó la clave anterior.
- **Credencial Header Auth del Webhook** `Webhook Credential`
  (`x-webhook-secret`): reemplaza la referencia a `Nest.js Backend`, que ya no
  existía en n8n. Su valor coincide con `INTERNAL_WEBHOOK_SECRET`.
- **`Split Out`** con `options.destinationFieldName = "targets"`, de modo que
  cada item conserva `publication` y agrega `targets: { target, credentials }`.
- **Reportes con body JSON** y `dispatchAttemptId`:
  - `FB Report OK`, `IG Report OK` y `FB Reel Report OK` leen el intento con
    `$('Split Out').item.json.publication.dispatchAttemptId`.
  - `FB Report FAIL Media`, `FB Report FAIL Publish`, `IG Report FAIL Media` e
    `IG Report FAIL Publish` envían `stage`, `errorMessage` y `error`
    estructurado; los dos últimos son las ramas `PUBLISH` de los nodos
    originales `FB Report FAIL` e `IG Report FAIL`.
- **URLs de publicación**: `FB Permalink` (después de `FB Publish`/`FB Feed
  Video`) consulta `permalink_url`; `IG Permalink` (después de `IG Publish`)
  consulta `permalink`. Ambos usan `onError=continueErrorOutput`, timeout de
  10 s y reintentos, y sus dos salidas van al reporte de éxito, para que un
  fallo al leer la URL no convierta en fallo una publicación ya aceptada por
  Meta. `FB Report OK` e `IG Report OK` envían el `externalPostUrl` resultante.
  Un fallo de estos nodos no se reporta como fallo de publicación: solo omite
  la URL (Instagram) o usa la construida (Facebook).
- **Normalizadores** (nodos `Code`): `FB Media Failure`, `FB Publish Failure`,
  `IG Media Failure` e `IG Publish Failure`. Extraen recursivamente el error de
  Graph desde `details.body.error` (HTTP Request v4.5) o desde
  `error.message`/`error.response.data` (v4.2; el body de Meta llega
  serializado dentro del mensaje, p. ej. `400 - "{\"error\":{...}}"`), y emiten
  solo campos no nulos (`code`, `subcode`, `message`, `type`, `isTransient`,
  `httpStatus`, `traceId`, `retryAfterSeconds`).

Mapeo de `stage`:

| Nodo que falla | Stage |
| --- | --- |
| `FB Reel Start`, `FB Reel Upload` | `MEDIA_PREPARATION` |
| `IG Container`, `IG Feed Video Container`, `IG Reel Container`, `IG Video Check`, `IG Video Failed?` | `MEDIA_PREPARATION` |
| `FB Publish`, `FB Feed Video`, `FB Reel Finish`, `IG Publish` | `PUBLISH` |

El workflow quedó **publicado y activo** (35 nodos) con
`n8n publish:workflow --id=9TMR2mCw0aftMMz7`; el `Schedule Trigger` quedó
explícito en 1 minuto. El 21/10/2026 se probó el
webhook con `x-webhook-secret`: respondió `200`, el claim devolvió
`{ publication: null, targets: [] }` y no se publicó nada; el cron también
ejecutó un claim vacío. Para pausarlo, desactívalo desde n8n.
