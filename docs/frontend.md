# Frontend — `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)

> Estado: Autenticación base completada (Login/Registro). Arquitectura modular definida.
> Dashboard real en desarrollo (solo cuenta con placeholder protegido).

## 1. Arquitectura y Autenticación (Implementado)

Para mantener una alta cohesión, la aplicación sigue una **Arquitectura Orientada a Funcionalidades (Feature-Driven Architecture)**, muy alineada a los principios Clean Architecture del backend:

- **`src/app/`**: Se reserva estrictamente para el enrutamiento (Next.js App Router). Separa flujos usando Route Groups como `(auth)` para compartir el layout de los formularios, y `/dashboard` para las vistas protegidas.
- **`src/features/`**: Alberga la lógica y componentes por dominio de negocio. Actualmente incluye el módulo `auth` con sus componentes (`LoginForm.tsx`, `RegisterForm.tsx`) y Server Actions (`actions.ts`).
- **`src/shared/`** (Próximamente): Utilidades, componentes UI base (Shadcn) y lógica global.

### Flujo de Integración con NestJS

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
