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
User 1 ──N Publication 1 ──N PublicationTarget 1 ──N TargetMetric
User 1 ──N ConnectedAccount
User 1 ──N Publication (como aprobador)
```

**Tablas.**

- `User` — personal de marketing. `email` único, `name`, `passwordHash`
  (**argon2id**, nunca texto plano — ver decisión en `docs/backend.md`),
  `role` (`ADMIN` | `MARKETING`, default `MARKETING`), `createdAt`/`updatedAt`.
- `Publication` — pieza de contenido + trazabilidad de IA. Guarda `originalPrompt`
  (lo que escribió marketing), `systemPrompt` (plantilla de tono por canal),
  `modelText` (default `"gpt-4o"`) / `modelMedia`, `tokensUsed` (base del cálculo
  B/C), `copy` + `mediaUrl` (**opcionales**: el `DRAFT` se crea con el prompt
  ANTES de generar, flujo prompt-primero) + `mediaType` (`IMAGE` | `VIDEO`),
  estado (`DRAFT → SCHEDULED → PROCESSING → PUBLISHED`, con `PARTIAL`/`FAILED`
  para fallos por canal), `scheduledAt` (lo que consume n8n), `approvedBy` /
  `approvedAt` (auditoría del human-in-the-loop, FK con `SET NULL`),
  `createdAt`/`updatedAt`.
- `ConnectedAccount` — credenciales OAuth por plataforma para publicar vía APIs
  oficiales (`platform`, `externalAccountId`, `accessToken`, `refreshToken`,
  `expiresAt`, `scope`; tokens cifrados a nivel aplicación). Unicidad
  `[userId, platform]`: una cuenta conectada por usuario y red.
- `PublicationTarget` — publicación omnicanal: una fila por plataforma
  (`FACEBOOK` | `INSTAGRAM` | `LINKEDIN` | `TIKTOK`), con estado propio
  (`PENDING` | `SUCCESS` | `FAILED`), `externalPostId`/`externalPostUrl` de la
  red, y `errorMessage` para reintentos. Unicidad `[publicationId, platform]`:
  una misma pieza no se publica dos veces en la misma red.
- `TargetMetric` — snapshots de métricas por target (`impressions`, `likes`,
  `comments`, `shares`, `clicks`, `capturedAt`). La tasa de engagement se
  **calcula** (`(likes+comments+shares)/impressions*100`, ver
  `DashboardService.getSummaryMetrics`), no se almacena. Alimenta la pestaña
  Analytics (ver `docs/frontend.md`).

**Reglas de integridad:** cascadas `User → Publication → PublicationTarget →
TargetMetric` y `User → ConnectedAccount` (`onDelete: Cascade`); aprobación con
`SET NULL` (borrar un usuario no borra lo que aprobó); índice `[userId, status]`
(bandeja por estado) e índice `[publicationTargetId, capturedAt]` (series
temporales).

**Cobertura de requisitos:** roles + credenciales para auth ✓, trazabilidad de
prompts/modelos/tokens ✓, flujo de estados para n8n ✓, tokens OAuth por canal ✓,
publicación por canal con reintentos (`status` + `errorMessage`) ✓, auditoría de
aprobación ✓, métricas para Analytics ✓.

**Historial:** `prisma/migrations/20260921171619_init/` (esquema base de 4
tablas) + `prisma/migrations/20260922012202_init/` (5 correcciones de diseño).
Verificado con migraciones aplicadas + CRUD vivo + seed funcional.

## 3. Comandos

```bash
pnpm --filter database exec prisma migrate dev --name <cambio>  # nueva migración
pnpm --filter database run build      # = prisma generate + tsc
pnpm --filter database run generate   # regenerar cliente tras editar schema
pnpm --filter database run studio     # inspector visual
pnpm --filter database exec prisma db seed  # 1 usuario + 1 publicación + métricas (re-ejecutable)
pnpm --filter database run push       # prototipado sin migración (no usar para tesis)
pnpm --filter database run reset      # ⚠️ borra datos locales
```
