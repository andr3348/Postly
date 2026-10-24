# Frontend — `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)

> Estado: Autenticación tradicional completada (login/registro, multisesión y logout con revocación). Dashboard Shell y Profile implementados con soporte responsive y temas claro/oscuro.
> Integración con backend NestJS activa mediante cookies HttpOnly, sesión sincronizada cliente y proxy `/api`.
> Asistente IA de texto (Gemini) integrado en la creación de publicaciones.

## 1. Arquitectura Híbrida: App Router + Feature-Driven

Para mantener el frontend escalable y alineado con los principios de **Clean Architecture** del backend (ver `docs/backend.md`), se implementó un patrón arquitectónico híbrido. Es una combinación de las convenciones de enrutamiento impuestas por el framework y un encapsulamiento modular por dominio de negocio (inspirado en _Feature-Sliced Design_):

### A. Capa de Enrutamiento e Infraestructura (`src/app/`)

Esta capa pertenece exclusivamente al **Next.js App Router** y sus rutas se nombran estrictamente en inglés:

- **Responsabilidad:** Gestionar las URLs, protección de rutas y layouts (SSR/RSC).
- **Regla estricta:** Se mantiene "delgada". Los archivos `page.tsx` no contienen lógica de negocio compleja ni formularios pesados; solo actúan como orquestadores que importan componentes desde la capa de negocio.
- **Route Groups:** Se usan agrupaciones como `(auth)` para aislar layouts (p. ej., el contenedor centrado del Login) sin ensuciar la URL (se mantiene `/login`, no `/auth/login`).
- **Dashboard Shell:** `src/app/dashboard/layout.tsx` orquesta el cascarón (`DashboardShell`), mientras que `src/app/dashboard/page.tsx` y `src/app/dashboard/profile/page.tsx` delegan en componentes de negocio correspondientes.

### B. Capa de Negocio / Módulos (`src/features/`)

Esta es la capa donde reside el verdadero valor de la aplicación. En lugar de organizar el código por tipo técnico (todos los componentes mezclados en `src/components`), se agrupa por **Dominio de Negocio** (`auth`, `dashboard`, `brands`, `publications`, `analytics`):

- **`src/features/auth`:**
  - Componentes de UI: `LoginForm.tsx` (incluye “Mantener sesión activa”), `ProfileCard.tsx` y `SessionsCard.tsx` (perfil y sesiones activas en `/dashboard/profile`).
  - Servicios API: `api.ts` (expone `login`, `register`, `getMe`, `logout`, `listAuthSessions`, `revokeAuthSession` y `revokeOtherAuthSessions`), `schemas.ts` (esquemas Zod).
  - Estado de sesión cliente: `session.ts` (captura `{ user }` tras auth, se auto-sincroniza con `GET /auth/me` y reacciona al evento `postly:session-expired` limpiando el usuario local), `role-label.ts` (etiquetas en español para roles).
- **`src/features/dashboard`:**
  - `DashboardShell.tsx`: Cascarón orquestador responsive (soporte para colapso y menú móvil).
  - `DashboardSidebar.tsx`: Barra lateral flotante con bordes redondeados (`rounded-[28px]`), estado expandido y colapsado, visualización de avatar, nombre y rol del usuario, cierre de sesión y alternancia de tema.
  - `DashboardNavbar.tsx`: Barra superior flotante con pestañas que navegan (`Analítica` → `/dashboard`, `Planificación` → `/dashboard/publications`) y selector de marcas con datos reales (`BrandSwitcher`, `GET /brands`).
  - `DashboardHome.tsx`: Vista principal con resumen de KPIs omnicanal e Insights con IA.
- **`src/features/ai`:**
  - `api.ts`: contrato tipado de `POST /api/v1/generations/text` (IDEAS/COPY/IMPROVE).
  - `components/AiAssistantPanel.tsx`: panel de ideas/copy, acumulativo con "Más ideas", desarrollo de una idea, mejora con feedback y "Usar este texto".
- **Beneficio (Tesis):** Este enfoque refleja exactamente cómo NestJS divide sus responsabilidades en `apps/api/src/modules/`, permitiendo que frontend y backend evolucionen con el mismo lenguaje de dominio, previniendo el "código espagueti".

