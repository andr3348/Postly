# Postly — Plataforma web con IA generativa y orquestación omnicanal

> **Contexto de tesis (SENATI, Arequipa — 2026).**
> Título formal: _"Desarrollo e implementación de una plataforma web con inteligencia
> artificial generativa y orquestación omnicanal para optimizar la creación y difusión
> de contenido publicitario en la empresa Alma Quinta, en Arequipa durante
> el periodo 2026"_.
>
> Este README es la **fuente de contexto compartida** para los dos tesistas y para
> agentes IA que trabajen en el repo. Si algo contradice a este archivo, este archivo
> manda hasta que se actualice explícitamente.

## 1. Problema que resuelve

El área de marketing hoy produce contenido de forma **fragmentada y manual**:

1. Redacta copys en IAs aisladas (ChatGPT / Claude).
2. Genera imagen/video en plataformas externas independientes (Midjourney, Runway, Canva).
3. Copia/pega, descarga, reescala y programa manualmente en Metricool o red por red.

Consecuencias documentadas para la tesis (cap. II):

- **30–45 min por publicación** en trabajo mecánico.
- Artes y copys dispersos, sin repositorio corporativo de activos digitales.
- Tono de marca inconsistente por canal (p. ej. LinkedIn vs. resto).
- Sobrecosto: suscripciones separadas (IA texto + IA imagen + programador externo).

**Objetivo general:** reducir producción/distribución a **~3–5 min por post**
(revisión + aprobación humana), liberando >85% del tiempo (≈15 h/mes con
20 posts/mes) y sustentando una relación **B/C ≥ 1.4–1.6**.

## 2. Solución (visión de alto nivel)

```text
Marketing (Next.js) → prompt → IA texto/imagen/video → preview + aprobación
(Human-in-the-loop) → NestJS persiste en PostgreSQL → n8n programa/publica
→ LinkedIn/Facebook/Instagram/TikTok APIs → métricas vuelven a la plataforma
```

- **Monorepo Turborepo:** un solo repo para backend, frontend y tipos compartidos.
- **Backend NestJS:** campañas, autenticación (planificado), persistencia y
  webhooks bidireccionales NestJS ↔ n8n (reintentos, tokens por red).
- **Dashboard Next.js:** ingresar prompt, previsualizar (mockup por red),
  aprobar/rechazar, más pestaña **Analytics** con gráficos e
  **Insights Estratégicos por IA** (ver §3).
- **Orquestación n8n (autoalojado, planificado):** publicación programada y
  recolección de métricas.
- **IA (planificado):** copys con OpenAI GPT-4o o Anthropic Claude; multimedia con
  Flux / Stable Diffusion / Fal.ai / Runway / DALL-E 3; assets en S3/Cloudinary.

## 3. Analytics e Insights por IA (requisito de tesis)

Pestaña **Analytics** del Dashboard con dos capas:

**a) Muestra de datos (frontend Next.js).** Gráficos de:

- Métricas de publicaciones: impresiones, clics, reacciones, tasa de engagement
  (LinkedIn API o registradas tras la publicación → modelo `TargetMetric`).
- Métricas operativas: posts generados vs. aprobados, tiempo promedio de
  generación, volumen por canal.

**b) Interpretación de datos (el componente estrella de IA).** El backend envía
un resumen estructurado de métricas a un LLM, p. ej.:
*"Analiza estas métricas de los últimos 15 días en LinkedIn. Identifica qué
formatos o temáticas tuvieron mayor engagement y genera 3 recomendaciones
concretas para las próximas publicaciones."*
El dashboard muestra **"Insights Estratégicos por IA"**: resumen ejecutivo en
texto claro, p. ej. *"Las publicaciones con tono técnico y casos de estudio
obtuvieron un 32% más de alcance orgánico que los anuncios directos. Se sugiere
programar el próximo post técnico el martes entre las 9:00 y 11:00 am."*

**Decisión de librería:** Shadcn UI **no es** un motor de gráficos — sus
componentes `chart` (`ui.shadcn.com/docs/components/base/chart`) son envoltorios
declarativos sobre **Recharts** (hoy Recharts v3). Por tanto el stack es
**Shadcn UI (shell: cards, tabs, theming) + Recharts (motor de render, vía
primitivas `chart` de Shadcn) + Tailwind**. Se descarta Chart.js: API imperativa
y sin integración de primera clase con el theming Shadcn, mientras Recharts es
React declarativo y el camino oficialmente documentado por Shadcn. Estado:
**planificado** (ni Shadcn ni Recharts están instalados aún en `apps/web`).

