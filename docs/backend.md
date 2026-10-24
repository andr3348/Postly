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
   sin SDK de Gemini. Con el modo agente, `FAL_*` y `R2_*` también viven solo
   en el backend (`fetch` para fal.ai y `@aws-sdk/client-s3` para R2).

## 4. Módulo publications (human-in-the-loop)

Máquina de estados (transiciones permitidas en `domain/publication.entity.ts`
via `canTransition`; n8n mueve `SCHEDULED → PROCESSING → PUBLISHED/PARTIAL/FAILED`):

```text
POST   /publications            → crea DRAFT (verifica la marca: 404 si no existe)
GET    /publications?brandId=&status= → bandeja (usa índice [brandId, status])
GET    /publications/:id        → detalle (404 si no existe)
PATCH  /publications/:id        → edita title/copy/media solo en DRAFT (dueño o admin)
POST   /publications/:id/submit → DRAFT → PENDING_APPROVAL (dueño o admin)
POST   /publications/:id/approve→ PENDING_APPROVAL → SCHEDULED, solo ADMIN
                                   (body { scheduledAt }; exige ≥1 canal; fija
                                   approvedBy/approvedAt)
POST   /publications/:id/publish-now → PENDING_APPROVAL → SCHEDULED con
                                   scheduledAt=now y despierta a n8n (202; solo ADMIN)
POST   /publications/:id/retry → PARTIAL/FAILED → SCHEDULED solo con los
                                   targets fallidos elegidos (202; solo ADMIN)
POST   /publications/:id/reject → PENDING_APPROVAL → DRAFT, solo ADMIN
```

Autorización en los casos de uso (no en guards): el `requester` (`id` + `rol`
del `@CurrentUser()`) viaja al caso de uso; dueño-or-admin para editar/enviar,
solo-ADMIN para aprobar/publicar-ahora/rechazar/reintentar. Errores:
`PublicationNotFoundError` → 404, `InvalidPublicationTransitionError` → 400,
`PublicationWithoutTargetsError` → 400 (submit o aprobar sin canales),
`ForbiddenError` → 403, `PublicationRetryNotAllowedError` y
`RetryLimitExceededError` → 409.

`title` es opcional (Text, máximo 200 en la validación Zod; cadena vacía o
`null` lo limpian). Es encabezado del dashboard: las redes destino no tienen
parámetro de título, así que el claim entrega la `caption` de cada target ya
fusionada con `composeCaption` (título + descripción; ver §7). En la UI `copy`
se muestra como «Descripción».

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
`externalPostId/Url`, `errorMessage`, `failure`, `publishedAt` en éxito) y
escribe `TargetMetric`.

**Fallos y reintento por destino:** cada `PublicationTarget` guarda `failure`
(JSON tipado: `kind`, `stage`, `retryable`, `requiresAction`, códigos de Meta,
mensaje, acción y trace id) y `retryCount`. El clasificador vive en
`domain/target-failure.ts` y aplica precedencia subcódigo → código →
HTTP/`is_transient`. Un timeout/5xx en `PUBLISH` sin código del proveedor es
`UNKNOWN_OUTCOME` y nunca se ofrece reintento; un 4xx desconocido es rechazo
seguro y sí puede reintentarse. Los fallos históricos sin `failure` se
clasifican al leer con etapa conservadora `PUBLISH`.

`POST /publications/:id/retry` (ADMIN, body `{ platforms }`, solo
`FACEBOOK | INSTAGRAM`) revalida bajo lock, exige `PARTIAL/FAILED`, fallo
`retryable`, menos de 3 intentos y que el target siga `FAILED`. Reinicia solo
esos targets a `PENDING`, incrementa `retryCount`, deja la publicación
`SCHEDULED`, limpia `dispatchAttemptId` y conserva `approvedBy/approvedAt` (no
hay re-aprobación). Después despierta a n8n; si el webhook falla, el cron de 1
minuto la levanta. Los targets `SUCCESS` no se tocan.