### C. Capa Compartida (`src/shared/`)

Aquí viven los componentes UI agnósticos, tokens y utilidades puras usadas transversalmente:

- **Componentes y Marca:** `AlmaLogo.tsx` (isotipo y tipografía vectorial oficial de Alma Quinta reactivo a temas mediante `currentColor`).
- **Iconografía Vectorial:** `src/shared/components/icons/DashboardIcons.tsx` (redes sociales: Facebook, Instagram, LinkedIn; utilitarios: web, analítica, planificación, reportes, sol/luna, chevrons).
- **Theming Global:** `src/shared/context/ThemeContext.tsx` (proveedor global de modo claro y oscuro, sincronizado con `localStorage` y `.dark` de Tailwind v4).

## 2. Flujo de Autenticación e Integración con NestJS

El frontend delega por completo la seguridad y emisión de JWT al backend (tal como se define en `docs/backend.md`), mediante los siguientes mecanismos:

1. **Proxy a la API:** En `next.config.ts` se estableció un `rewrite` de `/api/:path*` hacia `http://localhost:3001/api/:path*`. Esto soluciona problemas de CORS y unifica el origen de las peticiones para el navegador.
2. **Peticiones Axios:** Los componentes usan el cliente central (`src/lib/api.ts`, axios con `withCredentials`) con interceptor de refresh-on-401. Ante un 401 intenta `POST /auth/refresh` una sola vez y reintenta la petición original. El refresh es **single-flight**: si varias peticiones fallan a la vez, todas comparten la misma promesa y solo se rota el refresh una vez. La respuesta de éxito de NestJS inyecta los tokens como cookies `HttpOnly` (`accessToken` y `refreshToken`) directamente en el navegador.
3. **Middleware de Protección (`src/proxy.ts`):** Adaptado al estándar de Next.js 16.3.5 (que depreca `middleware.ts` en favor de `proxy.ts`). Intercepta cada solicitud y verifica la existencia de las cookies reales de NestJS. Redirige a `/login` si no hay sesión, y a `/dashboard` si el usuario intenta acceder al login estando logueado.
4. **Cierre de Sesión real:** `logout()` llama a `POST /auth/logout` (público, revoca la sesión y borra las cookies en el backend), limpia el usuario local y navega a `/login`. Un server action mínimo (`clearAuthCookiesAction`) borra las cookies `HttpOnly` como respaldo si la llamada al backend falla por red, de modo que el proxy no deje al usuario atrapado en el dashboard.
5. **Sesión Cliente y Sonda `/auth/me`:** Al autenticarse, el backend entrega `{ user: { id, email, name, role } }`. Si se accede directamente o se recarga la página, `useSessionUser()` en `src/features/auth/session.ts` consulta automáticamente la sonda protegida `GET /auth/me` para mantener el nombre y rol visibles en la barra lateral y en la vista de perfil. Si el refresh falla (sesión revocada desde otro dispositivo o refresh vencido), el cliente emite `postly:session-expired`; `session.ts` limpia el usuario local y redirige al login si estaba en el dashboard.
6. **Multisesión en `/dashboard/profile`:** `SessionsCard` lista las sesiones activas (`GET /auth/sessions`), marca la actual y permite cerrar una (`DELETE /auth/sessions/:id`) o todas las demás (`POST /auth/sessions/revoke-others`). Si se cierra la sesión actual, el backend borra las cookies y el frontend limpia su estado y vuelve a `/login`. La revocación es inmediata porque el guard valida el `sid` contra la BD en cada petición.

## 3. Convenciones frontend (alineadas al backend)

