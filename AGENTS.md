# Bond Backend

## Proyecto

Backend monolítico privado para Bond. Expone una API REST y un WebSocket consumidos por las aplicaciones oficiales del proyecto.

## Reglas de implementación

- Toda operación de base de datos debe realizarse mediante un Repository.
- Los Services deben depender de interfaces de Repository, nunca de implementaciones concretas.
- Los Controllers no deben contener lógica de negocio ni acceso a Prisma.
- Los Gateways no deben contener lógica de persistencia.
- Un endpoint debe corresponder a una operación clara del Service.
- Las operaciones autenticadas deben utilizar `SessionAuthGuard` y el usuario de la sesión actual.
- No aceptar `userId` desde el body cuando puede obtenerse mediante `CurrentUser`.
- No exponer entidades ni modelos de Prisma directamente en respuestas HTTP.
- Utilizar DTOs, Pipes, Validators y Mappers existentes antes de crear alternativas.
- Mantener las consultas encapsuladas en los Repositories y evitar consultas duplicadas.
- No usar `any`, `@ts-ignore` ni `@ts-nocheck`.
- No introducir librerías, abstracciones o patrones nuevos sin una necesidad concreta.

## Configuración y ejecución

Utilizar `.env.example` como referencia y crear un `.env` local sin versionarlo.

Desde `bond-back`:

```bash
npm install
npx prisma generate
npm run start:dev
```

Para ejecutar backend y PostgreSQL con Docker Compose:

```bash
docker compose up --build
```

Para ejecutar solamente PostgreSQL:

```bash
docker compose up postgres -d
```

## Validación

Ejecutar las validaciones relacionadas con el cambio:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e
npm run test:cov
npm run lint
npm run format
```

Si el cambio afecta persistencia, autenticación, REST o WebSocket, ejecutar también las pruebas específicas de ese flujo y validar el consumidor frontend cuando corresponda.