**Transacciones de despacho:** `PublicationUnitOfWork` abre una transacción
Prisma y bloquea la fila de la publicación (`SELECT ... FOR UPDATE`). Reporte,
cierre terminal, watchdog y reintento comparten ese lock. Así dos reportes
concurrentes (Facebook e Instagram) no dejan la publicación atascada en
`PROCESSING`: el primero ve al otro `PENDING`, el segundo cierra el estado
terminal. El reporte valida `dispatchAttemptId`; uno viejo → 409
(`StaleDispatchAttemptError`).

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
POST   /brands/:brandId/accounts            → conecta/actualiza una cuenta con token manual (Upsert, 201)
GET    /brands/:brandId/accounts            → lista cuentas conectadas sanitizadas (sin tokens, 200)
POST   /brands/:brandId/accounts/verify     → prueba el token contra la API real sin persistir (200 { valid, displayName }; 400 si el proveedor lo rechaza)
DELETE /brands/:brandId/accounts/:platform  → desvincula la cuenta (204; 404 si no estaba vinculada)
POST   /brands/:brandId/accounts/instagram/from-facebook → conecta Instagram reutilizando el Page token guardado de Facebook (201)
```

Endpoints del OAuth de Meta (solo Facebook Pages; Instagram depende de Facebook):

```text
GET  /brands/:brandId/accounts/meta/oauth/start                     → URL del diálogo de Facebook Login for Business (200 { authorizationUrl })
GET  /connected-accounts/meta/oauth/callback                        → callback público de Meta; siempre 302 al dashboard
GET  /brands/:brandId/accounts/meta/oauth/sessions/:sessionId       → estado de la sesión y páginas elegibles (sin Page tokens)
POST /brands/:brandId/accounts/meta/oauth/sessions/:sessionId/complete → persiste la página elegida y completa la sesión (201)
```

Semántica: el dominio usa uniones locales (`AccountPlatform`, `AccountStatus`,
`AccountAuthType`; el adaptador mapea en el borde, sin importar enums de
`@postly/database`). Cada cuenta guarda `authType` (`MANUAL` default |
`META_OAUTH`) y `metaPageId`: en FACEBOOK coincide con `externalAccountId`; en
INSTAGRAM apunta a la Page que presta el token.
Upsert con token ya vencido nace `EXPIRED` (la UI debe pedir re-autenticar).
Desvincular pone `DISCONNECTED` y **borra los tokens**: no se retienen secretos
de una cuenta suelta; repetir sobre una ya desvinculada es 404. Al desvincular
Facebook también se desvincula Instagram (regla de dependencia confirmada).

**OAuth de Meta (Facebook Login for Business)**:

- Flujo: `start` genera un `state` aleatorio (32 bytes) y guarda solo su
  SHA-256 en `MetaOAuthSession` (TTL 10 minutos); el navegador sale a
  `facebook.com`. El callback (público, sin JWT: el access token dura 15
  minutos) valida y consume el state una sola vez, intercambia el `code` por
  un token de usuario de larga duración y lista las Pages con
  `instagram_business_account{id,username}`. El payload con Page tokens se
  guarda **cifrado** (misma `ENCRYPTION_KEY`) y se borra al completar o
  fallar. El dashboard consulta la sesión (`READY`) y muestra el selector de
  página; `complete` verifica el Page token con `debug_token` y persiste
  FACEBOOK como `META_OAUTH`.
- Instagram no inicia OAuth propio: `instagram/from-facebook` lee el
  `instagram_business_account` de la Page guardada y persiste INSTAGRAM con el
  mismo Page token y `metaPageId`. Sin página vinculada en Meta responde 400
  `META_INSTAGRAM_NOT_LINKED`; nunca asume el vínculo.
- Consistencia: si la marca ya tiene Instagram conectado y se intenta guardar
  otra página (o la página ya no expone la misma cuenta IG), responde 409
  `META_PAGE_MISMATCH` y exige desconectar Instagram primero. Reconectar la
  misma Page sincroniza el token de Facebook **e** Instagram.
- Si Graph rechaza el token compartido (código 190/102), ambas cuentas quedan
  `EXPIRED` conservando tokens, para que la UI pida reconectar Facebook.
- Errores del flujo: `MetaOAuthError` lleva `code` y `httpStatus` propios; el
  filtro global los serializa con `{ statusCode, code, message }`. La tabla de
  **Errores del flujo y qué hacer** lista todos los códigos y su acción.
- Configuración: ver **Conexión con una cuenta real** más abajo. Si faltan
  `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI` o `WEB_APP_URL`,
  el API arranca y los endpoints responden 503 `META_OAUTH_NOT_CONFIGURED`
  (no se tumba el resto del API).

**Conexión con una cuenta real (checklist operativo)**

La implementación está completa; para una cuenta que no sea de prueba hace
falta preparar la app de Meta. Antes de conectar:

1. Crear una app **Business** en `developers.facebook.com` y agregar
   **Facebook Login for Business** e **Instagram** (Instagram API with
   Facebook Login). El flujo usa Pages y Page tokens; una configuración de
   *System user* no aplica.
2. Copiar **App ID** y **App Secret** (*App settings → Basic*) a
   `META_APP_ID`/`META_APP_SECRET`. El secret solo lo usa el backend (cambio
   de `code` y `debug_token`); nunca debe llegar al navegador.
3. Registrar el redirect **exacto** en *Facebook Login for Business →
   Settings → Valid OAuth Redirect URIs* y en `META_OAUTH_REDIRECT_URI`. El
   callback es `https://<api>/api/connected-accounts/meta/oauth/callback`.
   En Live Meta exige **HTTPS**; `localhost` solo funciona en Development.
