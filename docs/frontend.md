# Frontend — `apps/web` (Next.js 16.3.5, React 19, Tailwind 4)

> Estado: scaffold `create-next-app` casi intacto (`src/app/page.tsx`).
> Sin dashboard real todavía.

## 1. Alcance previsto

Dashboard de marketing: ingresar prompt, previsualizar (mockup por red),
aprobar/rechazar (human-in-the-loop), más pestaña **Analytics** (ver §2).

## 2. Analytics e Insights por IA (requisito de tesis)

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
