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

## 4. Módulo publications (human-in-the-loop)

Máquina de estados (transiciones permitidas en `domain/publication.entity.ts`
via `canTransition`; n8n moverá `SCHEDULED → PROCESSING → PUBLISHED/PARTIAL/FAILED`):

```text
POST   /publications            → crea DRAFT (verifica la marca: 404 si no existe)
GET    /publications?brandId=&status= → bandeja (usa índice [brandId, status])
GET    /publications/:id        → detalle (404 si no existe)
PATCH  /publications/:id        → edita copy/media solo en DRAFT (dueño o admin)
POST   /publications/:id/submit → DRAFT → PENDING_APPROVAL (dueño o admin)
POST   /publications/:id/approve→ PENDING_APPROVAL → SCHEDULED, solo ADMIN
                                   (body { scheduledAt }; fija approvedBy/approvedAt)
POST   /publications/:id/reject → PENDING_APPROVAL → DRAFT, solo ADMIN
```

Autorización en los casos de uso (no en guards): el `requester` (`id` + `rol`
del `@CurrentUser()`) viaja al caso de uso; dueño-or-admin para editar/enviar,
solo-ADMIN para aprobar/rechazar. Errores: `PublicationNotFoundError` → 404,
`InvalidPublicationTransitionError` → 400, `ForbiddenError` → 403.

**Destinos omnicanal (sin módulo propio):** la publicación decide *qué*,
el target *dónde*. Anidados bajo la publicación (dueño o admin, solo antes de
programar):

```text
GET    /publications/:id/targets              → canales con su estado
POST   /publications/:id/targets { platform } → adjunta canal (409 si duplica)
DELETE /publications/:id/targets/:platform    → quita canal (404 si no existe)
```

Regla: `submit` exige ≥1 canal (`PublicationWithoutTargetsError` → 400). La
unicidad `[publicationId, platform]` la garantiza la BD; el caso de uso la
verifica antes para un 409 limpio. A futuro n8n actualizará cada target
(`status`, `externalPostId/Url`, `errorMessage`) y escribirá `TargetMetric`.**

## 5. Módulo brand (Gestión de Marcas)

Siguiendo el patrón Clean Architecture ya establecido, el módulo de **Brand** expone el CRUD básico de las marcas conectadas a la aplicación.

```text
POST   /brands         → crea una nueva marca (valida con Zod, 201)
GET    /brands         → lista completa de marcas ordenadas por fecha descendente
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

Gestiona la vinculación de cuentas de redes sociales (Facebook, Instagram, LinkedIn, TikTok) pertenecientes a una marca (`Brand`). Punto de extensión para el despacho (n8n): hoy ningún consumidor lo usa todavía.

```text
POST   /brands/:brandId/accounts            → conecta/actualiza una cuenta en una plataforma (Upsert, 201)
GET    /brands/:brandId/accounts            → lista cuentas conectadas sanitizadas (sin tokens, 200)
DELETE /brands/:brandId/accounts/:platform  → desvincula la cuenta (204; 404 si no estaba vinculada)
```

Semántica: el dominio usa uniones locales (`AccountPlatform`, `AccountStatus`;
el adaptador mapea en el borde, sin importar enums de `@postly/database`).
Upsert con token ya vencido nace `EXPIRED` (la UI debe pedir re-autenticar).
Desvincular pone `DISCONNECTED` y **borra los tokens**: no se retienen secretos
de una cuenta suelta; repetir sobre una ya desvinculada es 404.

Capas (`src/modules/connected-accounts/`):

- `domain/` — entidad `ConnectedAccount` (segura) y `ConnectedAccountWithCredentials` (con tokens). Puerto `CONNECTED_ACCOUNTS_REPOSITORY`.
- `application/` — casos de uso puramente funcionales: `UpsertAccountUseCase`, `GetAccountsUseCase`, `DisconnectAccountUseCase` para consumo externo, y `GetCredentialsUseCase` (expuesto internamente a otros módulos).
- `infrastructure/` — `PrismaConnectedAccountsRepository` que interactúa con Prisma. En el listado aisla y omite los tokens (`accessToken`, `refreshToken`).
- `presentation/` — controlador REST delgado, delegando peticiones post-validación (con `connectAccountSchema` Zod) a los casos de uso.

**Manejo Interno de Credenciales**:
El caso de uso `GetCredentialsUseCase` está exportado desde `ConnectedAccountsModule` para ser utilizado por `PublicationsModule` en el proceso de dispatch a n8n. Si alguna red no está conectada, el caso de uso lanza un `MissingConnectedAccountError`, que el filtro global traduce a 400 Bad Request. Los tokens no son expuestos en las consultas HTTP públicas.

**Cifrado de Credenciales en Reposo**:
Los campos `accessToken` y `refreshToken` se encriptan de forma transparente en la capa de infraestructura (`PrismaConnectedAccountsRepository`) antes de ser guardados en la base de datos de PostgreSQL, garantizando la seguridad en reposo.
- **Algoritmo**: `AES-256-GCM` (provisto de forma nativa por el módulo `node:crypto`).
- **Clave**: Se inyecta mediante la variable de entorno `ENCRYPTION_KEY` administrada por `ConfigService` (64 hex chars; generar con `openssl rand -hex 32`). Si falta, el repositorio falla rápido con `Error` plano (no excepción HTTP). En e2e se fija una de prueba en `vitest.config.e2e.ts`.
- **Formato**: El texto cifrado se almacena con la forma `IV:AuthTag:Ciphertext`.
- **Lectura**: El caso de uso `GetCredentialsUseCase` obtiene y descifra las credenciales al vuelo para integrarse de forma segura con el webhook de n8n.

**Tests**: 9 unitarios (`test/unit/modules/connected-accounts/`) + flujo e2e (`test/connected-accounts.e2e-spec.ts`: conectar → listar sin secretos → desvincular → 404 → 400).

## 7. Tests y comandos

- Unitarios en `test/unit/` como espejo de `src/` (nunca `.spec` junto al código);
  casos de uso con puertos stub tipados, sin DB. E2E en `test/*.e2e-spec.ts`
  (requieren `docker compose up -d`; secretos de prueba en `vitest.config.e2e.ts`).

```bash
pnpm --filter api run start:dev     # backend en watch
pnpm --filter api run test          # vitest unit
pnpm --filter api run test:e2e      # e2e (DB levantada)
pnpm --filter api run check-types   # tsc --noEmit
pnpm --filter api run lint          # oxlint src/ test/
```