4. Poner la app en **Live** para cuentas sin rol Admin/Developer/Tester. Para
   usuarios externos se necesita **Business Verification** y **Advanced
   Access** (App Review) de los permisos de Pages e Instagram. En
   Development solo autorizan las cuentas con rol en la app.
5. Completar *App Domains*, sitio web, política de privacidad y eliminación de
   datos; Meta bloquea el modo Live si faltan.
6. (Recomendado) Crear una configuración de Facebook Login for Business de
   tipo **User access token** (no System user) con las Pages/IG y los permisos
   del punto 4, y guardar su ID en `META_OAUTH_CONFIG_ID`. Con `config_id` el
   diálogo envía `response_type=code` + `override_default_response_type=true`
   y **no** envía `scope`. Sin `config_id` se usa `META_OAUTH_SCOPES`.
7. Verificar Page e Instagram: el usuario necesita tareas
   `MANAGE`/`CREATE_CONTENT` (o `PROFILE_PLUS_*`) en la Page, y la cuenta IG
   debe ser profesional y estar vinculada a esa Page. Si el rol viene de
   Business Manager, Meta exige además `ads_read` o `ads_management` para
   publicar en Instagram. PPA (*Page Publishing Authorization*) y 2FA pueden
   bloquear la publicación aunque el token sea válido.