## 4. Estado real del repo (no asumir más)

| Pieza                                                   | Estado                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api` (NestJS 12)                                  | `AppModule` + `PrismaModule` + `DashboardModule`. `DashboardService` con KPIs reales (totales, engagement calculado, performance por plataforma); controller pendiente. Tests: 3 unit + e2e en verde.                                                                                                                                                           |
| `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)       | Scaffold `create-next-app` casi intacto (`src/app/page.tsx`). Sin dashboard real todavía.                                                                                                                                                                                                                        |
| `packages/database` (`@postly/database`, Prisma 7.10.0) | **Esquema definido y migrado:** `User`, `Publication`, `PublicationTarget`, `TargetMetric`, `ConnectedAccount` + enums (`Role`, `MediaType`, `PublicationStatus`, `Platform`, `PlatformStatus`). Migraciones `20260921171619_init` (base) y `20260922012202_init` aplicadas; seed funcional. Singleton `prisma` verificado contra PG vivo. |
| `compose.yaml` (PostgreSQL 17-alpine)                   | Funcional, verificado.                                                                                                                                                                                                                                                                                           |
| n8n / LLMs / S3 / LinkedIn API / Analytics   | **Planificados, no implementados.** No escribir código que los asuma.  |

Fuente de verdad: `packages/database/prisma/schema.prisma` (PostgreSQL, IDs
`cuid()`). **Esquema definido y verificado** (migraciones aplicadas + CRUD vivo
probado + seed funcional). Diagrama entidad-relación:

```text
User 1 ──N Publication 1 ──N PublicationTarget 1 ──N TargetMetric
User 1 ──N ConnectedAccount
User 1 ──N Publication (como aprobador)
```

**Tablas.**

- `User` — personal de marketing. `email` único, `name`, `passwordHash`
  (bcrypt/argon2, nunca texto plano — base de la autenticación del Obj. 3),
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
  Analytics (§3).

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
`prisma/seed.ts` deja 1 usuario + 1 publicación PUBLISHED con 2 targets y
métricas (`pnpm --filter database exec prisma db seed`, re-ejecutable).

## 5. Stack y versiones fijadas

| Capa            | Tecnología (versión real)                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Monorepo        | Turborepo 2.10.12, pnpm 11.25.0, Node ≥ 24                                                        |
| Backend         | NestJS 12, `vitest`, `oxlint`, `supertest`                                                        |
| ORM/Datos       | Prisma **7.10.0** (línea estable; NO v8 RC), `@prisma/adapter-pg`, `pg`, PostgreSQL **17-alpine** |
| Frontend        | Next.js 16.3.5, React 19.2.8, Tailwind CSS 4, Shadcn UI + Recharts (planificado — ver §3) |
| Orquestación/IA | n8n + APIs LinkedIn/OpenAI/Claude/difusión — planificados                                         |

> Prisma v8 se evaluó y descartó por ser RC/Early Access. Toda la conexión usa la
> API estable v7 (`PrismaClient` + `{ adapter: new PrismaPg(...) }`).

## 6. Estructura del monorepo

```text
Postly/
├── apps/
│   ├── api/                    # NestJS
│   │   └── src/
│   │       ├── app.module.ts   # imports: PrismaModule, DashboardModule
│   │       ├── shared/prisma/  # PrismaModule + PrismaService (solo lifecycle)
│   │       └── dashboard/      # stub — aquí nace el módulo de campañas
│   └── web/                    # Next.js (scaffold intacto)
├── packages/
│   └── database/               # DUEÑO de la conexión y el esquema
│       ├── prisma/schema.prisma
│       ├── prisma7.config.ts
│       ├── src/index.ts        # exporta singleton `prisma` + tipos
│       └── src/generated/      # generado (no editar, no commitear)
├── compose.yaml                # PG local: postly/postly/postly @ localhost:5433
└── turbo.json
```

## 7. Contrato de base de datos (reglas para humanos y agentes)

1. **Un solo dueño de `DATABASE_URL`: `packages/database/.env`.**
   No existe `apps/api/.env`; nada en `apps/api/src` lee esa variable.
   `src/index.ts` carga el `.env` por **ruta absoluta derivada de su propia
   ubicación** (independiente del CWD). Variables reales de entorno siempre
   ganan (dotenv no sobrescribe) → producción/CI no cambia.