- **Rutas estrictamente en inglés**: `/login`, `/dashboard`, `/dashboard/profile`, `/dashboard/brands`, etc.
- **Sin `fetch`/axios crudo en componentes**: cada feature expone `api.ts` (llamadas tipadas sobre el cliente central) + `schemas.ts` (Zod cliente espejando límites del backend con `z.email()`/`z.url()` top-level, nunca los métodos deprecados de `z.string()`; el backend siempre revalida).
- **Eventos de form**: `React.SubmitEvent` (`FormEvent` está deprecado en `@types/react`).
- **`src/lib/api.ts`**: cliente axios (`withCredentials` + baseURL `/api`) con interceptor refresh-on-401 single-flight (un reintento) y `apiJson<T>` (errores → `ApiError` con mensaje, `code`, `model` y `retryable` en español; los componentes llaman vía la capa `api.ts` de cada feature). Si el refresh falla emite `postly:session-expired`. Verificado en vivo: register → cookies → refresh → `/me` 200/401 y multisesión (listar/revocar).
- **Sin `any` en `catch`**: `unknown` + narrowing (`err instanceof Error`).
- **Sin selector de rol en register**: el backend lo ignora (siempre MARKETING; el admin nace del seed).
- **Estilos de tema**: Paleta institucional en modo claro (fondo `#e9edf2`, texto `#083A3D`) y modo oscuro (fondo `#151922`, tarjetas `#232a3e`, texto blanco).

## 4. Mapa de vistas

| Vista                              | Ruta                            | Estado        | Consume (backend)                                                                                  |
| ---------------------------------- | ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| Login institucional                | `/login`                        | Completado    | `POST /auth/login` — Set-Cookie + `{ user }`; `rememberMe` define cookie persistente vs de sesión |
| Dashboard home (Shell + Resumen)   | `/dashboard`                    | Completado    | `GET /analytics/summary` — KPIs y canales reales; `not-found.tsx` global para rutas sin vista |
| Perfil de usuario                  | `/dashboard/profile`            | Completado    | `GET /auth/me` (nombre y rol) + `GET /auth/sessions`, `DELETE /auth/sessions/:id` y `POST /auth/sessions/revoke-others` |
| Marcas                             | `/dashboard/brands`             | Completado    | CRUD `/brands` + contexto global (`BrandProvider`, persistido) que consume el switcher |
| Publicaciones (bandeja por estado) | `/dashboard/publications?status=` | Completado | `GET /publications?brandId=&status=` + chips `?status=` sincronizados con la URL                                   |
| Crear publicación                  | `/dashboard/publications/new`   | Completado    | `POST /publications` (borrador de la marca activa: título opcional, descripción y media) → redirige al detalle; panel IA con `POST /api/v1/generations/text` (stateless) o `POST /api/v1/generations/agent` (texto + media + DRAFT) |
| Editar borrador                    | `/dashboard/publications/:id/edit` | Completado | `GET /publications/:id` + `PATCH /publications/:id` (dueño/ADMIN en `DRAFT`) — misma vista que crear; el panel IA oculta Agente |
| Detalle + flujo                    | `/dashboard/publications/:id`   | Completado    | `PATCH` (dueño/ADMIN en DRAFT desde el editor unificado), `submit` (dueño/ADMIN, exige targets), `approve` (ADMIN + agenda) / `publish-now` (ADMIN, inmediato) / `reject` (ADMIN), targets add/remove y selector Feed/Reel para video en Facebook/Instagram, historial de métricas (+ snapshot manual dueño/ADMIN en canal publicado) |
| Cuentas conectadas                 | `/dashboard/accounts`           | Completado    | Facebook/Instagram con OAuth de Meta (`start` → callback → selector de página → `complete`; IG depende de Facebook) + CRUD anidado `/brands/:id/accounts` y `POST /verify` como respaldo manual (también LinkedIn/TikTok) + badge `EXPIRED` |
| Analytics                          | `/dashboard/analytics`          | Completado    | `GET /analytics/summary` (brandId del switcher) — KPIs, pipeline por estado y barras por canal con Shadcn cards + Recharts; Insights IA sigue placeholder (paso b del §5) |

Sin vista: `/dispatch` (superficie máquina de n8n, sin UI).

### 4.1 Formatos por destino (Feed/Reel)

- El backend expone `PublicationTarget.format` (`FEED | REEL`). El frontend lo
  tipa en `schemas.ts` (`publicationFormatSchema`) y lo muestra en
  `PublicationDetail` junto al estado del canal.
