# Postly — Plataforma web con IA generativa y orquestación omnicanal

> **Contexto de tesis (SENATI, Arequipa — 2026).**
> Título formal: _"Desarrollo e implementación de una plataforma web con inteligencia
> artificial generativa y orquestación omnicanal para optimizar la creación y difusión
> de contenido publicitario en la empresa [Nombre de la Empresa], en Arequipa durante
> el periodo 2026"_.
>
> Este README resume el proyecto y cómo ponerlo en marcha. El detalle vive en
> [`docs/`](docs/): [`backend.md`](docs/backend.md) · [`frontend.md`](docs/frontend.md)
> · [`database.md`](docs/database.md) · [`n8n.md`](docs/n8n.md). Si algo contradice a esos docs, los docs mandan.

## 1. El problema

Marketing produce contenido de forma **fragmentada y manual**: copys en IAs
aisladas, multimedia en plataformas externas, programación manual red por red.
Consecuencias: **30–45 min por publicación**, activos dispersos sin repositorio
corporativo, tono de marca inconsistente y sobrecosto de suscripciones.

**Objetivo:** bajar a **~3–5 min por post** (revisión + aprobación humana),
liberando >85% del tiempo (≈15 h/mes con 20 posts/mes), con **B/C ≥ 1.4–1.6**.

## 2. La solución

```text
Marketing (Next.js) → prompt → IA texto/imagen/video → preview + aprobación
(Human-in-the-loop) → NestJS persiste en PostgreSQL → n8n programa/publica
→ LinkedIn/Facebook/Instagram/TikTok APIs → métricas vuelven a la plataforma
```

Monorepo Turborepo: backend NestJS (campañas, auth JWT, persistencia, webhooks
↔ n8n), dashboard Next.js (prompt → preview → aprobación + Analytics con
Insights por IA), PostgreSQL + Prisma, n8n autoalojado (workflow de
Facebook/Instagram activo).

## 3. Flujo de uso (MARKETING, ADMIN, n8n)

Cada flecha es un endpoint implementado y testeado del backend; el frontend
solo orquesta estas llamadas (sin lógica propia). Leyenda de estados:
`DRAFT → PENDING_APPROVAL → SCHEDULED → PROCESSING → PUBLISHED/PARTIAL/FAILED`.

```text
MARKETING                          ADMIN                              n8n (x-api-key)
   |                                 |                                   |
   |-- login: POST /auth/login       |                                   |
   |   (cookies HttpOnly)            |                                   |
   |-- crear: POST /publications     |                                   |
   |   --> DRAFT (generado, editable)|                                   |
   |-- canales: POST /:id/targets    |                                   |
   |   (platform + format FEED/REEL) |                                   |
   |   --> (409 si duplica)          |                                   |
   |-- enviar: POST /:id/submit      |                                   |
   |   --> PENDING_APPROVAL          |                                   |
   |       (>= 1 canal, si no 400)   |                                   |
   |                                 |                                   |
   |                                 |-- bandeja:                        |
   |                                 |   GET /publications               |
   |                                 |   ?status=PENDING_APPROVAL        |
   |                                 |-- aprobar: POST /:id/approve      |
   |                                 |   --> SCHEDULED (+auditoría)      |
   |                                 |-- rechazar: POST /:id/reject      |
   |                                 |   --> DRAFT (re-trabajo)          |
   |                                 |-- publicar ahora:                 |
   |                                 |   POST /:id/publish-now           |
   |                                 |   --> SCHEDULED (now) + webhook   |
   |                                 |       n8n (x-webhook-secret)      |
   |                                 |                                   |
   |                                 |                                   |-- poll:
   |                                 |                                   |   POST /api/v1/dispatch/claim
   |                                 |                                   |   (atómico; si nada:
   |                                 |                                   |    publication: null;
   |                                 |                                   |    lease vencido: reencola si
   |                                 |                                   |    nada se reportó (si no, FAILED);
   |                                 |                                   |    400 sin credenciales)
   |                                 |                                   |-- publica en cada red
   |                                 |                                   |   (token descifrado; Feed/Reel
   |                                 |                                   |    según target.format)
   |                                 |                                   |-- reporta:
   |                                 |                                   |   POST /api/v1/dispatch/targets/:id/report
   |                                 |                                   |   --> SUCCESS/FAILED + métricas
   |                                 |                                   |   auto: PUBLISHED/PARTIAL/FAILED
   |                                 |                                   |
   |-- GET /analytics/summary (ambos roles: totales, engagement, por plataforma)
```

