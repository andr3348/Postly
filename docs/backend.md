# Backend — `apps/api` (NestJS 12)

> Patrón vigente: Clean Architecture por módulo
> (`modules/<modulo>/{domain,application,infrastructure,presentation}`),
> estrenado en `modules/auth` y a replicar en el resto.

## 1. Módulo auth (JWT stateless + argon2id)

Sin revocación ni sesiones en esta fase: access corto + refresh largo, ambos
stateless (firma + expiración). **No existe tabla de refresh tokens por diseño.**

```text
POST /auth/register   → { user, tokens }   (201; 409 si el email existe)
POST /auth/login      → { user, tokens }   (200; 401 credencial inválida)
POST /auth/refresh    → { user, tokens }   (200; 401 refresh inválido)
GET  /auth/me         → AccessPayload      (protegida; sonda del guard)
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
en `src/shared/`: `errors.ts`, `decorators.ts`, `filters.ts`, `env.ts`.
Regla de dirección: **`src/shared/` nunca importa de `src/modules/`.**

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

## 2. Contratos del api

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

## 3. Tests y comandos

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
