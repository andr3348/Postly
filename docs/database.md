# Base de datos — `@postly/database`

> Dueño: `packages/database`. Fuente de verdad del esquema:
> `packages/database/prisma/schema.prisma` (PostgreSQL, IDs `cuid()`).

## 1. Propiedad y conexión

1. **Un solo dueño de `DATABASE_URL`: `packages/database/.env`.**
   No existe dependencia del api hacia esa variable: nada en `apps/api/src`
   la lee. `src/index.ts` carga el `.env` por **ruta absoluta derivada de su
   propia ubicación** (independiente del CWD). Variables reales de entorno
   siempre ganan (dotenv no sobrescribe) → producción/CI no cambia.
2. **El adapter vive aquí, no en el api.**
   `src/index.ts` construye `PrismaPg` + `PrismaClient` y exporta el singleton
   `prisma` (cacheado en `globalThis` contra hot-reload). El api **nunca**
   depende de `pg`/`@prisma/adapter-pg` directamente.
3. **`PrismaService` (api) solo gestiona ciclo de vida** (`$connect` /
   `$disconnect`). Los repositorios usan `this.prisma.client.<modelo>...`.
4. **El paquete no contiene queries escritas a mano.** Solo re-exporta el cliente
   generado + tipos. Los modelos aparecen solos tras definirlos en
   `schema.prisma` + `prisma generate`.
5. **Puerto local 5433, NO 5432** (5432 suele estar ocupado por otros proyectos).
   URL local: `postgresql://postly:postly@localhost:5433/postly`.

## 2. Diseño del esquema (definido y verificado)

```text
Brand 1 ──N Publication 1 ──N PublicationTarget 1 ──N TargetMetric
Brand 1 ──N ConnectedAccount
User  1 ──N Publication (como creador)
User  1 ──N Publication (como aprobador)
```

**Tablas.**

- `Brand` — **tabla nueva**: la empresa gestiona una o más marcas (ej. "Alma Quinta").
  Además de identidad (`name`, `logoUrl`, `websiteUrl`), guarda el **contexto para
  el motor de IA**: `aiTone`, `aiBrandVoice`, `aiTargetAudience` (alimentan el
  `systemPrompt` por marca/canal — responde al requisito de tono consistente) y
  `defaultHashtags` (array nativo PG). `Publication` y `ConnectedAccount`
  cuelgan de la marca, no del usuario.
- `User` — personal de marketing. `email` único, `name`, `passwordHash`
  (**argon2id**, nunca texto plano — ver decisión en `docs/backend.md`),
  `role` (`ADMIN` | `MARKETING`, default `MARKETING`), `createdAt`/`updatedAt`.
  Relaciones renombradas: `createdPublications` (lo que redactó) y
  `approvedPublications` (lo que aprobó); las cuentas conectadas se movieron a
  `Brand`. Índice `[role]`.
- `Publication` — pieza de contenido **por marca** (`brandId` requerido) +
  trazabilidad de IA. Guarda `originalPrompt`
  (lo que escribió marketing), `systemPrompt` (plantilla de tono por canal,
  derivable de `Brand.aiTone`/`aiBrandVoice`),
  `modelText` (`"manual"` si no intervino IA; si no, el modelo real que devolvió
  Gemini, incluido el fallback) / `modelMedia`, `tokensUsed` (base del cálculo
  B/C), `title` (**opcional**, Text, máx. 200: encabezado del borrador en el
  dashboard — la caption pública sigue siendo `copy`, así que n8n lo ignora),
  `copy` + `mediaUrl` (**obligatorios**: DRAFT = ya generado por IA y
  editable; en el dashboard `copy` se muestra como «Descripción»; el prompt
  pre-generación vive en el frontend, no en BD) + `mediaType` (`IMAGE` | `VIDEO`),
  estado (`DRAFT → PENDING_APPROVAL → SCHEDULED → PROCESSING → PUBLISHED`, con
  `PARTIAL`/`FAILED` para fallos por canal), `scheduledAt` (agenda) y
  `dispatchedAt` (cuándo se envió a n8n: distingue "agendado" de "despachado"),
  `approvedById` / `approvedAt` (auditoría del human-in-the-loop, FK con
  `SET NULL`; marketing redacta → admin aprueba vía `PENDING_APPROVAL`),
  `createdAt`/`updatedAt`. Índices `[brandId, status]`, `[userId, status]`,
  `[scheduledAt]` (este último para el polling de n8n).
- `ConnectedAccount` — credenciales OAuth **por marca** (ya no por usuario):
  `brandId` requerido, unicidad `[brandId, platform]`. Nuevo `status`
  (`CONNECTED` | `DISCONNECTED` | `EXPIRED`: ciclo de vida del token — `EXPIRED`
  indica re-autenticar antes de que n8n publique) y `accountName` visible
  (ej. "almaquintaoficial"). Tokens (`accessToken`, `refreshToken`) ahora
  opcionales en `Text`: permiten vincular la cuenta antes de completar OAuth.
  Índice `[brandId, status]`.
- `MetaOAuthSession` — sesión efímera del OAuth de Meta: `brandId`/`userId`,
  `stateHash` único (solo SHA-256, nunca el state en claro), `status`
  (`PENDING` | `READY` | `FAILED` | `COMPLETED`), `encryptedPayload` (Pages con
  Page tokens, AES-256-GCM), `errorCode`/`errorMessage`, `stateConsumedAt`,
  `expiresAt` (10 min desde `start`) y `completedAt`. Índices `[brandId,
  userId]` y `[expiresAt]`; el payload se borra al completar o fallar.