- `addTarget(id, platform)` no envía `format`: el backend aplica el default
  (video de Facebook/Instagram → `REEL`; resto → `FEED`).
  `updateTargetFormat(id, platform, format)` hace
  `PATCH /publications/:id/targets/:platform` y solo se ofrece en
  `DRAFT`/`PENDING_APPROVAL` (antes de programar).
- El selector solo aparece para `VIDEO` en Facebook/Instagram; las imágenes y
  las demás plataformas muestran el badge de formato sin edición.
- En Instagram ambos formatos se comparten al feed (`share_to_feed=true`). La
  distinción `FEED`/`REEL` se conserva para trazabilidad y para elegir el flujo
  de Facebook; ver `docs/n8n.md` §3.

### 4.2 Asistente IA (Gemini + modo agente fal.ai)

En `/dashboard/publications/new` (y en el editor unificado) el panel
`AiAssistantPanel` vive en la misma vista que el formulario manual, arriba en
pantallas pequeñas:

- **Pestañas Agente | Texto | Ideas.** Al crear, **Agente** es la opción por
  defecto; en edición se oculta (`hideAgent`) porque crearía otro borrador.
- **Agente (solo al crear):** exige marca activa, brief, plataforma y formato
  (`REEL` solo Facebook/Instagram). Un único request a
  `POST /api/v1/generations/agent`: el backend genera el texto (Gemini), la
  media (fal.ai: imagen FLUX en Feed / video Kling en Reel), la copia a R2 y crea
  el `DRAFT`. El frontend invalida el caché y navega al editor del borrador
  (`/dashboard/publications/:id/edit`). El botón avisa que el video puede tardar
  minutos; si falla, muestra el mensaje del backend y **Reintentar** solo cuando
  `retryable` es `true`.
- **Ideas:** genera 3 tarjetas con título, ángulo, hook, por qué funciona y
  formato sugerido. **Más ideas** vuelve a llamar al endpoint enviando
  `excludeIdeas` con los títulos ya mostrados, y **anexa** las nuevas tarjetas
  (no reemplaza).
- **Desarrollar:** toma una idea y pasa al modo Texto con el brief enriquecido
  para generar 3 variantes de copy.
- **Texto:** muestra las variantes con título, hashtags, CTA y propuesta de
  media. Cada variante se puede **Mejorar** con una indicación (modo `IMPROVE`).
  En edición, mientras no hay variantes, aparece la tarjeta "Texto actual del
  borrador" con **Mejorar este texto**, que usa el copy guardado como
  `currentCopy`.
- **Usar este texto:** prellena **descripción** (`copy`) + **título** (`title` de
  la variante) + prompt original + `modelText` en `PublicationForm` mediante la
  prop `fill` (con `nonce`); no toca la URL ni el tipo de media. El formulario
  sigue siendo editable y es el único que guarda al crear.
- Cada variante conserva el modelo real que la generó (incluido el fallback); el
  formulario lo envía como `modelText` al crear el borrador sin mostrarlo. Un
  borrador escrito manualmente queda como `"manual"`.
- **Texto/Ideas son stateless:** no crean publicaciones ni escriben en la base
  de datos. La media se agrega manualmente en el formulario.
- El panel envía plataforma, formato (`FEED`/`REEL`) y tipo de media opcionales
  para adaptar el copy. En modo agente, `REEL` fuerza video y el selector de
  media se deshabilita.
- Si Gemini/fal.ai fallan, el panel muestra un mensaje en español según la
  causa; cuando el API marca `retryable`, aparece **Reintentar**, que repite la
  misma solicitud (texto o agente). Si no es reintentable (configuración,
  autenticación, seguridad), solo se muestra el mensaje.
- Las instrucciones del modelo se escriben en inglés, pero todo el contenido
  generado se devuelve en español neutro latinoamericano; la interfaz y los
  mensajes de error permanecen en español.
- El formulario manual (`PublicationForm`) expone **Título (opcional)**,
  **Descripción** (el campo `copy`, que es la caption pública) y media (URL +
  tipo). En la bandeja el título encabeza la tarjeta cuando existe; si no, se
  sigue mostrando la descripción.

### 4.3 Editor unificado (crear/editar)