El webhook de "publicar ahora" solo despierta a n8n (header `x-webhook-secret`,
sin body); el worker sigue reclamando con `/dispatch/claim`. Si el webhook falla,
el cron de n8n (5 min) publica igual: acelera, no reemplaza.

En Instagram ambos formatos (`FEED` y `REEL`) se publican como `REELS` con
`share_to_feed=true`, así que aparecen en el feed y en la pestaña Reels. En
Facebook el formato sí elige el flujo (`/videos` o `video_reels`).

**Caso extremo ADMIN** (todo lo de MARKETING, más): aprueba/rechaza/publica
ahora, gestiona marcas (`/brands`) y cuentas (`/brands/:id/accounts`, incluyendo
desconectar `EXPIRED`), ve todo sin filtro de autor. Límites honestos de esta
fase: el registro crea solo `MARKETING` (el admin nace del seed), el login es
tradicional (OAuth queda fuera por ahora) y brands/accounts aún sin restricción
por rol (endurecimiento pendiente). Las sesiones sí son revocables: multisesión
por dispositivo con refresh rotatorio y logout en servidor.

## 4. Stack

| Capa            | Tecnología                                                            |
| --------------- | --------------------------------------------------------------------- |
| Monorepo        | Turborepo 2.10.12, pnpm 11.25.0, Node ≥ 24                            |
| Backend         | NestJS 12, `@nestjs/jwt` + `argon2` + `zod`, `vitest`, `oxlint`       |
| Datos           | Prisma **7.10.0** (NO v8 RC), PostgreSQL **17-alpine**                |
| Frontend        | Next.js 16.3.5, React 19, Tailwind 4 (Shadcn + Recharts instalados)  |
| Orquestación/IA | n8n (workflow FB/IG activo) + Gemini texto (IDEAS/COPY/IMPROVE) + fase 2: modo agente (fal.ai + Cloudflare R2) — LinkedIn/TikTok planificados |

## 5. Estructura

```text
Postly/
├── apps/api/          # NestJS — detalle en docs/backend.md
├── apps/web/          # Next.js — detalle en docs/frontend.md
├── packages/database/ # @postly/database, esquema y conexión — docs/database.md
├── docs/              # backend.md · frontend.md · database.md · n8n.md
└── compose.yaml       # PG local: postly/postly/postly @ localhost:5433
```

## 6. Puesta en marcha (5 minutos)

```bash
pnpm install
cp packages/database/.env.example packages/database/.env
cp apps/api/.env.example apps/api/.env
docker compose up -d

# Cliente Prisma + dist de @postly/database (el api los resuelve en runtime):
pnpm --filter database run build
# Migraciones al PostgreSQL local + seed (admin, marca y publicación demo):
pnpm --filter database exec prisma migrate deploy
pnpm --filter database exec prisma db seed

# Completar secretos reales en apps/api/.env (openssl rand -hex 32):
#   JWT_ACCESS_SECRET · ENCRYPTION_KEY · N8N_API_KEY
# N8N_DISPATCH_WEBHOOK_URL / INTERNAL_WEBHOOK_SECRET pueden quedar como
# placeholder en dev: el api arranca y, sin n8n, `publish-now` cae al claim
# del cron.
# IA de texto (opcional para levantar; requerida para el panel Gemini):
#   GEMINI_API_KEY (ver apps/api/.env.example)

pnpm dev                            # api + web
pnpm check-types && pnpm lint       # verificación
pnpm --filter api run test:e2e      # e2e (DB levantada y migrada)

# Tras un pull con migraciones nuevas:
#   pnpm --filter database exec prisma migrate deploy && pnpm --filter database run build
```

## 7. Roadmap (objetivos específicos)

- [x] Obj. 1 (parcial): flujo actual analizado y documentado.
- [x] Obj. 2: monorepo + esquema relacional **definido, migrado y verificado**.
      Falta: diagramas UML (casos de uso, clases, despliegue, secuencia).
