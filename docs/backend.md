# Backend — `apps/api` (NestJS 12)

> Patrón vigente: Clean Architecture por módulo
> (`modules/<modulo>/{domain,application,infrastructure,presentation}`),
> estrenado en `modules/auth` y a replicar en el resto.

## 1. Módulo auth (JWT stateless + argon2id)

Sin revocación ni sesiones en esta fase: access corto + refresh largo, ambos
stateless (firma + expiración). **No existe tabla de refresh tokens por diseño.**

```text
POST /auth/register   → Set-Cookie: accessToken, refreshToken + { user }   (201; 409 si el email existe)
POST /auth/login      → Set-Cookie: accessToken, refreshToken + { user }   (200; 401 credencial inválida)
POST /auth/refresh    → lee Cookie: refreshToken; rota el par + { user }   (200; 401 refresh inválido/ausente)
GET  /auth/me         → AccessPayload                                      (protegida; sonda del guard)
```

Capas (`src/modules/auth/`):

- `domain/` — entidad `User` pura (interfaces + `toSafeUser`; sin clases por
  decisión documentada abajo), errores propios, puertos con `Symbol()`
  (`USERS_REPOSITORY`, `PASSWORD_HASHER`, `TOKEN_ISSUER`).
- `application/` — casos de uso `Register` / `Login` / `Refresh`. Puros:
  dependen solo de puertos. Mensaje único ante email inexistente o password
  incorrecto.
- `infrastructure/` — `PrismaUsersRepository` (vía `PrismaService.client`,
  mapea el rol en el borde), `Argon2PasswordHasher`, `JwtTokenIssuer`
  (secretos separados + campo `type` anti-confusión), `JwtAuthGuard` global
  (sin passport, a propósito) con opt-out `@Public()`.
- `presentation/` — controller delgado (sin try-catch), schemas Zod
  (`register` / `login` / `refresh`), `@CurrentUser()`.

Traducción dominio→HTTP centralizada en `src/shared/filters.ts`
(`DomainExceptionFilter`, global vía `APP_FILTER`). Compartidos transversales
en `src/shared/`: `errors.ts`, `decorators.ts`, `filters.ts`, `env-file-path.ts`.
Regla de dirección: **`src/shared/` nunca importa de `src/modules/`.**

## 2. Flujo de rotación JWT (stateless, por cookies HttpOnly)

Decisión de seguridad: los tokens **jamás van en el JSON** (un token en el
cuerpo queda expuesto a XSS vía JS). Viajan en cookies `HttpOnly` (`Secure`
solo en producción, `SameSite=Lax`, `Path=/`, `Max-Age` = expiración del JWT),
fijadas por el controller y leídas por el guard / endpoint de refresh.
Nombres centralizados en `infrastructure/auth-cookies.ts`.

```text
1. Registro/login ──→ Set-Cookie: accessToken (15 min) + refreshToken (7 días)
                      + cuerpo { user } (sin tokens, sin passwordHash)
2. Navegación ──→ el navegador adjunta Cookie: accessToken solo;
                  el guard lo verifica y expone request.user
3. Expira el access ──→ POST /auth/refresh (sin cuerpo: la cookie
                       refreshToken viaja sola) ──→ verifica firma +
                       expiración + campo type=refresh ──→ Set-Cookie con
                       par NUEVO (rotación) + { user }
4. Refresh inválido/ausente ──→ 401 (mismo error, sin revelar causa)
```

Límites asumidos de esta fase (sin revocación ni sesiones): no hay logout con
invalidación en servidor (las cookies mueren por expiración) ni detección de
reuso. Si la tesis los exige después, el punto de extensión es una tabla de
sesiones (hash del refresh + `revokedAt`) — hoy explícitamente fuera de alcance.
Nota CSRF: al autenticar por cookie, los POST quedan expuestos a CSRF
cross-site; `SameSite=Lax` lo mitiga y los tokens CSRF quedan pendientes si el
jurado los exige. Frontend (`docs/frontend.md`): `fetch` con
`credentials: 'include'`.