| Variable | Obligatoria | Detalle |
| --- | --- | --- |
| `META_APP_ID` | Sí | App Business de Meta. |
| `META_APP_SECRET` | Sí | Solo backend; no se registra ni se envía al frontend. |
| `META_OAUTH_REDIRECT_URI` | Sí | Igual al panel de Meta, carácter por carácter; HTTPS en Live. |
| `WEB_APP_URL` | Sí | URL absoluta del dashboard; destino del 302 del callback. |
| `META_OAUTH_CONFIG_ID` | No | Configuración *User access token*; si existe, define permisos/activos y se ignora `META_OAUTH_SCOPES`. |
| `META_OAUTH_SCOPES` | No | Default: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`. |
| `META_GRAPH_VERSION` | No | Default `v25.0`. `v26.0` es la última (jul. 2026); `v25.0` sigue soportada hasta 2028-07-29. |

**Estados y tiempos de la sesión**

`PENDING` (creada por `start`) → `READY` (el callback obtuvo páginas) o
`FAILED` (cancelación o error de Graph); `COMPLETED` al guardar la Page. El TTL
es de **10 minutos desde `start`** y no se extiende. `start` invalida las
sesiones activas anteriores del mismo usuario/marca. El callback es público y
siempre responde 302: con `meta_session`/`meta_brand` para que la UI consulte
el estado, o `meta_error=invalid_state|expired` si el state no existe. El state
se consume **antes** del intercambio; un fallo de red posterior obliga a
iniciar el flujo de nuevo. `complete` revalida marca/usuario/TTL, exige
`READY`, busca la Page en el payload, verifica el token con `debug_token` y
persiste Facebook (sincronizando Instagram solo si es la misma cuenta ya
conectada).

**Errores del flujo y qué hacer**

| Código | HTTP | Causa típica | Acción |
| --- | --- | --- | --- |
| `META_OAUTH_NOT_CONFIGURED` | 503 | Faltan envs obligatorias | Completar `.env` y reiniciar el API. |
| `META_OAUTH_INVALID_STATE` | 400 | La sesión no está `READY` o el state no es válido | Reiniciar la conexión desde Facebook. |
| `META_OAUTH_SESSION_NOT_FOUND` | 404 | Sesión de otra marca/usuario o eliminada | Iniciar el flujo con el usuario correcto. |
| `META_OAUTH_EXPIRED` | 400 | Pasaron más de 10 minutos o el callback llegó tarde | Volver a conectar. |
| `META_OAUTH_EXCHANGE_FAILED` | 400 | `code` vencido, redirect URI distinto o app mal configurada | Revisar redirect URI y modo de la app; reintentar. |
| `META_OAUTH_DENIED` | 400 | El usuario canceló el diálogo | Reintentar y aceptar todos los permisos. |
| `META_NO_PAGES` | 400 | La cuenta no administra ninguna Page | Crear/pedir acceso a una Page o revisar tareas. |
| `META_PAGE_NOT_FOUND` | 400 | La Page ya no está en el payload | Reiniciar la conexión. |
| `META_TOKEN_EXPIRED` | 400 | `debug_token` inválido o Graph 190/102 | Reconectar Facebook. |
| `META_FACEBOOK_NOT_CONNECTED` | 409 | Se intentó conectar IG sin Facebook | Conectar Facebook primero. |
| `META_PAGE_MISMATCH` | 409 | Instagram ya está vinculado a otra Page | Desconectar Instagram antes de cambiar de Page. |
| `META_INSTAGRAM_NOT_LINKED` | 400 | La Page no expone una cuenta IG profesional | Vincularla en Instagram o Meta Business Suite. |
| `META_GRAPH_ERROR` | 400/502 | Error de Meta o de red | Revisar el estado de Meta y reintentar. |

**Límites y comportamientos conocidos**

- `GET /me/accounts` se pide con `limit=200` y sin paginación: una cuenta con
  más de 200 Pages no verá las restantes. Si hiciera falta, habría que seguir
  `paging.next`.
- Los Page tokens derivados de un user token de larga duración suelen no
  vencer (`debug_token` devuelve `expires_at: 0` → `expiresAt: null`), pero
  pueden invalidarse si el usuario cambia la contraseña, revoca la app o
  pierde el rol. Ante 190/102, Facebook e Instagram quedan `EXPIRED`. No hay
  refresh token: la renovación es reconectar por OAuth.
- `appsecret_proof` no está implementado. Si se activa **Require App Secret**
  en Meta, las llamadas del API y de n8n fallarán; dejarlo desactivado o
  implementar la firma (HMAC-SHA256 del token con el App Secret) antes de
  activarlo.
- `META_GRAPH_VERSION` aplica al cliente OAuth; `HttpAccountVerifier` (token
  manual) sigue fijado a `v25.0`. Al subir la versión conviene alinear ambos.
- El flujo solo obtiene y guarda tokens; publicar es responsabilidad de n8n
  con el Page token del claim.

Capas (`src/modules/connected-accounts/`):

- `domain/` — entidad `ConnectedAccount` (segura) y `ConnectedAccountWithCredentials` (con tokens); tipos del OAuth de Meta (`MetaOAuthSession`, `MetaPageAsset`). Puertos `CONNECTED_ACCOUNTS_REPOSITORY`, `ACCOUNT_VERIFIER`, `META_OAUTH_CLIENT` y `META_OAUTH_SESSIONS_REPOSITORY` (símbolos, sin importar `@postly/database`).
- `application/` — casos de uso puramente funcionales: `UpsertAccountUseCase`, `GetAccountsUseCase`, `DisconnectAccountUseCase`, `VerifyAccountUseCase` (verifica marca + delega al verificador, sin persistir), `GetCredentialsUseCase` (expuesto internamente a otros módulos) y el flujo Meta: `StartMetaOAuthUseCase`, `HandleMetaOAuthCallbackUseCase`, `GetMetaOAuthSessionUseCase`, `CompleteMetaOAuthUseCase` y `ConnectInstagramFromFacebookUseCase`.
- `infrastructure/` — `PrismaConnectedAccountsRepository` que interactúa con Prisma (incluye la transacción de alta de Page + sincronía de IG y la cascada de desconexión). `PrismaMetaOAuthSessionsRepository` cifra/descifra el payload de páginas. `HttpAccountVerifier` (fetch nativo, timeout 8s, sin dependencias nuevas) valida contra las APIs oficiales en solo-lectura. `MetaGraphOAuthClient` encapsula el diálogo, el intercambio de `code` y `debug_token`; `meta-oauth.options.ts` resuelve la configuración (o `null` → 503).
- `presentation/` — controladores REST delgados (`ConnectedAccountsController`, `MetaOAuthController`, `MetaOAuthCallbackController`), delegando peticiones post-validación (Zod) a los casos de uso. El callback es `@Public()` y responde 302.

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

**Tests**: 37 unitarios (`test/unit/modules/connected-accounts/`: 12 previos + 25 del OAuth de Meta) y dos flujos e2e: `test/connected-accounts.e2e-spec.ts` (conectar → listar sin secretos → desvincular → 404 → 400; verify con token falso → 400 sin persistir) y `test/meta-oauth.e2e-spec.ts` con cliente de Meta falso (start → callback 302 → sesión sin tokens → completar página → conectar IG desde Facebook → cascada de desconexión → 409 sin Facebook → 400 sin IG vinculado; verifica cifrado en reposo y no reuso del state).

## 7. Módulo dispatch (superficie n8n)

Cierra el loop que el dashboard deja en `SCHEDULED`: n8n hace poll, reclama,
publica en la(s) red(es) y reporta. Sin persistencia propia — reutiliza puertos
de Publications y credenciales de ConnectedAccounts. Sin estas rutas, lo
programado jamás saldría de `SCHEDULED` (nada mueve ese estado).

```text
POST /api/v1/dispatch/claim               → próxima vencida + credenciales,
                                            marcada PROCESSING con
                                            dispatchAttemptId (200; siempre
                                            con cuerpo: si no hay nada,
                                            { publication: null, targets: [] };
                                            cada target incluye platform,
                                            format FEED/REEL, caption lista
                                            para publicar y failure/retryCount)
