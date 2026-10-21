# TODO — modo agente + editor unificado

> Plan de trabajo acordado para la fase 2 del MVP. Este archivo es la **checklist
> viva** de la implementación (para no depender del contexto de la sesión); al
> cerrar la fase, su contenido debe quedar volcado en `docs/backend.md` §9,
> `docs/frontend.md` §4.2 y `README.md` §7.1, y este archivo puede borrarse.

## Decisiones cerradas (no re-litigar)

- **Orquestación en el backend**, no en n8n ni en el front:
  `POST /api/v1/generations/agent` (JWT) body
  `{ brandId, prompt, platform, format, mediaType? }`
  → Gemini (COPY, reusa `GenerateTextUseCase`) → fal.ai (`MediaGenerator`) →
  R2 (`MediaStorage`) → **crea el DRAFT** → `201` (la publicación creada,
  igual que `POST /publications`).
- **Auto-guardado server-side**: el DRAFT lo crea el backend dentro del mismo
  request (no un auto-click del front), para que un refresh/cierre de pestaña no
  pierda la media ya pagada. Único caso que se pierde: reinicio del server a
  mitad de la generación (mejora posterior: persistir `request_id` de fal).
- **Sin `FAL_KEY` ni R2 reales por ahora**: se implementan los adaptadores
  completos + tests (unit con fetch/S3 mockeados; e2e con providers stub). La
  prueba real queda pendiente de credenciales.
- **`title` en variantes de Gemini** (COPY/IMPROVE): hoy las variantes no lo
  traen; sirve para prellenar el título en Texto y para el agente.
- **`modelMedia`/`tokensUsed`** se auditan al crear el DRAFT: hoy
  `CreatePublicationInput` no los acepta (solo `modelText`). Ojo: los ids de fal
  llevan `/` (`fal-ai/flux/schnell`) → el regex de `modelMedia` debe admitirlo.
- **Media por formato**: `REEL` → video 9:16; `FEED` → imagen 1:1; el selector
  de media del panel puede forzar `VIDEO` en `FEED`.
- **Editor unificado**: crear y editar comparten vista; **se elimina el modal**
  "Editar borrador" del detalle (el botón navega a `[id]/edit`).
  En edición el panel IA muestra **Texto** (default, con `currentCopy` =
  descripción guardada → Mejorar) e **Ideas**; la pestaña **Agente se oculta**
  (crearía otro borrador; "regenerar media" queda fuera de alcance).
- **Agente = pestaña por defecto** en crear; Texto/Ideas siguen stateless.
- Después de generar con el agente: `invalidatePublications()` +
  navegación a `/dashboard/publications/{id}/edit` (misma vista de edición),
  para que nadie regenere creyendo que falló (re-cobro).

## Contrato y reglas del endpoint

- `platform` y `format` son **obligatorios**; `REEL` solo para Facebook/Instagram.
- `mediaType` opcional; default `REEL` → `VIDEO`, `FEED` → `IMAGE`.
- Un solo request (síncrono). Video puede tardar minutos; el backend persiste
  el DRAFT aunque el cliente se desconecte.
- Errores con la misma taxonomía (`{ statusCode, code, provider, model?, message, retryable }`):
  `FAL_*` (fal.ai) y `R2_*`/`MEDIA_DOWNLOAD_FAILED` (descarga+R2). `AiGenerationError`
  pasa a tener `provider` configurable (hoy fijo `'GEMINI'`).

## Checklist backend (en orden)

- [x] 1. `apps/api/src/shared/errors.ts`: `provider` configurable +
      códigos `FAL_*`, `R2_*`, `MEDIA_DOWNLOAD_FAILED` (sin romper `GEMINI_*`).
- [x] 2. Título en variantes: `domain/generated-content.entity.ts`,
      `application/build-brand-prompt.ts`, `application/parse-generated-text.ts`,
      `infrastructure/gemini-text.generator.ts` (`responseSchema`) + specs.
- [x] 3. `modelMedia`/`tokensUsed`: `application/create-publication.use-case.ts`,
      `domain/ports/publications.repository.ts` (input de create),
      `infrastructure/prisma-publications.repository.ts` (create) + specs.
- [x] 4. Puertos nuevos en `modules/generation/domain/ports/`:
      `media-generator.port.ts`, `media-storage.port.ts`.
- [x] 5. `infrastructure/fal-media.generator.ts`: queue API de fal
      (submit → poll `status_url` → `response_url`), `Authorization: Key`,
      envs `FAL_KEY`, `FAL_IMAGE_MODEL` (default `fal-ai/flux/schnell`),
      `FAL_VIDEO_MODEL` (default Kling text-to-video), timeout total configurable
      (video ~4 min, imagen ~1 min); payloads best-effort (ajustar al probar con
      key real) + unit con `fetch` mockeado.
