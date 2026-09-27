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

## 4. Tests y comandos

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
