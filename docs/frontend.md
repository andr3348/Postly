# Frontend — `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)

> Estado: Autenticación base completada (Login). Dashboard Shell y Profile implementados con soporte responsive y temas claro/oscuro.
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
  - Componentes de UI: `LoginForm.tsx`, `ProfileCard.tsx` (vista de perfil en `/dashboard/profile`).
  - Servicios API: `api.ts` (expone `login`, `register` y `getMe`), `schemas.ts` (esquemas Zod).
  - Estado de sesión cliente: `session.ts` (captura `{ user }` tras auth y se auto-sincroniza con `GET /auth/me`), `role-label.ts` (etiquetas en español para roles).
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
2. **Peticiones Axios:** Los componentes usan el cliente central (`src/lib/api.ts`, axios con `withCredentials`) con interceptor de refresh-on-401. De este modo, la respuesta de éxito de NestJS inyecta los JWT como cookies `HttpOnly` (`accessToken` y `refreshToken`) directamente en el navegador.
3. **Middleware de Protección (`src/proxy.ts`):** Adaptado al estándar de Next.js 16.3.5 (que depreca `middleware.ts` en favor de `proxy.ts`). Intercepta cada solicitud y verifica la existencia de las cookies reales de NestJS. Redirige a `/login` si no hay sesión, y a `/dashboard` si el usuario intenta acceder al login estando logueado.
4. **Cierre de Sesión Seguro (Server Actions):** Debido a que el entorno cliente (JavaScript) no puede destruir cookies `HttpOnly`, el logout invoca una _Server Action_ nativa (`logoutAction`) que elimina las cookies desde el servidor de Next.js antes de redirigir a `/login`.
5. **Sesión Cliente y Sonda `/auth/me`:** Al autenticarse, el backend entrega `{ user: { id, email, name, role } }`. Si se accede directamente o se recarga la página, `useSessionUser()` en `src/features/auth/session.ts` consulta automáticamente la sonda protegida `GET /auth/me` para mantener el nombre y rol visibles en la barra lateral y en la vista de perfil.

## 3. Convenciones frontend (alineadas al backend)

- **Rutas estrictamente en inglés**: `/login`, `/dashboard`, `/dashboard/profile`, `/dashboard/brands`, etc.
- **Sin `fetch`/axios crudo en componentes**: cada feature expone `api.ts` (llamadas tipadas sobre el cliente central) + `schemas.ts` (Zod cliente espejando límites del backend con `z.email()`/`z.url()` top-level, nunca los métodos deprecados de `z.string()`; el backend siempre revalida).
- **Eventos de form**: `React.SubmitEvent` (`FormEvent` está deprecado en `@types/react`).
- **`src/lib/api.ts`**: cliente axios (`withCredentials` + baseURL `/api`) con interceptor refresh-on-401 (un reintento) y `apiJson<T>` (errores → `ApiError` con mensaje, `code`, `model` y `retryable` en español; los componentes llaman vía la capa `api.ts` de cada feature). Verificado en vivo: register → cookies → refresh → `/me` 200/401.
- **Sin `any` en `catch`**: `unknown` + narrowing (`err instanceof Error`).
- **Sin selector de rol en register**: el backend lo ignora (siempre MARKETING; el admin nace del seed).
- **Estilos de tema**: Paleta institucional en modo claro (fondo `#e9edf2`, texto `#083A3D`) y modo oscuro (fondo `#151922`, tarjetas `#232a3e`, texto blanco).

## 4. Mapa de vistas

| Vista                              | Ruta                            | Estado        | Consume (backend)                                                                                  |
| ---------------------------------- | ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| Login institucional                | `/login`                        | Completado    | `POST /auth/login` — Set-Cookie + `{ user }`                                                      |
| Dashboard home (Shell + Resumen)   | `/dashboard`                    | Completado    | `GET /analytics/summary` — KPIs y canales reales; `not-found.tsx` global para rutas sin vista |
| Perfil de usuario                  | `/dashboard/profile`            | Completado UI | `GET /auth/me` — nombre y rol desde sesión activa                                                  |
| Marcas                             | `/dashboard/brands`             | Completado    | CRUD `/brands` + contexto global (`BrandProvider`, persistido) que consume el switcher |
| Publicaciones (bandeja por estado) | `/dashboard/publications?status=` | Completado | `GET /publications?brandId=&status=` + chips `?status=` sincronizados con la URL                                   |
| Crear publicación                  | `/dashboard/publications/new`   | Completado    | `POST /publications` (borrador de la marca activa) → redirige al detalle + `POST /api/v1/generations/text` desde el panel IA (prellenado, sin persistencia) |
| Detalle + flujo                    | `/dashboard/publications/:id`   | Completado    | `PATCH` (dueño/ADMIN en DRAFT), `submit` (dueño/ADMIN, exige targets), `approve` (ADMIN + agenda) / `publish-now` (ADMIN, inmediato) / `reject` (ADMIN), targets add/remove y selector Feed/Reel para video en Facebook/Instagram, historial de métricas (+ snapshot manual dueño/ADMIN en canal publicado) |
| Cuentas conectadas                 | `/dashboard/accounts`           | Completado    | CRUD anidado `/brands/:id/accounts` + `POST /verify` (prueba real antes de guardar) + badge `EXPIRED` |
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

### 4.2 Asistente IA de texto (Gemini)

En `/dashboard/publications/new`, en la misma vista que el formulario manual
(arriba en pantallas pequeñas), vive `AiAssistantPanel`:

- **Ideas:** genera 3 tarjetas con título, ángulo, hook, por qué funciona y
  formato sugerido. **Más ideas** vuelve a llamar al endpoint enviando
  `excludeIdeas` con los títulos ya mostrados, y **anexa** las nuevas tarjetas
  (no reemplaza).
- **Desarrollar:** toma una idea y pasa al modo Texto con el brief enriquecido
  para generar 3 variantes de copy.
- **Texto:** muestra las variantes con hashtags, CTA y propuesta de media. Cada
  variante se puede **Mejorar** con una indicación (modo `IMPROVE`).
- **Usar este texto:** prellena copy + prompt original en `PublicationForm`
  mediante la prop `fill` (con `nonce`); no toca la URL ni el tipo de media. El
  formulario sigue siendo editable y es el único que crea el `DRAFT`.
- Cada variante conserva el modelo real que la generó (incluido el fallback); el
  formulario lo envía como `modelText` al crear el borrador sin mostrarlo. Un
  borrador escrito manualmente queda como `"manual"`.
- La generación es **stateless**: no crea publicaciones ni escribe en la base de
  datos. La media todavía se agrega manualmente; la fase 2 (modo agente: fal.ai
  + Cloudflare R2) la generará desde el guion del asistente y prellenará el
  borrador.
- El panel envía plataforma, formato (`FEED`/`REEL`) y tipo de media opcionales
  para adaptar el copy. Si Gemini falla, muestra un mensaje en español según la
  causa; cuando el API marca `retryable`, aparece **Reintentar**, que repite la
  misma solicitud. Si no es reintentable (configuración, autenticación,
  seguridad), solo se muestra el mensaje.
- Las instrucciones del modelo se escriben en inglés, pero todo el contenido
  generado se devuelve en español neutro latinoamericano; la interfaz y los
  mensajes de error permanecen en español.

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