POST /api/v1/dispatch/targets/:id/report  → dispatchAttemptId + status + stage
                                            + externalPostId/Url o errorMessage/
                                            error (+ metrics opcional);
                                            recalcula PUBLISHED/PARTIAL/FAILED
                                            cuando no quedan PENDING (200; 409
                                            si el intento es viejo o el target
                                            ya se reportó con otro estado)
```

Cada elemento de `targets` llega como `{ target, credentials, caption }`;
`target.format` es la intención persistida (`FEED | REEL`), `credentials`
incluye `externalAccountId`, `accessToken` y el resto de datos ya descifrados,
y `caption` es el argumento único de texto que esperan las APIs actuales
(`caption` de foto en Facebook/Instagram, `description` de video en Facebook):
`composeCaption` (`publications/domain/caption.ts`) fusiona `title` + `copy`
con una línea en blanco y sin título devuelve `copy` intacto — así n8n elige
la rama y publica, pero no compone texto. n8n debe reportar todos los targets,
incluso cuando uno falle. El `dispatchAttemptId` del claim es obligatorio en
cada reporte: un reporte del intento anterior no puede cerrar ni reabrir la
publicación.

Superficie versionada por URI (`VersioningType.URI` de Nest): `dispatch` y
`generations/text` llevan `v1`; el resto del API del dashboard sigue sin versión.

Auth máquina-a-máquina: `N8nApiKeyGuard` (header `x-api-key`, comparación
`timingSafeEqual` sobre hashes SHA-256, fail-fast sin la env). Las rutas son
`@Public()` solo para omitir el guard JWT de usuarios — la auth real es la de
servicio. Sin TLS en producción, ni esto basta.

Reglas: el reclamo es atómico (`markProcessing` condicional con intento nuevo:
si otro worker la tomó, se intenta con la siguiente); sin nada vencido responde
200 con `{ publication: null, targets: [] }` (nunca 204): el flujo espera una
señal explícita de "sin trabajo"; sin credenciales para algún canal no se
reclama (400 visible, la pieza queda SCHEDULED para reintento); el reporte con
métricas las registra en la misma transacción.

Lease del reclamo: si n8n reclama y no reporta en 15 min, el siguiente claim
expira la pieza según lo reportado. Sin ningún reporte (murió antes de
publicar, p. ej. antes del IF): vuelve a SCHEDULED, limpia el intento y el mismo
claim la re-entrega — reintento automático con ventana de duplicado mínima. Con
algo ya reportado (murió a mitad): destinos sin reportar → FAILED
(`UNKNOWN_OUTCOME`, "despacho vencido…"), publicación → FAILED/PARTIAL y sin
reintento — duplicar un post es peor que perderlo.

Disparo inmediato ("publicar ahora"): `POST /api/publications/:id/publish-now`
(admin, sin body) reutiliza la aprobación con `scheduledAt = now` y hace un
POST al webhook de n8n (`N8N_DISPATCH_WEBHOOK_URL`, header `x-webhook-secret`
= `INTERNAL_WEBHOOK_SECRET`, sin body, timeout 5 s) para despertar al worker.
n8n sigue haciendo el claim normal: el webhook no transporta la publicación
(evita saltarse el lease y duplicar posts). Si el webhook falla, el endpoint
igual responde 202: la pieza queda SCHEDULED vencida y el cron la levanta; el
webhook acelera, el cron es la garantía. El cron (1 min) debe seguir también
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

## 9. Módulo generation (Gemini + modo agente fal.ai/R2)

Tiene dos superficies: `text` genera ideas y copy con el contexto de una marca
**sin persistir nada** (no crea `Publication`, solo lee `Brand`; la respuesta
prellena el formulario) y `agent` orquesta texto → media → almacenamiento
propio → borrador persistido.

### 9.1 Texto (stateless)

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
- `COPY` / `IMPROVE`: 3 variantes con `title`, `copy`, `hashtags`, `cta`,
  `mediaPrompt` y `altText`. El `title` (≤200) prellena el título del borrador
  y es el que usa el modo agente.
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

### 9.2 Modo agente (fal.ai + Cloudflare R2)

Un solo request del frontend resuelve todo el flujo; la orquestación vive en el
backend (no en n8n) y termina con el borrador ya guardado:

```text
POST /api/v1/generations/agent
body: { brandId, prompt, platform, format, mediaType? }
response 201: Publication (DRAFT)   // mismo formato que POST /publications
```

Reglas de entrada: `prompt`, `platform` y `format` son obligatorios; `REEL`
solo aplica a Facebook/Instagram (Zod → 400); `mediaType` default
`REEL → VIDEO`, `FEED → IMAGE` (el selector del panel puede forzar `VIDEO` en
`FEED`).

Etapas dentro del mismo request:

1. **Texto**: reusa `GenerateTextUseCase` en modo `COPY` (misma marca,
   contexto y validación Zod). Se toma la variante 0 con su `title`,
   `tokensUsed` y `model`.
2. **Media**: `MediaGenerator` (`FalMediaGenerator`) llama a la API de cola de
   fal.ai (`queue.fal.run`): encola, consulta el estado con
   `FAL_POLL_INTERVAL_MS` hasta `COMPLETED` y recién ahí lee el resultado. El
   prompt es el `mediaPrompt` de la variante (o el copy si viene vacío);
   `REEL` → video `9:16`, `FEED` → imagen `1:1`. Defaults:
   `FAL_IMAGE_MODEL=fal-ai/flux/schnell` y `FAL_VIDEO_MODEL` (Kling
   text-to-video).
3. **Storage**: `MediaStorage` (`R2MediaStorage`) descarga la URL temporal de
   fal.ai y la sube a R2 con `@aws-sdk/client-s3` bajo
   `publications/{uuid}.{ext}`, devolviendo la URL pública
   (`R2_PUBLIC_BASE_URL`) que queda en `Publication.mediaUrl`.
4. **Alta**: `CreatePublicationUseCase` crea el `DRAFT` con `title`, copy +
   hashtags (misma regla que el panel: texto, línea en blanco, hashtags
   normalizados con `#`), `mediaUrl`, `mediaType`, `modelText`, `modelMedia`
   (id real del modelo de fal) y `tokensUsed`.