### Plan futuro — patrón B (access en memoria + refresh opaco con tabla)

Si la tesis exige logout con invalidación, multi-sesión o detección de robo,
la evolución es el patrón estándar para SPAs (no un híbrido tibio):

1. Modelo `RefreshToken` en Prisma: `userId`, `tokenHash` (SHA-256 del valor;
   jamás el token en claro), `expiresAt`, `revokedAt?`, `replacedByTokenId?`,
   `userAgent?`, `ip?`.
2. Refresh **opaco** (aleatorio, no JWT): con tabla de por medio, la firma
   stateless no aporta nada; la revocación es un lookup.
3. Rotación con detección de reuso: cada refresh consume el viejo y emite uno
   nuevo; reusar un token consumido = robo → revocar la familia entera.
4. Frontend: access en memoria + Bearer manual, interceptor 401 → refresh
   silencioso → reintento; refresh silencioso al boot.
5. Alcance explícito hoy: **fuera** (sin revocación ni sesiones). Este plan solo
   se activa por decisión de alcance, con su migración y tests correspondientes.

**Decisión argon2id sobre bcrypt (punto defendible en tesis):** bcrypt es lento
a propósito pero no es memory-hard (expuesto a GPU/ASIC) y trunca a 72 bytes;
argon2id es la primera recomendación OWASP para hashing de contraseñas
(resistente a GPU/ASIC por costo de memoria + tiempo). Parámetros explícitos en
`Argon2PasswordHasher` (`argon2id`, m=19 MiB, t=2, p=1). Queda tras el puerto
`PasswordHasher`: intercambiable sin tocar casos de uso. Los tokens JWT no se
hashean: se firman con HMAC (rápido por diseño).

**Decisión entidad-interfaz sobre entidad-clase:** con validación Zod-first no
hay `class-transformer` (la única ganancia real de una clase), y las entidades
hoy no tienen comportamiento. Una clase con solo props + getters sería
ceremonia. Revisitar cuando una entidad necesite métodos
(p. ej. `publication.canTransitionTo(...)`).

## 3. Contratos del api

