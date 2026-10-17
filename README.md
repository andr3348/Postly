# Postly — Plataforma web con IA generativa y orquestación omnicanal

> **Contexto de tesis (SENATI, Arequipa — 2026).**
> Título formal: _"Desarrollo e implementación de una plataforma web con inteligencia
> artificial generativa y orquestación omnicanal para optimizar la creación y difusión
> de contenido publicitario en la empresa [Nombre de la Empresa], en Arequipa durante
> el periodo 2026"_.
>
> Este README resume el proyecto y cómo ponerlo en marcha. El detalle vive en
> [`docs/`](docs/): [`backend.md`](docs/backend.md) · [`frontend.md`](docs/frontend.md)
> · [`database.md`](docs/database.md). Si algo contradice a esos docs, los docs mandan.

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
Insights por IA), PostgreSQL + Prisma, n8n autoalojado (planificado).

## 3. Flujo de uso (MARKETING, ADMIN, n8n)

Cada flecha es un endpoint implementado y testeado del backend; el frontend
solo orquesta estas llamadas (sin lógica propia). Leyenda de estados:
`DRAFT → PENDING_APPROVAL → SCHEDULED → PROCESSING → PUBLISHED/PARTIAL/FAILED`.

```text
MARKETING                          ADMIN                              n8n (x-api-key)
   |                                 |                                   |
   |-- login: POST /auth/login       |                                   |
   |   (cookie HttpOnly)             |                                   |
   |-- crear: POST /publications     |                                   |
   |   --> DRAFT (generado, editable)|                                   |
   |-- canales: POST /:id/targets    |                                   |
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
   |                                 |                                   |
   |                                 |                                   |-- poll:
   |                                 |                                   |   POST /dispatch/claim
   |                                 |                                   |   (atómico; 204 si nada;
   |                                 |                                   |    400 sin credenciales)
   |                                 |                                   |-- publica en cada red
   |                                 |                                   |   (token descifrado)
   |                                 |                                   |-- reporta:
   |                                 |                                   |   POST .../targets/:id/report
   |                                 |                                   |   --> SUCCESS/FAILED + métricas
   |                                 |                                   |   auto: PUBLISHED/PARTIAL/FAILED
   |                                 |                                   |
   |-- GET /analytics/summary (ambos roles: totales, engagement, por plataforma)
```

**Caso extremo ADMIN** (todo lo de MARKETING, más): aprueba/rechaza,
gestiona marcas (`/brands`) y cuentas (`/brands/:id/accounts`, incluyendo
desconectar `EXPIRED`), ve todo sin filtro de autor. Límites honestos de esta
fase: el registro crea solo `MARKETING` (el admin nace del seed), sin
invalidación de sesiones (stateless), y brands/accounts aún sin restricción
por rol (endurecimiento pendiente).

## 4. Stack

| Capa            | Tecnología                                                            |
| --------------- | --------------------------------------------------------------------- |
| Monorepo        | Turborepo 2.10.12, pnpm 11.25.0, Node ≥ 24                            |
| Backend         | NestJS 12, `@nestjs/jwt` + `argon2` + `zod`, `vitest`, `oxlint`       |
| Datos           | Prisma **7.10.0** (NO v8 RC), PostgreSQL **17-alpine**                |
| Frontend        | Next.js 16.3.5, React 19, Tailwind 4 (Shadcn + Recharts planificados) |
| Orquestación/IA | n8n + APIs LinkedIn/OpenAI/Claude/difusión — planificados             |

## 5. Estructura

```text
Postly/
├── apps/api/          # NestJS — detalle en docs/backend.md
├── apps/web/          # Next.js — detalle en docs/frontend.md
├── packages/database/ # @postly/database, esquema y conexión — docs/database.md
├── docs/              # backend.md · frontend.md · database.md
└── compose.yaml       # PG local: postly/postly/postly @ localhost:5433
```

## 6. Puesta en marcha (5 minutos)

```bash
pnpm install
cp packages/database/.env.example packages/database/.env
docker compose up -d

# Secretos JWT del api (requeridos; ver docs/backend.md)
export JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 32)"

pnpm dev                            # api + web
pnpm check-types && pnpm lint       # verificación
pnpm --filter api run test:e2e      # e2e (DB levantada)
```

## 7. Roadmap (objetivos específicos)

- [x] Obj. 1 (parcial): flujo actual analizado y documentado.
- [x] Obj. 2: monorepo + esquema relacional **definido, migrado y verificado**.
      Falta: diagramas UML (casos de uso, clases, despliegue, secuencia).
- [ ] Obj. 3: backend — campañas, persistencia, LLMs/difusión.
      Hecho: auth, marcas, cuentas conectadas (+ verificación real), publications
      con targets/métricas, superficie de despacho n8n, resumen analítico.
      Falta: generación con IA (LLM + fal.ai) — ver TODO §7.1.
- [ ] Obj. 4: dashboard — prompt → preview → aprobación + Analytics/Insights.
      Hecho: Marcas, Cuentas y Publicaciones (bandeja, crear, detalle con flujo
      DRAFT → … → PUBLICADO y métricas) contra los contratos reales.
      Falta: vista Analytics/Insights — ver TODO §7.1.
      Backend listo: `GET /analytics/summary` + CORS con credenciales para el frontend.
- [ ] Obj. 5: n8n — superficie de despacho lista (`/dispatch`: claim atómico,
      reporte, métricas; ver `docs/backend.md` §7). Pendientes los workflows en el
      VPS contra las APIs (LinkedIn primero).
- [ ] Obj. 6: pruebas unitarias/integración/rendimiento.
- [ ] Obj. 7: medición 45 min → 3–5 min y cálculo B/C.

### 7.1 TODO — cierre del MVP (orden acordado)

1. [ ] **Vista Analytics** (`/dashboard/analytics`): la última vista planificada
   (`docs/frontend.md` §4). Resumen con `GET /analytics/summary` + gráficos de
   engagement/serie por canal; aquí sí se instalan **Shadcn + Recharts**
   (reservados hasta ahora).
2. [ ] **Pulido general** (post-MVP, sobre lo ya hecho): endurecer restricciones
   por rol en `/brands` y `/league-accounts`; paginación de la bandeja de
   publicaciones; reaper de estados `PROCESSING`; cambio de contraseña; Swagger.
3. [ ] **Generación IA end-to-end** (diseñada en BD, aún sin implementar —
   *nada existe en BD antes de generar*): un solo `POST /generations` con el
   prompt de marketing → módulo `generation/` con puertos `LlmTextGenerator`
   (texto, default doc: Gemini) + `MediaGenerator` (fal.ai: imagen FLUX /
   video Kling) → se persiste el DRAFT **pre-llenado** (copy, mediaUrl,
   `systemPrompt` desde `Brand.aiTone/aiBrandVoice/aiTargetAudience`,
   `modelText`/`modelMedia`/`tokensUsed`) y el usuario revisa/edita en el
   detalle. Asset final copiado a **R2** (decisión Cloudflare: cero egress).
   Botón "✨ Generar con IA" en `/dashboard/publications/new`; el form manual
   queda como fallback y n8n sigue siendo solo despacho.

## 8. Tesis — datos para capítulos V y VI

- Línea base: **20 posts/mes × 45 min = 15 h/mes**.
- Meta: **3–5 min/post** → **>85% de tiempo liberado**.
- Ahorro indirecto: consolidación de suscripciones dispersas.
- Meta financiera: **B/C ≥ 1.4–1.6**.