- [x] Obj. 3: backend — campañas, persistencia, LLMs/difusión.
      Hecho: auth, marcas, cuentas conectadas (+ verificación real), publications
      con targets/métricas, superficie de despacho n8n, resumen analítico,
      generación de texto con Gemini (`POST /api/v1/generations/text`) y modo
      agente (`POST /api/v1/generations/agent`: Gemini → fal.ai → Cloudflare R2
      → DRAFT). Pendiente ambiental: probar con credenciales reales de fal.ai/R2
      (el código y los tests usan mocks).
- [x] Obj. 4: dashboard — prompt → preview → aprobación + Analytics/Insights.
      Hecho: Marcas, Cuentas y Publicaciones (bandeja, crear con asistente IA,
      detalle con flujo DRAFT → … → PUBLICADO y métricas) + vista Analytics —
      contra los contratos reales (`GET /analytics/summary` + CORS con credenciales).
      Falta: Insights por IA (capa b de `docs/frontend.md` §5).
- [ ] Obj. 5: n8n — workflow `Post Content` activo para Facebook/Instagram
      (Feed/Reel, cron de 5 min + `publish-now`), con claim atómico, lease de
      15 min que reencola o cierra despachos abandonados y reporte por target
      (ver `docs/n8n.md`). Pendientes: LinkedIn/TikTok y despliegue en el VPS.
- [ ] Obj. 6: pruebas unitarias/integración/rendimiento.
- [ ] Obj. 7: medición 45 min → 3–5 min y cálculo B/C.

### 7.1 TODO — cierre del MVP (orden acordado)

1. [x] **Vista Analytics** (`/dashboard/analytics`): la última vista planificada
   (`docs/frontend.md` §4). Resumen con `GET /analytics/summary` + gráficos de
   engagement por canal; **Shadcn + Recharts** ya instalados y en uso.
2. [ ] **Pulido general** (post-MVP, sobre lo ya hecho): endurecer restricciones
   por rol en `/brands` y `/brands/:id/accounts` (módulo connected-accounts);
   paginación de la bandeja de publicaciones; cambio de contraseña; Swagger;
   deuda menor: unificar el lockfile duplicado (`apps/web/pnpm-lock.yaml`).
3. [x] **Generación de texto con Gemini (MVP)** — `POST /api/v1/generations/text`
   (`IDEAS | COPY | IMPROVE`) con contexto de `Brand`, JSON estructurado, Zod y
   fallback `gemini-3.8-flash` → `gemini-3.5-flash-lite`. Panel en
   `/dashboard/publications/new` con "Más ideas" acumulativo, "Desarrollar" y
   "Usar este texto"; la generación no persiste, pero al crear el `DRAFT` se
   audita el `modelText` real (incluido el fallback). Los errores de Gemini se
   explican por causa y solo ofrecen **Reintentar** cuando son reintentables. La
   media sigue manual en Texto/Ideas.
   [x] **Fase 2 — modo agente (un prompt → DRAFT con media):** desde un solo
   prompt, Gemini prellena el borrador (título + descripción + hashtags) y
   produce el guion de la media; el backend envía ese guion a `MediaGenerator`
   (fal.ai: imagen FLUX / video Kling) y guarda el resultado en `MediaStorage`
   — **Cloudflare R2** (API compatible con S3, URL pública) —, auditando
   `modelMedia`/`tokensUsed`. El usuario revisa/edita antes de programar. Las
   pestañas Texto/Ideas y el formulario manual se conservan como fallback, y n8n
   sigue siendo solo despacho. Backend (`docs/backend.md` §9.2) y panel
   (`docs/frontend.md` §4.2–4.3) completos; probar con credenciales reales de
   fal.ai/R2 queda pendiente (sin keys en este entorno).
   Base lista: `Publication.title` opcional (migración + UI; en el dashboard
   `copy` se muestra como «Descripción»), `caption` fusionada por target en el
   claim de n8n y título prellenado por la IA.

## 8. Tesis — datos para capítulos V y VI

- Línea base: **20 posts/mes × 45 min = 15 h/mes**.
- Meta: **3–5 min/post** → **>85% de tiempo liberado**.
- Ahorro indirecto: consolidación de suscripciones dispersas.
- Meta financiera: **B/C ≥ 1.4–1.6**.