- [x] 6. `infrastructure/r2-media.storage.ts`: `@aws-sdk/client-s3`
      (agregar dependencia en `apps/api`), `uploadFromUrl` (descarga + PutObject),
      envs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
      `R2_BUCKET`, `R2_PUBLIC_BASE_URL`; devuelve URL pública + unit con cliente
      inyectado.
- [x] 7. `application/generate-agent.use-case.ts`: texto (variante 0) → media →
      storage → `CreatePublicationUseCase`; helper puro de copy+hashtags (misma
      regla que el panel web) + unit con stubs tipados.
- [x] 8. `presentation/schemas/generation.schema.ts` (`generateAgentSchema`) +
      `presentation/generation.controller.ts` (`@Post('agent')`, 201,
      `@CurrentUser`) + `generation.module.ts` (importa `PublicationsModule`,
      providers `MEDIA_GENERATOR`/`MEDIA_STORAGE`).
- [x] 9. `publications.module.ts`: exportar `CreatePublicationUseCase`.
- [x] 10. `apps/api/.env.example`: `FAL_*` y `R2_*` (placeholders).
- [x] 11. `apps/api/test/generation.e2e-spec.ts`: agente feliz (overrides de
      `LLM_TEXT_GENERATOR`, `MEDIA_GENERATOR`, `MEDIA_STORAGE`) valida DRAFT +
      auditoría (`modelMedia`, `tokensUsed`) y sin targets; error
      `FAL_NOT_CONFIGURED` estructurado (reintentable vs no).
- [x] 12. Docs API: `docs/backend.md` §9 (endpoint, etapas, errores, envs,
      límites) + `README.md` §7.1.
- [x] 13. Verificación API: `check-types`, `lint`, `test`, `test:e2e`.
- [x] 14. Commit backend.

## Checklist frontend

- [x] 0. Leer `apps/web/AGENTS.md` + guía relevante de
      `apps/web/node_modules/next/dist/docs/01-app` **antes** de tocar rutas.
- [x] 1. `features/ai/api.ts`: `generateAgent()` + tipos (`GeneratedVariant.title`,
      respuesta = la publicación creada).
- [x] 2. `features/ai/components/AiAssistantPanel.tsx`: pestaña **Agente** (default),
      ocultable (`hideAgent`), `initialCopy` para Mejorar en edición,
      `onAgentDraft(publicationId)`; para agente exige prompt + plataforma + formato;
      aviso de que video tarda; errores con Reintentar según `retryable`.
- [x] 3. `features/publications/components/PublicationForm.tsx`: `fill` acepta
      `title` (prellenado de variantes/ideas).
- [x] 4. Editor unificado: `app/dashboard/publications/[id]/edit/page.tsx` +
      loader/componente que reusa el layout de `new` (panel Texto/Mejorar con
      `initialCopy`, sin Agente) y guarda con `updateDraft` → navega al detalle.
      Solo DRAFT (si no, redirige al detalle).
- [x] 5. `app/dashboard/publications/new/page.tsx`: `onAgentDraft` →
      `invalidatePublications()` + `router.push('/dashboard/publications/{id}/edit')`.
- [x] 6. `features/publications/components/PublicationDetail.tsx`: eliminar el
      modal de edición (estado, imports) y convertir el botón "Editar borrador"
      en Link a `[id]/edit`.
- [x] 7. Docs web: `docs/frontend.md` §4.2 (+ tabla de vistas del §4 si aplica).
- [x] 8. Verificación web: `lint` + `build`; prueba manual mínima si el entorno
      lo permite.
- [x] 9. Commit frontend.

## Verificación final

```bash
pnpm --filter api run check-types && pnpm --filter api lint && pnpm --filter api test && pnpm --filter api run test:e2e
pnpm --filter web run lint && pnpm --filter web run build
```

## Commits (inglés, una línea, sin push)

1. `docs: add agent mode implementation checklist` (este archivo)
2. `feat(api): include title in generated variants and audit media fields`
3. `feat(api): add agent endpoint orchestrating fal.ai and R2`
4. `feat(web): add agent mode and unified draft editor`
5. `docs: document agent mode and unified editor` (si queda algo suelto)

## Fuera de alcance (anotado, NO hacer ahora)

- Regenerar media/copy sobre un DRAFT existente.
- Robustez total ante reinicio del server a mitad de fal (persistir `request_id`).
- Rate-limit/cuotas de costo.
- Publicación real de LinkedIn/TikTok (n8n sigue FB/IG).
- Prueba real con `FAL_KEY` y bucket R2 (cuando existan credenciales).