El borrador lo crea el backend dentro del mismo request (auto-guardado
server-side) para que un refresh o cierre de pestaña no pierda la media ya
generada y cobrada. El frontend navega a la edición del borrador creado.

Variables de entorno (solo backend, nunca llegan al navegador):

- fal.ai: `FAL_KEY`, `FAL_IMAGE_MODEL`, `FAL_VIDEO_MODEL`,
  `FAL_POLL_INTERVAL_MS` (2000) y `FAL_TIMEOUT_MS` (240000).
- R2: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET` y `R2_PUBLIC_BASE_URL` (bucket público de solo lectura).

Sin credenciales no se llama a la red y responde 503 estructurado:
`FAL_NOT_CONFIGURED` (falta `FAL_KEY`) o `R2_NOT_CONFIGURED` (faltan `R2_*`),
en ambos casos sin crear nada y con `retryable: false`.

Códigos propios del agente (mismo formato que los de Gemini):

- fal.ai: no reintentables `FAL_NOT_CONFIGURED`, `FAL_AUTH_FAILED` y
  `FAL_MODEL_NOT_FOUND` (503), `FAL_REJECTED` (422, job fallido: contenido no
  permitido). Reintentables: `FAL_QUOTA_EXCEEDED` (429); `FAL_OVERLOADED`,
  `FAL_UNREACHABLE` y `FAL_UNKNOWN` (503); `FAL_UPSTREAM_ERROR` y
  `FAL_INVALID_RESPONSE` (502); `FAL_TIMEOUT` (504).
- Storage: `MEDIA_DOWNLOAD_FAILED` (provider `FAL`, reintentable),
  `R2_UPLOAD_FAILED` (reintentable) y `R2_NOT_CONFIGURED` (no reintentable),
  todos 503.

Límites conocidos: el video tarda minutos (la cola evita sockets abiertos); si
el servidor se reinicia a mitad de la generación, el job de fal queda huérfano
(mejora pendiente: persistir el `request_id`); el modo agente siempre crea un
borrador nuevo (regenerar media sobre un borrador existente queda fuera de
alcance). Los payloads por defecto (FLUX/Kling) son best-effort y se ajustan al
probar con una `FAL_KEY` real.

Nota de privacidad: en el free tier de Gemini, Google puede usar el contenido
enviado para mejorar sus productos. Para demos/tests usar datos sintéticos y no
pegar información confidencial de la empresa.

## 10. Tests y comandos

- Unitarios en `test/unit/` como espejo de `src/` (nunca `.spec` junto al código);
  casos de uso con puertos stub tipados, sin DB. E2E en `test/*.e2e-spec.ts`
  (requieren `docker compose up -d`; secretos de prueba en `vitest.config.e2e.ts`).
- Generación: 38 unitarios en `test/unit/modules/generation/` (prompt, parser,
  casos de uso de texto y del agente, copy + hashtags, adaptadores fal.ai y R2
  con `fetch` y cliente S3 mockeados) + e2e en
  `test/generation.e2e-spec.ts` (stubs de LLM, media y storage: auth, `v1`,
  validación Zod, errores reintentables/no reintentables, que `text` no crea
  publicaciones y que `agent` crea el DRAFT con auditoría).

```bash
pnpm --filter api run start:dev     # backend en watch
pnpm --filter api run test          # vitest unit
pnpm --filter api run test:e2e      # e2e (DB levantada)
pnpm --filter api run check-types   # tsc --noEmit
pnpm --filter api run lint          # oxlint src/ test/
```
