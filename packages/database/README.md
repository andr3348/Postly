# Configuración Inicial de Base de Datos y Prisma

Este documento detalla los pasos y configuraciones implementadas durante la creación del esquema inicial y la población de datos (seed).

## Esquema de Prisma (`prisma/schema.prisma`)
Se definieron los modelos core (`User`, `Publication`, `PublicationTarget`, `TargetMetric`) y sus respectivos enumeradores.

**Consideraciones importantes sobre Prisma 7:**
- **Driver Adapter:** A partir de Prisma 7, ya no se soporta el atributo `url = env("DATABASE_URL")` directamente dentro del bloque `datasource db` en el `schema.prisma`. La configuración se maneja mediante adaptadores explícitos (en nuestro caso, `PrismaPg`).
- **Generación de Cliente:** Para mantener la compatibilidad con el resto del monorepo, el cliente de Prisma está configurado para generarse en el directorio local:
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"
  }
  ```

## Seed de Datos (`prisma/seed.ts`)
El script `seed.ts` se encarga de poblar la base de datos con un usuario inicial y una publicación de prueba con métricas asociadas.

**Detalles de la implementación:**
- **Instanciación:** Para evitar errores de inicialización por falta del adaptador de conexión en Prisma 7, el script de seed no crea un nuevo `PrismaClient` vacío. En su lugar, importa la instancia global y preconfigurada que el propio paquete expone desde `../src/index.js`.
- **Comando:** Se actualizó el `package.json` para ejecutar el script utilizando `tsx` en lugar de `ts-node`, ya que `tsx` forma parte de las dependencias de desarrollo y es mucho más rápido.
  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```

Para ejecutar el seed nuevamente:
```bash
pnpm seed
```