- Crear (`/dashboard/publications/new`) y editar
  (`/dashboard/publications/:id/edit`) comparten el mismo grid y
  `PublicationForm`; el modal "Editar borrador" del detalle se eliminó.
- `PublicationEditor` carga el borrador con `getPublicationCached`, usa el
  `brandId` del propio borrador, oculta la pestaña Agente y precarga todos los
  campos (incluido el título). Solo se edita `DRAFT`: si el estado avanzó,
  muestra un aviso con enlace al detalle.
- Guardar hace `PATCH /publications/:id` con `updateDraftFormSchema`, invalida
  el caché de publicaciones y vuelve al detalle. El botón "Editar borrador" del
  detalle es ahora un `Link` a esta vista (visible para dueño/ADMIN en `DRAFT`).

### 4.4 Conexión de Meta por OAuth (Facebook/Instagram)

- Botones separados por plataforma (estilo Metricool). **Facebook** lanza
  `GET /brands/:id/accounts/meta/oauth/start` y navega con
  `window.location.assign` al diálogo de Meta. **Instagram** no inicia OAuth:
  queda deshabilitado hasta que haya Facebook conectado y usa
  `POST /brands/:id/accounts/instagram/from-facebook` con el Page token ya
  guardado.
- El callback vuelve a `/dashboard/accounts` con `meta_session`/`meta_brand`
  (o `meta_error`). El manager prioriza esa marca, consulta la sesión (sin
  Page tokens), limpia la query con `router.replace` y abre `MetaPagePicker`
  cuando la sesión está `READY`; al guardar hace `complete` y refresca el
  caché. Los errores del flujo se muestran con el `message` del backend
  (`META_PAGE_MISMATCH` recuerda desconectar Instagram antes de cambiar de
  página).
- **Token manual** sigue disponible como respaldo en cada tarjeta
  (`ConnectAccountForm` + `POST /verify`) para casos avanzados y para
  LinkedIn/TikTok, que no usan OAuth todavía.
- Los Page tokens nunca llegan al navegador; `authType`/`metaPageId` sí
  permiten mostrar si la cuenta se vinculó con OAuth.
- **Requisitos para una cuenta real:** la app de Meta debe estar en Live, con
  Business Verification y Advanced Access para Pages/Instagram; el usuario
  debe administrar la Page (tareas `MANAGE`/`CREATE_CONTENT`) y la cuenta de
  Instagram debe ser profesional y estar vinculada. En Development solo
  funcionan las cuentas con rol en la app. El checklist completo está en
  `docs/backend.md` §6.
- **Selector de página:** `MetaPagePicker` muestra nombre, ID y, si existe,
  `Instagram: @usuario` (o "Sin Instagram vinculado"); preselecciona la
  primera Page. "Guardar conexión" llama a `complete`; si Instagram ya está
  vinculado a otra Page, el backend responde 409 y el mensaje indica
  desconectarlo primero. Cancelar cierra el modal: para retomarlo hay que
  volver a iniciar el OAuth (la sesión no se reabre desde la UI).
- **Después de guardar:** Facebook queda `CONNECTED` y marcado "Vinculada con
  OAuth de Meta"; el botón de Instagram se habilita. "Conectar Instagram"
  detecta la cuenta profesional de la Page y reutiliza el token; si no hay
  vínculo responde `META_INSTAGRAM_NOT_LINKED`. "Reconectar" en Facebook
  renueva el token de Facebook y, si es la misma Page, el de Instagram.
- **Errores y diagnóstico:** el mensaje del backend se muestra arriba de la
  grilla. Un retorno con `meta_error` se traduce a "La conexión con Meta no es
  válida o ya se usó" / "La conexión con Meta expiró"; una sesión `FAILED`
  muestra su `errorMessage`. Causas frecuentes:
  - *URL Blocked / redirect_uri*: el URI no coincide exacto o la app está en
    Live con un redirect HTTP.
  - *App not active*: la app no está en Live o el usuario no tiene rol.
  - *No pages / permisos*: el usuario no administra la Page o la configuración
    de Meta no incluye Pages/Instagram (`config_id` incompleto o Advanced
    Access pendiente).
  - *Instagram no vinculado*: la cuenta no es profesional o no está asociada a
    la Page; también puede faltar el permiso en App Review.
  - *Require App Secret*: ver la nota de `appsecret_proof` en
    `docs/backend.md` §6.

