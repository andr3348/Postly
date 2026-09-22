# Módulo de Dashboard

Este módulo expone la lógica y las rutas necesarias para obtener los indicadores clave de rendimiento (KPIs) y las analíticas de las publicaciones dentro del sistema.

## Estructura y Dependencias
El módulo fue generado mediante el CLI de NestJS y consta de los siguientes componentes:

- **DashboardModule (`dashboard.module.ts`)**: Módulo contenedor. 
  - **Nota de integración:** Se importó explícitamente el `PrismaModule` desde la carpeta `shared` (`../shared/prisma/prisma.module.js`) para que el controlador y los servicios tengan acceso al `PrismaService` y, en consecuencia, a la base de datos.
- **DashboardService (`dashboard.service.ts`)**: Contiene la lógica de negocio y analítica.
  - Se implementó el método `getSummaryMetrics()`: Calcula los KPIs generales (total de posts, posts publicados, interacciones totales, impresiones y tasa de *engagement*).
  - Se implementó el método `getPlatformPerformance()`: Agrupa las métricas y su rendimiento separadas por red social (LinkedIn, Facebook, etc.).
- **DashboardController (`dashboard.controller.ts`)**: Controlador (actualmente con su esqueleto base) destinado a exponer los métodos del servicio como endpoints (ej. `@Get('summary')`).

## Inyección de Base de Datos
El servicio utiliza el `PrismaService` centralizado (`../shared/prisma/prisma.service`). Esto es esencial porque el paquete `@postly/database` se encarga por detrás de inicializar el cliente con el adaptador de Postgres adecuado para Prisma 7, por lo que este módulo del API simplemente consume los tipos y métodos sin preocuparse por la conexión subyacente.