2. **El adapter vive en `@postly/database`, no en el api.**
   `src/index.ts` construye `PrismaPg` + `PrismaClient` y exporta el singleton
   `prisma` (cacheado en `globalThis` contra hot-reload). El api **nunca**
   depende de `pg`/`@prisma/adapter-pg` directamente.
3. **`PrismaService` solo gestiona ciclo de vida** (`$connect` / `$disconnect`).
   Los repositorios usan `this.prisma.client.<modelo>...`.
4. **El paquete no contiene queries escritas a mano.** Solo re-exporta el cliente
   generado + tipos. Los modelos aparecen solos tras definirlos en
   `schema.prisma` + `prisma generate`.
5. **Puerto local 5433, NO 5432** (5432 suele estar ocupado por otros proyectos).
   URL local: `postgresql://postly:postly@localhost:5433/postly`.

## 8. Puesta en marcha (onboarding en 5 minutos)

```bash
# 0. Requisitos: Node >= 24, pnpm 11.25, Docker + Compose
pnpm install

# 1. Credenciales locales (solo packages/database)
cp packages/database/.env.example packages/database/.env

# 2. Base de datos local
docker compose up -d
docker compose exec -T db pg_isready -U postly -d postly

# 3. Primera migración real (cuando el esquema esté aprobado)
pnpm --filter database exec prisma migrate dev --name init
pnpm --filter database run build   # = prisma generate + tsc

# 4. Desarrollo
pnpm dev                            # turbo: api + web
pnpm --filter api run start:dev     # solo backend (watch)
pnpm --filter web run dev           # solo frontend

# 5. Verificación
pnpm check-types                    # turbo: todos los paquetes
pnpm --filter api run test          # vitest unit
pnpm --filter api run test:e2e      # e2e (requiere `docker compose up -d`)
pnpm lint                           # turbo: todos los paquetes
```

Comandos útiles de datos:

```bash
pnpm --filter database run generate  # regenerar cliente tras editar schema
pnpm --filter database run studio    # inspector visual
pnpm --filter database run push      # prototipado sin migración (no usar para tesis)
pnpm --filter database run reset     # ⚠️ borra datos locales
```

## 9. Convenciones para agentes IA

- **Antes de codificar:** leer este README + `packages/database/prisma/schema.prisma`
  - `packages/database/src/index.ts` + el `package.json` del workspace tocado.
- **No crear archivos** salvo que sea imprescindible; preferir editar los existentes.
- **No asumir** n8n, auth, S3, ni endpoints de IA/redes — hoy no existen.
- **No mover** el adapter, `DATABASE_URL` ni el singleton fuera de
  `packages/database`. Si una tarea lo exige, pedir confirmación primero.
- **Verificar ejecutando:** `check-types` del paquete tocado; para backend,
  `test` y (si toca DB) e2e con compose levantado. No dar por hecho resultados.
- **Commits pequeños** por dominio; si un cambio altera un contrato
  (exports de `@postly/database`, esquema, puertos, scripts), actualizar este
  README en el mismo cambio.

## 10. Roadmap ligado a los objetivos específicos

- [x] Obj. 1 (parcial): flujo actual analizado y documentado (§1–§2).
- [x] Obj. 2: monorepo + esquema relacional **definido, migrado y verificado**
      (§4). Falta: diagramas UML (casos de uso, clases, despliegue, secuencia).
- [ ] Obj. 3: backend NestJS — campañas, auth, persistencia, integración LLMs/difusión.
- [ ] Obj. 4: dashboard Next.js — prompt → preview → aprobación human-in-the-loop,
      más pestaña Analytics (Shadcn + Recharts) e Insights Estratégicos por IA (§3).
      Base iniciada: `DashboardService` con KPIs en el backend, controller pendiente.
- [ ] Obj. 5: n8n — programación/publicación vía APIs (LinkedIn primero).
- [ ] Obj. 6: pruebas unitarias/integración/rendimiento.
- [ ] Obj. 7: medición 45 min → 3–5 min y cálculo B/C.

## 11. Tesis — datos para capítulos V y VI

- Línea base: **20 posts/mes × 45 min = 15 h/mes**.
- Meta: **3–5 min/post** (solo revisión/aprobación) → **>85% de tiempo liberado**.
- Ahorro indirecto: consolidación de suscripciones dispersas.
- Meta financiera: **B/C ≥ 1.4–1.6**.
