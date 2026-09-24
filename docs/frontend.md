# Frontend — `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)

> Estado: Autenticación base completada (Login/Registro). Arquitectura modular definida.
> Dashboard real en desarrollo (solo cuenta con placeholder protegido).

## 1. Arquitectura Híbrida: App Router + Feature-Driven

Para mantener el frontend escalable y alineado con los principios de **Clean Architecture** del backend (ver `docs/backend.md`), se implementó un patrón arquitectónico híbrido. Es una combinación de las convenciones de enrutamiento impuestas por el framework y un encapsulamiento modular por dominio de negocio (inspirado en *Feature-Sliced Design*):

### A. Capa de Enrutamiento e Infraestructura (`src/app/`)
Esta capa pertenece exclusivamente al **Next.js App Router**.
- **Responsabilidad:** Gestionar las URLs, protección de rutas y layouts (SSR/RSC).
- **Regla estricta:** Se mantiene "delgada". Los archivos `page.tsx` no contienen lógica de negocio compleja ni formularios pesados; solo actúan como orquestadores que importan componentes desde la capa de negocio.
- **Route Groups:** Se usan agrupaciones como `(auth)` para aislar layouts (p. ej., el contenedor centrado del Login) sin ensuciar la URL (se mantiene `/login`, no `/auth/login`).

### B. Capa de Negocio / Módulos (`src/features/`)
Esta es la capa donde reside el verdadero valor de la aplicación. En lugar de organizar el código por tipo técnico (todos los componentes mezclados en `src/components`), se agrupa por **Dominio de Negocio** (`auth`, `campaigns`, `analytics`).
- **Alta cohesión:** Si el módulo de autenticación necesita mantenimiento, toda su UI (`LoginForm.tsx`, `RegisterForm.tsx`), llamadas a la API o Server Actions (`actions.ts`) están aisladas en `src/features/auth`.
- **Beneficio (Tesis):** Este enfoque refleja exactamente cómo NestJS divide sus responsabilidades en `apps/api/src/modules/`, permitiendo que frontend y backend evolucionen con el mismo lenguaje de dominio, previniendo el "código espagueti".

### C. Capa Compartida (`src/shared/`)
- **Planificado:** Aquí vivirán los componentes UI agnósticos (botones, inputs, Shadcn UI) y utilidades puras que pueden ser usadas por cualquier *Feature*.

## 2. Flujo de Autenticación e Integración con NestJS

El frontend delega por completo la seguridad y emisión de JWT al backend (tal como se define en `docs/backend.md`), mediante los siguientes mecanismos:

1. **Proxy a la API:** En `next.config.ts` se estableció un `rewrite` de `/api/:path*` hacia `http://localhost:3001/api/:path*`. Esto soluciona problemas de CORS y unifica el origen de las peticiones para el navegador.
2. **Peticiones Fetch:** Los componentes del cliente usan `fetch` con `credentials: 'include'`. De este modo, la respuesta de éxito de NestJS logra inyectar los JWT como cookies `HttpOnly` (`accessToken` y `refreshToken`) directamente en el navegador.
3. **Middleware de Protección (`src/proxy.ts`):** Adaptado al estándar de Next.js 16.3.5 (que depreca `middleware.ts` en favor de `proxy.ts`). Intercepta cada solicitud y verifica la existencia de las cookies reales de NestJS. Redirige a `/login` si no hay sesión, y a `/dashboard` si el usuario intenta acceder al login estando logueado.
4. **Cierre de Sesión Seguro (Server Actions):** Debido a que el entorno cliente (JavaScript) no puede destruir cookies `HttpOnly`, el logout invoca una *Server Action* nativa (`logoutAction`) que elimina las cookies desde el servidor de Next.js antes de redirigir a `/login`.

## 2. Alcance previsto

Dashboard de marketing: ingresar prompt, previsualizar (mockup por red),
aprobar/rechazar (human-in-the-loop), más pestaña **Analytics** (ver §3).

## 3. Analytics e Insights por IA (requisito de tesis)

Pestaña **Analytics** con dos capas:

**a) Muestra de datos.** Gráficos de:

- Métricas de publicaciones: impresiones, clics, reacciones, tasa de engagement
  (LinkedIn API o registradas tras la publicación → modelo `TargetMetric`,
  ver `docs/database.md`).
- Métricas operativas: posts generados vs. aprobados, tiempo promedio de
  generación, volumen por canal.

**b) Interpretación de datos (el componente estrella de IA).** El backend envía
un resumen estructurado de métricas a un LLM, p. ej.:
_"Analiza estas métricas de los últimos 15 días en LinkedIn. Identifica qué
formatos o temáticas tuvieron mayor engagement y genera 3 recomendaciones
concretas para las próximas publicaciones."_
El dashboard muestra **"Insights Estratégicos por IA"**: resumen ejecutivo en
texto claro, p. ej. _"Las publicaciones con tono técnico y casos de estudio
obtuvieron un 32% más de alcance orgánico que los anuncios directos. Se sugiere
programar el próximo post técnico el martes entre las 9:00 y 11:00 am."_

**Decisión de librería:** Shadcn UI **no es** un motor de gráficos — sus
componentes `chart` (`ui.shadcn.com/docs/components/base/chart`) son envoltorios
declarativos sobre **Recharts** (hoy Recharts v3). Por tanto el stack es
**Shadcn UI (shell: cards, tabs, theming) + Recharts (motor de render, vía
primitivas `chart` de Shadcn) + Tailwind**. Se descarta Chart.js: API imperativa
y sin integración de primera clase con el theming Shadcn, mientras Recharts es
React declarativo y el camino oficialmente documentado por Shadcn. Estado:
**planificado** (ni Shadcn ni Recharts están instalados aún en `apps/web`).

```bash
pnpm --filter web run dev     # frontend en desarrollo
```