### 4.5 Fallos y reintento por target

- `PublicationFailures` aparece en el detalle cuando al menos un
  `PublicationTarget` quedó `FAILED`. No muestra canales exitosos.
- Cada tarjeta fallida indica plataforma/formato, tipo de fallo, mensaje,
  acción sugerida y reintentos usados (`n` de 3). "Detalle técnico" pliega
  código, subcódigo, HTTP, etapa (`MEDIA_PREPARATION`/`PUBLISH`), mensaje del
  proveedor y `fbtrace_id`.
- El botón de reintento solo se habilita si: la publicación está `PARTIAL` o
  `FAILED`; el target está `FAILED`; es Facebook o Instagram;
  `failure.retryable === true`; quedan menos de 3 reintentos; y el usuario es
  ADMIN. Con varios canales elegibles aparece "Reintentar canales de Meta";
  con uno, "Reintentar <red>".
- Al confirmar, el modal aclara que solo se reenviarán los canales
  seleccionados y que se reutiliza la aprobación original (sin nueva
  aprobación). La publicación vuelve a `SCHEDULED` y el detalle se refresca.
- Mientras la publicación siga `PROCESSING`, el panel avisa que espera el
  reporte de los canales restantes y no ofrece reintento. Un fallo no seguro
  (`retryable: false`, p. ej. `UNKNOWN_OUTCOME`) muestra "Sin reintento"; los
  no ADMIN ven que solo un administrador puede reintentar. LinkedIn/TikTok no
  tienen reintento en esta fase.
- El backend es la autoridad: aunque la UI oculte el botón, el endpoint
  `POST /publications/:id/retry` valida estado, plataforma, fallo seguro y
  límite de intentos (ver `docs/backend.md` §7).

## 5. Analytics e Insights por IA (requisito de tesis)

Pestaña **Analytics** con dos capas:

**a) Muestra de datos.** Gráficos de:

- Métricas de publicaciones: impresiones, clics, reacciones, tasa de engagement (LinkedIn API o registradas tras la publicación → modelo `TargetMetric`, ver `docs/database.md`).
- Métricas operativas: posts generados vs. aprobados, tiempo promedio de generación, volumen por canal.

**b) Interpretación de datos (el componente estrella de IA).** El backend envía un resumen estructurado de métricas a un LLM, p. ej.:
_"Analiza estas métricas de los últimos 15 días en LinkedIn. Identifica qué formatos o temáticas tuvieron mayor engagement y genera 3 recomendaciones concretas para las próximas publicaciones."_
El dashboard muestra **"Insights Estratégicos por IA"**: resumen ejecutivo en texto claro, p. ej. _"Las publicaciones con tono técnico y casos de estudio obtuvieron un 32% más de alcance orgánico que los anuncios directos. Se sugiere programar el próximo post técnico el martes entre las 9:00 y 11:00 am."_

**Decisión de librería:** Shadcn UI **no es** un motor de gráficos — sus componentes `chart` (`ui.shadcn.com/docs/components/base/chart`) son envoltorios declarativos sobre **Recharts** (hoy Recharts v3). Por tanto el stack es **Shadcn UI (shell: cards, tabs, theming) + Recharts (motor de render, vía primitivas `chart` de Shadcn) + Tailwind**. Se descarta Chart.js: API imperativa y sin integración de primera clase con el theming Shadcn, mientras Recharts es React declarativo y el camino oficialmente documentado por Shadcn. Estado: **instalado y en uso** (capa a: KPIs + pipeline por estado + barras impresiones/interacciones por canal en `/dashboard/analytics`; series por destino quedan para la fase fina — el backend aún no publica ese endpoint; capa b: la generación de texto Gemini ya existe en `/dashboard/publications/new`, pero los Insights IA de Analytics siguen como placeholder).

```bash
pnpm --filter web run dev     # frontend en desarrollo
```