1. **Secretos JWT son propiedad del api** (`JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, opcionales `JWT_ACCESS_EXPIRES_IN_SECONDS=900` y
   `JWT_REFRESH_EXPIRES_IN_SECONDS=604800`). Viven en `apps/api/.env`, que
   carga el `ConfigModule` propio de Nest (`isGlobal`, ruta anclada al package
   root en `src/shared/env-file-path.ts` — independiente del CWD en dev,
   `dist/` y tests; sin `dotenv` como dependencia directa). `DATABASE_URL`
   sigue siendo exclusiva de `packages/database`. Variables reales siempre
   ganan. Validación de forma con Zod en la factoría de opciones.
2. **Validación Zod-first (NestJS v12):** schemas en `@Body({ schema })` +
   `StandardSchemaValidationPipe` como `APP_PIPE` en `AppModule` (aplica igual
   en prod que en tests, que no pasan por `main.ts`).
   `class-validator` no se usa en código nuevo.
3. **Guard global:** todo queda protegido salvo rutas con `@Public()`.
4. **Datos solo vía `this.prisma.client.<modelo>...`.** El api nunca depende de
   `pg` / `@prisma/adapter-pg`.
5. **CORS con credenciales** (`setup-app.ts`, heredado por e2e): sin
   `enableCors({ origin, credentials: true })` el dashboard (otro origen) no
   puede autenticarse con cookies. Orígenes coma-separados en `WEB_ORIGIN`
   (`apps/api/.env`).
6. **Gemini es solo backend:** `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`
   (default `gemini-3.8-flash`) y `GEMINI_TEXT_FALLBACK_MODEL`
   (`gemini-3.5-flash-lite`) viven en `apps/api/.env`; el navegador nunca los
   recibe. La generación usa `fetch` nativo, salida JSON estructurada y Zod,
   sin SDK de Gemini.

## 4. Módulo publications (human-in-the-loop)

Máquina de estados (transiciones permitidas en `domain/publication.entity.ts`
via `canTransition`; n8n mueve `SCHEDULED → PROCESSING → PUBLISHED/PARTIAL/FAILED`):

```text
POST   /publications            → crea DRAFT (verifica la marca: 404 si no existe)
GET    /publications?brandId=&status= → bandeja (usa índice [brandId, status])
GET    /publications/:id        → detalle (404 si no existe)
PATCH  /publications/:id        → edita copy/media solo en DRAFT (dueño o admin)
POST   /publications/:id/submit → DRAFT → PENDING_APPROVAL (dueño o admin)
POST   /publications/:id/approve→ PENDING_APPROVAL → SCHEDULED, solo ADMIN
                                   (body { scheduledAt }; exige ≥1 canal; fija
                                   approvedBy/approvedAt)
POST   /publications/:id/publish-now → PENDING_APPROVAL → SCHEDULED con
                                   scheduledAt=now y despierta a n8n (202; solo ADMIN)
POST   /publications/:id/reject → PENDING_APPROVAL → DRAFT, solo ADMIN
```

Autorización en los casos de uso (no en guards): el `requester` (`id` + `rol`
del `@CurrentUser()`) viaja al caso de uso; dueño-or-admin para editar/enviar,
solo-ADMIN para aprobar/publicar-ahora/rechazar. Errores:
`PublicationNotFoundError` → 404, `InvalidPublicationTransitionError` → 400,
`PublicationWithoutTargetsError` → 400 (submit o aprobar sin canales),
`ForbiddenError` → 403.

**Destinos omnicanal (sin módulo propio):** la publicación decide *qué*,
el target *dónde y cómo*. Anidados bajo la publicación (dueño o admin, solo
antes de programar):

```text
GET    /publications/:id/targets                       → canales con estado y formato
POST   /publications/:id/targets { platform, format? } → adjunta canal (409 si duplica)
PATCH  /publications/:id/targets/:platform { format }  → cambia Feed/Reel
DELETE /publications/:id/targets/:platform             → quita canal (404 si no existe)
```

`format` es `FEED | REEL`. Reglas:

- `FEED` es válido para imágenes y videos en cualquier plataforma.
- `REEL` exige `mediaType=VIDEO` y solo se permite en Facebook/Instagram.
- Default al adjuntar: video en Facebook/Instagram → `REEL`; el resto → `FEED`.
- `PATCH` y `POST` rechazan combinaciones inválidas con
  `InvalidTargetFormatError` → 400.
- Cambiar la publicación a `IMAGE` con targets `REEL` adjuntos → 400; primero
  hay que pasarlos a `FEED`.
- `submit` valida los formatos de todos los canales antes de pasar a
  `PENDING_APPROVAL`.

El backend solo valida y persiste la intención; n8n la traduce a endpoints.
En Instagram ambos formatos se publican como `REELS` con
`share_to_feed=true` (Meta deprecó el video de feed nativo), así que
`FEED`/`REEL` no cambia la visibilidad del feed; en Facebook sí cambia el flujo
(`/videos` vs. `video_reels`). Ver `docs/n8n.md` §3.

Regla: `submit` exige ≥1 canal (`PublicationWithoutTargetsError` → 400). La
unicidad `[publicationId, platform]` la garantiza la BD; el caso de uso la
verifica antes para un 409 limpio. n8n actualiza cada target (`status`,
`externalPostId/Url`, `errorMessage`, `publishedAt` en éxito) y escribe
`TargetMetric`.

**Métricas (sin módulo propio):** snapshots por destino, base de los gráficos
de Analytics. Solo en destinos `SUCCESS` (medir lo no publicado es ruido;
`TargetNotPublishedError` → 400):

```text
GET    /publications/:id/targets/:platform/metrics → historial por capturedAt
POST   /publications/:id/targets/:platform/metrics → registra snapshot
       { impressions?, likes?, comments?, shares?, clicks? } (enteros ≥0)
```

Cada POST es una fila (serie temporal, índice `[publicationTargetId,
capturedAt]`); la tasa de engagement se calcula al leer, nunca se almacena.

## 5. Módulo brand (Gestión de Marcas)

Siguiendo el patrón Clean Architecture ya establecido, el módulo de **Brand** expone el CRUD básico de las marcas conectadas a la aplicación.

```text
POST   /brands         → crea una nueva marca (valida con Zod, 201)
GET    /brands         → lista completa de marcas ordenadas por fecha descendente
                        (envuelta: `{ brands }`; el detalle va como `{ brand }`)
GET    /brands/:id     → obtiene los detalles de la marca (404 si no existe)
PATCH  /brands/:id     → actualiza parcialmente la información de la marca
DELETE /brands/:id     → elimina una marca de forma permanente (204)
```

Capas (`src/modules/brand/`):

- `domain/` — entidad `Brand` pura (interfaz sin decoradores). Definición del puerto `BrandsRepository` (`BRANDS_REPOSITORY`).
- `application/` — casos de uso `CreateBrand`, `GetBrand`, `GetBrands`, `UpdateBrand`, `DeleteBrand`. Orquestan la lógica sin estar acoplados a la base de datos o a HTTP. Lanzan errores de dominio como `BrandNotFoundError`.
- `infrastructure/` — `PrismaBrandsRepository` es el único que conoce Prisma. Mapea la fila de la DB de vuelta hacia la interfaz pura de la capa de dominio.
- `presentation/` — controlador REST (`BrandController`) muy delgado. Solo usa Zod para validar (schemas `create-brand.schema.ts` y `update-brand.schema.ts`) y delega el control.

**Traducción de Errores**:
En caso de buscar o intentar actualizar/eliminar un ID inexistente, el caso de uso arroja `BrandNotFoundError`. El filtro global `DomainExceptionFilter` (en `src/shared/filters.ts`) atrapa esta excepción pura y devuelve automáticamente un `404 Not Found` al cliente.

**Tests**: 8 unitarios (`test/unit/modules/brand/`) con repositorio stub tipado.

## 6. Módulo connected-accounts (ConnectedAccounts)

Gestiona la vinculación de cuentas de redes sociales (Facebook, Instagram, LinkedIn, TikTok) pertenecientes a una marca (`Brand`). Punto de extensión para el despacho (n8n): hoy lo consume el claim de dispatch.

```text
POST   /brands/:brandId/accounts            → conecta/actualiza una cuenta en una plataforma (Upsert, 201)
GET    /brands/:brandId/accounts            → lista cuentas conectadas sanitizadas (sin tokens, 200)
POST   /brands/:brandId/accounts/verify     → prueba el token contra la API real sin persistir (200 { valid, displayName }; 400 si el proveedor lo rechaza)
DELETE /brands/:brandId/accounts/:platform  → desvincula la cuenta (204; 404 si no estaba vinculada)
```

Semántica: el dominio usa uniones locales (`AccountPlatform`, `AccountStatus`;
el adaptador mapea en el borde, sin importar enums de `@postly/database`).
Upsert con token ya vencido nace `EXPIRED` (la UI debe pedir re-autenticar).
Desvincular pone `DISCONNECTED` y **borra los tokens**: no se retienen secretos
de una cuenta suelta; repetir sobre una ya desvinculada es 404.

Capas (`src/modules/connected-accounts/`):

- `domain/` — entidad `ConnectedAccount` (segura) y `ConnectedAccountWithCredentials` (con tokens). Puertos `CONNECTED_ACCOUNTS_REPOSITORY` y `ACCOUNT_VERIFIER` (símbolos, sin importar `@postly/database`).
- `application/` — casos de uso puramente funcionales: `UpsertAccountUseCase`, `GetAccountsUseCase`, `DisconnectAccountUseCase`, `VerifyAccountUseCase` (verifica marca + delega al verificador, sin persistir) para consumo externo, y `GetCredentialsUseCase` (expuesto internamente a otros módulos).
- `infrastructure/` — `PrismaConnectedAccountsRepository` que interactúa con Prisma. En el listado aisla y omite los tokens (`accessToken`, `refreshToken`). `HttpAccountVerifier` (fetch nativo, timeout 8s, sin dependencias nuevas) valida contra las APIs oficiales en solo-lectura.
- `presentation/` — controlador REST delgado, delegando peticiones post-validación (con `connectAccountSchema` / `verifyAccountSchema` Zod) a los casos de uso.

**Manejo Interno de Credenciales**:
El caso de uso `GetCredentialsUseCase` está exportado desde `ConnectedAccountsModule` para ser utilizado por `DispatchModule` en el claim de n8n. Si alguna red no está conectada, el caso de uso lanza un `MissingConnectedAccountError`, que el filtro global traduce a 400 Bad Request. Los tokens no son expuestos en las consultas HTTP públicas.

**Cifrado de Credenciales en Reposo**:
Los campos `accessToken` y `refreshToken` se encriptan de forma transparente en la capa de infraestructura (`PrismaConnectedAccountsRepository`) antes de ser guardados en la base de datos de PostgreSQL, garantizando la seguridad en reposo.
- **Algoritmo**: `AES-256-GCM` (provisto de forma nativa por el módulo `node:crypto`).
- **Clave**: Se inyecta mediante la variable de entorno `ENCRYPTION_KEY` administrada por `ConfigService` (64 hex chars; generar con `openssl rand -hex 32`). Si falta, el repositorio falla rápido con `Error` plano (no excepción HTTP). En e2e se fija una de prueba en `vitest.config.e2e.ts`.
- **Formato**: El texto cifrado se almacena con la forma `IV:AuthTag:Ciphertext`.
- **Lectura**: El caso de uso `GetCredentialsUseCase` obtiene y descifra las credenciales al vuelo para entregarlas en el claim de dispatch. El webhook de n8n solo despierta el flujo y no transporta credenciales.

**Verificación previa (`VerifyAccountUseCase` + `HttpAccountVerifier`):**
La UI prueba la conexión antes de guardar para no persistir tokens inválidos.
Solo-lectura, sin publicar nada; el rechazo del proveedor es
`InvalidAccountCredentialsError` → 400.
- **Meta (Facebook/Instagram):** mismo Page access token, IDs distintos —
  Page ID para Facebook (`?fields=id,name`), IG Professional ID vinculado a
  esa Page para Instagram (`?fields=id,username`), ambos en `graph.facebook.com/v25.0`.
- **LinkedIn:** `GET api.linkedin.com/v2/userinfo` (Bearer); valida que el
  token sea válido. El chequeo de pertenencia a la organización queda
  pendiente (requiere `r_organization_social`).
- **TikTok:** `GET open.tiktokapis.com/v2/user/info/` (Bearer).

**Tests**: 12 unitarios (`test/unit/modules/connected-accounts/`) + flujo e2e (`test/connected-accounts.e2e-spec.ts`: conectar → listar sin secretos → desvincular → 404 → 400; verify con token falso → 400 sin persistir).

## 7. Módulo dispatch (superficie n8n)

Cierra el loop que el dashboard deja en `SCHEDULED`: n8n hace poll, reclama,
publica en la(s) red(es) y reporta. Sin persistencia propia — reutiliza puertos
de Publications y credenciales de ConnectedAccounts. Sin estas rutas, lo
programado jamás saldría de `SCHEDULED` (nada mueve ese estado).

```text
POST /api/v1/dispatch/claim               → próxima vencida + credenciales,
                                            marcada PROCESSING (200; siempre
                                            con cuerpo: si no hay nada,
                                            { publication: null, targets: [] };
                                            cada target incluye platform y
                                            format FEED/REEL para ramificar)
POST /api/v1/dispatch/targets/:id/report  → status + externalPostId/Url,
                                            errorMessage (+ metrics opcional);
                                            recalcula PUBLISHED/PARTIAL/FAILED
                                            cuando no quedan PENDING (200)
```

Cada elemento de `targets` llega como `{ target, credentials }`; `target.format`
es la intención persistida (`FEED | REEL`) y `credentials` incluye
`externalAccountId`, `accessToken` y el resto de datos ya descifrados. n8n debe
reportar todos los targets, incluso cuando uno falle.

Superficie versionada por URI (`VersioningType.URI` de Nest): `dispatch` y
`generations/text` llevan `v1`; el resto del API del dashboard sigue sin versión.

Auth máquina-a-máquina: `N8nApiKeyGuard` (header `x-api-key`, comparación
`timingSafeEqual` sobre hashes SHA-256, fail-fast sin la env). Las rutas son
`@Public()` solo para omitir el guard JWT de usuarios — la auth real es la de
servicio. Sin TLS en producción, ni esto basta.

Reglas: el reclamo es atómico (`markProcessing` condicional: si otro worker la
tomó, se intenta con la siguiente); sin nada vencido responde 200 con
`{ publication: null, targets: [] }` (nunca 204): el flujo espera una señal
explícita de "sin trabajo"; sin credenciales para algún canal no se reclama
(400 visible, la pieza queda SCHEDULED para reintento); el reporte con métricas
las registra en la misma llamada.

Lease del reclamo: si n8n reclama y no reporta en 15 min, el siguiente claim
expira la pieza según lo reportado. Sin ningún reporte (murió antes de
publicar, p. ej. antes del IF): vuelve a SCHEDULED y el mismo claim la
re-entrega — reintento automático con ventana de duplicado mínima. Con algo
ya reportado (murió a mitad): destinos sin reportar → FAILED ("despacho
vencido…"), publicación → FAILED/PARTIAL y sin reintento — duplicar un post
es peor que perderlo.

Disparo inmediato ("publicar ahora"): `POST /api/publications/:id/publish-now`
(admin, sin body) reutiliza la aprobación con `scheduledAt = now` y hace un
POST al webhook de n8n (`N8N_DISPATCH_WEBHOOK_URL`, header `x-webhook-secret`
= `INTERNAL_WEBHOOK_SECRET`, sin body, timeout 5 s) para despertar al worker.
n8n sigue haciendo el claim normal: el webhook no transporta la publicación
(evita saltarse el lease y duplicar posts). Si el webhook falla, el endpoint
igual responde 202: la pieza queda SCHEDULED vencida y el cron la levanta; el
webhook acelera, el cron es la garantía. El cron (5 min) debe seguir también
para el barrido perezoso de leases vencidos.

## 8. Módulo analytics (solo lectura)

Agregados para la pestaña Analytics del dashboard. Sin persistencia propia:
reutiliza los puertos exportados por Publications.

```text
GET /analytics/summary?brandId= → { totalPublications, byStatus,
  totalImpressions, totalInteractions, engagementRate, byPlatform[] }
```

Regla CLAVE: por destino solo cuenta su snapshot más reciente (sumar el
historial duplicaría impresiones); sin impresiones el engagement es 0
(nunca división por cero).

## 9. Módulo generation (Gemini, solo texto)

Genera ideas y copy con el contexto de una marca **sin persistir nada**: no
crea `Publication`, no escribe en la base de datos (solo lee `Brand`), no toca
storage, fal.ai ni n8n. La respuesta se usa para prellenar el formulario; el
flujo normal de creación de borrador sigue intacto.

```text
POST /api/v1/generations/text
body: {
  brandId,
  mode: IDEAS | COPY | IMPROVE,
  prompt?, platform?, format?, mediaType?,
  excludeIdeas?, currentCopy?, feedback?
}
response: { model, tokensUsed, ideas[], variants[] }
```

Reglas de entrada: `prompt` es obligatorio en `IDEAS` y `COPY`;
`currentCopy` es obligatorio en `IMPROVE`; `excludeIdeas` (máximo 30) se usa
para que "Más ideas" no repita tarjetas; `brandId` inexistente → 404.

- `IDEAS`: 3 tarjetas con `title`, `angle`, `hook`, `whyItWorks` y
  `suggestedFormat`.
- `COPY` / `IMPROVE`: 3 variantes con `copy`, `hashtags`, `cta`,
  `mediaPrompt` y `altText`.
- El prompt de sistema se arma con `Brand.name`, `aiTone`, `aiBrandVoice`,
  `aiTargetAudience` y `defaultHashtags` (`application/build-brand-prompt.ts`);
  los datos de marca son contexto, no instrucciones. Las instrucciones se
  escriben en inglés, pero una regla explícita obliga a redactar todos los
  valores visibles para el usuario en español neutro latinoamericano; las claves
  JSON permanecen en inglés.
- Gemini se llama con `responseMimeType=application/json` y un
  `responseSchema` por modo; la respuesta se valida con Zod y se rechaza si no
  cumple.
- El panel conserva el `model` real de cada variante (incluido el fallback); al
  crear el borrador lo envía como `modelText` en `POST /publications`. Si el
  texto se escribe manualmente, la BD guarda `"manual"` en vez de atribuirlo a
  un modelo.
- Modelo primario `gemini-3.8-flash`; si responde 404/429/5xx o una
  respuesta inválida reintentable, se reintenta una vez con
  `gemini-3.5-flash-lite`. `thinkingLevel=low`, timeout 20 s y máximo
  4096 tokens de salida. La API key viaja en `x-goog-api-key`, nunca en query.
- Errores estructurados: el filtro responde
  `{ statusCode, code, provider, model?, message, retryable }` y el frontend usa
  `retryable` para mostrar u ocultar el botón **Reintentar**. Códigos:
  - No reintentables: `GEMINI_NOT_CONFIGURED`, `GEMINI_AUTH_FAILED` y
    `GEMINI_MODEL_NOT_FOUND` (503); `GEMINI_SAFETY_BLOCKED` (422).
  - Reintentables: `GEMINI_QUOTA_EXCEEDED` (429); `GEMINI_OVERLOADED`,
    `GEMINI_UNAVAILABLE`, `GEMINI_UNREACHABLE` y `GEMINI_UNKNOWN` (503);
    `GEMINI_UPSTREAM_ERROR` e `GEMINI_INVALID_RESPONSE` (502); `GEMINI_TIMEOUT`
    (504).
  - Validación Zod → 400, marca inexistente → 404, sin sesión → 401.
  - Los mensajes son seguros para el usuario; el detalle técnico de Gemini se
    registra en el log del servidor, nunca se devuelve tal cual.

Ejemplo de respuesta:

```json
{
  "statusCode": 429,
  "code": "GEMINI_QUOTA_EXCEEDED",
  "provider": "GEMINI",
  "model": "gemini-3.5-flash-lite",
  "message": "Gemini alcanzó su límite de uso o cuota. Espera unos minutos y vuelve a intentarlo.",
  "retryable": true
}
```

Límite de esta fase: `Publication.mediaUrl` es obligatorio, así que la media se
sigue agregando manualmente en el formulario. La fase 2 (modo agente: fal.ai +
**Cloudflare R2** como `MediaStorage`) prellenará el `DRAFT` con la media
generada.

Nota de privacidad: en el free tier de Gemini, Google puede usar el contenido
enviado para mejorar sus productos. Para demos/tests usar datos sintéticos y no
pegar información confidencial de la empresa.

## 10. Tests y comandos

- Unitarios en `test/unit/` como espejo de `src/` (nunca `.spec` junto al código);
  casos de uso con puertos stub tipados, sin DB. E2E en `test/*.e2e-spec.ts`
  (requieren `docker compose up -d`; secretos de prueba en `vitest.config.e2e.ts`).
- Generación de texto: 19 unitarios en `test/unit/modules/generation/` (prompt,
  parser, caso de uso y adaptador Gemini con `fetch` mockeado) + e2e en
  `test/generation.e2e-spec.ts` (stub del puerto LLM: auth, `v1`, validación Zod,
  errores reintentables/no reintentables y verificación de que no se crean
  publicaciones).

```bash
pnpm --filter api run start:dev     # backend en watch
pnpm --filter api run test          # vitest unit
pnpm --filter api run test:e2e      # e2e (DB levantada)
pnpm --filter api run check-types   # tsc --noEmit
pnpm --filter api run lint          # oxlint src/ test/
```