- `PublicationTarget` — publicación omnicanal: una fila por plataforma
  (`FACEBOOK` | `INSTAGRAM` | `LINKEDIN` | `TIKTOK`), con estado propio
  (`PENDING` | `SUCCESS` | `FAILED`), `format` (`PublicationFormat`: `FEED` |
  `REEL`, default `FEED`), `externalPostId`/`externalPostUrl` de la red, y
  `errorMessage` para reintentos. El formato vive en el target, no en la
  publicación: una misma pieza puede ser Facebook Feed + Instagram Reel.
  Unicidad `[publicationId, platform]`: una misma pieza no se publica dos veces
  en la misma red. Nuevo `publishedAt` (cuándo confirmó cada red) e índice
  `[platform, status]` (reintentos de n8n por plataforma). En el API/dominio el
  tipo se llama `TargetFormat`; el enum de Prisma es `PublicationFormat`.
  La BD usa `FEED` como default para el backfill; al adjuntar un target, el API
  aplica `REEL` para video de Facebook/Instagram y `FEED` para el resto.
  `REEL` exige `VIDEO` y solo es válido en Facebook/Instagram.
- `TargetMetric` — snapshots de métricas por target (`impressions`, `likes`,
  `comments`, `shares`, `clicks`, `capturedAt`). La tasa de engagement se
  **calcula** (`(likes+comments+shares)/impressions*100`), no se almacena. Alimenta la pestaña
  Analytics (ver `docs/frontend.md`).

**Reglas de integridad:** cascadas `Brand → Publication → PublicationTarget →
TargetMetric`, `Brand → ConnectedAccount` y `User → Publication` (creador)
(`onDelete: Cascade`); aprobación con `SET NULL` (borrar un usuario no borra
lo que aprobó); índice `[userId, status]`
(bandeja por estado) e índice `[publicationTargetId, capturedAt]` (series
temporales).

**Cobertura de requisitos:** roles + credenciales para auth ✓, multi-marca con
contexto IA por marca ✓, trazabilidad de
prompts/modelos/tokens ✓, flujo de estados para n8n (con aprobación
`PENDING_APPROVAL` y `dispatchedAt`) ✓, tokens OAuth por marca y plataforma
con ciclo de vida ✓,
publicación por canal con reintentos (`status` + `errorMessage`) ✓, formato
Feed/Reel por destino ✓, auditoría de aprobación ✓, métricas para Analytics ✓.

**Decisión (resuelta):** `copy`/`mediaUrl` son **obligatorios** — el enum lo
confirma: DRAFT = "creado o generado por IA, editable", es decir, la fila solo
existe *después* de generar. Nada existe en BD antes de la generación.
`title` nace **opcional**: es encabezado del dashboard (las redes destino no
tienen campo de título propio), así que no bloquea el flujo.

**Historial:** `prisma/migrations/20260921171619_init/` (esquema base de 4
tablas) + `prisma/migrations/20260922012202_init/` (5 correcciones de diseño)
+ `prisma/migrations/20260927165028_brand_support/` (Brand + campos nuevos,
generada por `migrate diff` + `migrate deploy`: `migrate dev` no corre sin TTY
en este entorno). Requirió reset en dev (filas seed vs. `brandId` requerido).
+ `prisma/migrations/20260927170741_draft_content_required/` (`copy`/`mediaUrl`
a NOT NULL, SQL manual de 2 líneas; requirió backfill de la fila DRAFT seed y
`migrate resolve --rolled-back` tras el primer intento fallido).
+ `prisma/migrations/20261020144054_add_publication_format_to_targets/`
  (`PublicationFormat` + `PublicationTarget.format` NOT NULL default `FEED`;
  los targets existentes quedan `FEED` por el default).
+ `prisma/migrations/20261021112955_add_publication_title/` (`Publication.title`
  opcional, SQL manual de 1 línea; las filas existentes quedan en NULL).
El seed deja 1 admin (hash argon2id real desde `SEED_ADMIN_*`: único bootstrap
del rol ADMIN, pues `register` siempre crea MARKETING) + 1 marca + 1 usuario
marketing (hash real desde `SEED_MARKETING_PASSWORD`) + 1 publicación PUBLISHED
aprobada con 2 targets y métricas + 1 DRAFT con contenido editable
(`prisma db seed`, re-ejecutable; falla rápido sin las env).

Notas de mantenimiento: el generator es `prisma-client` (salida `.ts`; NO
`prisma-client-js`, cuya salida `.js` convive mal con los imports y revive
stubs CJS que ocultan al cliente real — si reaparecen `.js`/`.d.ts` bajo
`src/generated/`, borrarlos y regenerar).

## 3. Comandos

```bash
pnpm --filter database exec prisma migrate dev --name <cambio>  # nueva migración
pnpm --filter database run build      # = prisma generate + tsc
pnpm --filter database run generate   # regenerar cliente tras editar schema
pnpm --filter database run studio     # inspector visual
pnpm --filter database exec prisma db seed  # admin + marca + usuarios + pubs + métricas (re-ejecutable; exige SEED_* en .env)
pnpm --filter database run push       # prototipado sin migración (no usar para tesis)
pnpm --filter database run reset      # ⚠️ borra datos locales
```
