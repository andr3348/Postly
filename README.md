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

## 3. Stack

| Capa            | Tecnología                                                            |
| --------------- | --------------------------------------------------------------------- |
| Monorepo        | Turborepo 2.10.12, pnpm 11.25.0, Node ≥ 24                            |
| Backend         | NestJS 12, `@nestjs/jwt` + `argon2` + `zod`, `vitest`, `oxlint`       |
| Datos           | Prisma **7.10.0** (NO v8 RC), PostgreSQL **17-alpine**                |
| Frontend        | Next.js 16.3.5, React 19, Tailwind 4 (Shadcn + Recharts planificados) |
| Orquestación/IA | n8n + APIs LinkedIn/OpenAI/Claude/difusión — planificados             |

## 4. Estructura

```text
Postly/
├── apps/api/          # NestJS — detalle en docs/backend.md
├── apps/web/          # Next.js — detalle en docs/frontend.md
├── packages/database/ # @postly/database, esquema y conexión — docs/database.md
├── docs/              # backend.md · frontend.md · database.md
└── compose.yaml       # PG local: postly/postly/postly @ localhost:5433
```

## 5. Puesta en marcha (5 minutos)

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

## 6. Roadmap (objetivos específicos)

- [x] Obj. 1 (parcial): flujo actual analizado y documentado.
- [x] Obj. 2: monorepo + esquema relacional **definido, migrado y verificado**.
      Falta: diagramas UML (casos de uso, clases, despliegue, secuencia).
- [ ] Obj. 3: backend — campañas, persistencia, LLMs/difusión.
      Auth lista (patrón Clean Architecture a replicar).
- [ ] Obj. 4: dashboard — prompt → preview → aprobación + Analytics/Insights.
- [ ] Obj. 5: n8n — programación/publicación vía APIs (LinkedIn primero).
- [ ] Obj. 6: pruebas unitarias/integración/rendimiento.
- [ ] Obj. 7: medición 45 min → 3–5 min y cálculo B/C.

## 7. Tesis — datos para capítulos V y VI

- Línea base: **20 posts/mes × 45 min = 15 h/mes**.
- Meta: **3–5 min/post** → **>85% de tiempo liberado**.
- Ahorro indirecto: consolidación de suscripciones dispersas.
- Meta financiera: **B/C ≥ 1.4–1.6**.
