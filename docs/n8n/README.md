# Workflow n8n: Post Content

Snapshot importable del workflow `Post Content` (35 nodos) para que el equipo
pueda revisarlo, importarlo y manipularlo en n8n. Es documentación: el backend
no lee este archivo ni lo necesita para ejecutarse en producción.

- Contrato y operación: [`../n8n.md`](../n8n.md)
- Export saneado: [`post-content.workflow.json`](./post-content.workflow.json)

## Importación

1. En n8n, abrir **Workflows → Import from File**.
2. Seleccionar `post-content.workflow.json`.
3. Revisar el workflow antes de activarlo. El export se guarda con
   `active: false` para no activar nada por accidente.
4. Configurar las credenciales equivalentes en la instancia de destino:
   - `Postly Dispatch API`: Header Auth con header `x-api-key`; su valor debe
     coincidir con `N8N_API_KEY` del API.
   - `Webhook Credential`: Header Auth con header `x-webhook-secret`; su valor
     debe coincidir con `INTERNAL_WEBHOOK_SECRET` del API.
5. Verificar `N8N_DISPATCH_WEBHOOK_URL` en el API. En local apunta a
   `http://localhost:5678/webhook/publish-now`; en producción debe apuntar al
   webhook equivalente.
6. Activar el workflow solo cuando las credenciales y la URL estén listas.

> Las URLs `http://host.docker.internal:3001/...` de los nodos HTTP son de
> desarrollo local (n8n en Docker). Antes de usarlo en producción hay que
> reemplazarlas por la URL real del API y revisar todos los nodos HTTP.

## Contenido del export

- `Schedule Trigger` cada 1 minuto.
- `Webhook` `POST /webhook/publish-now` para despertar el despacho inmediato.
- Ramas de Facebook e Instagram para `FEED`/`REEL` y `IMAGE`/`VIDEO`.
- Reporte de éxito/fallo con `dispatchAttemptId` y `stage`.
- Nodos de permalink posteriores al publish; sus fallos no convierten una
  publicación ya aceptada en fallo.

El JSON conserva las referencias de credenciales (`httpHeaderAuth`) por nombre
e ID, pero **no contiene sus valores**. Los IDs son referencias locales de la
instancia donde se exportó; al importar en otra instancia hay que seleccionar
la credencial equivalente si n8n no la encuentra.

## Actualización

El workflow se edita en n8n, no directamente en este JSON. Para actualizar el
snapshot:

1. Exportar el workflow desde n8n.
2. Conservar `name`, `nodes`, `connections`, `settings` y
   `meta.templateCredsSetupCompleted`.
3. Quitar metadatos de instancia (`id`, `versionId`, `instanceId`, fechas,
   contadores), `pinData`, `staticData` y datos de ejecuciones.
4. Mantener `active: false` y las referencias de credenciales.
5. Reemplazar `post-content.workflow.json` y actualizar la fecha del snapshot
   en este README.

## Seguridad

- No subir `.env`, `creds-meta.json`, la base de datos de n8n, logs ni
  ejecuciones.
- Las API keys y secretos viven en las credenciales de n8n y en el `.env`
  local; nunca en este archivo.
- Este directorio es solo para importación manual. No agregar el JSON a
  `apps/api`, a `compose.yaml` ni a ningún proceso de arranque del backend.

## Snapshot

- Workflow: `Post Content`
- Nodos: 35
- Export: 21/10/2026
- Origen: n8n local (`http://localhost:5678`)
