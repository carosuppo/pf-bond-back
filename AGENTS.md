## 1. Proyecto

Backend monolítico privado para Bond, una plataforma diseñada para coordinar grupos como familias, amigos y equipos de trabajo. Expone una API REST consumida por las aplicaciones oficiales del proyecto.

## 2. Objetivo

Mantener un backend escalable y mantenible. Todas las implementaciones nuevas deben respetar la separación de capas siguiendo los patrones ya existentes antes de introducir nuevas soluciones.

## 3. Stack

- NestJS
- Node.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Docker Compose
- npm
- Jest
- ESLint
- Prettier

## 4. Arquitectura

El proyecto sigue una Arquitectura en Capas con una separación clara entre Controllers, Services, Repositories e Infrastructure.

```text
Controller
    ↓
Service
    ↓
Repository Interface
    ↓
Repository
    ↓
Prisma
    ↓
Database
```

## 5. Convenciones

- Un endpoint corresponde a una única operación del Service.
- Los Controllers únicamente adaptan la petición HTTP.
- Los Repositories implementan únicamente persistencia.
- Los Services dependen de interfaces de Repository, nunca de implementaciones concretas.
- Mantener la estructura y nomenclatura existente antes de crear nuevos patrones.

Convenciones de nombres:

- DTOs: `create-group.dto.ts`
- Controllers: `group.controller.ts`
- Services: `group.service.ts`
- Repository Interface: `IGroupRepository`
- Repository: `GroupRepository`
- Variables: `camelCase`
- Clases: `PascalCase`
- Archivos: `kebab-case`

## 6. Reglas obligatorias

- Toda operación sobre la base de datos debe realizarse mediante un Repository.
- No exponer entidades o modelos de base de datos directamente en las respuestas HTTP.

## 7. Base de datos

La persistencia se implementa exclusivamente mediante Prisma y PostgreSQL.

- Utilizar un único `schema.prisma`.
- Mantener las consultas encapsuladas en los Repositories.
- Evitar consultas duplicadas.
- Mantener las migraciones consistentes con el modelo de datos.

## 8. Comportamiento esperado del agente

Antes de implementar cambios:

- Analizar la estructura y los patrones existentes del módulo.
- Reutilizar código, Services y Repositories antes de crear nuevos.
- Mantener consistencia con la arquitectura y las convenciones del proyecto.
- Limitar los cambios al alcance de la tarea solicitada.
- No introducir nuevas librerías, patrones o abstracciones sin que se solicite explícitamente.
- Si existen varias soluciones válidas, elegir la que mejor se adapte al diseño actual del proyecto.
- Si falta información para implementar correctamente una solución, solicitar aclaraciones en lugar de asumir requisitos.

## 9. Qué NO hacer

- No usar `any`, `@ts-ignore` ni `@ts-nocheck`.
- No modificar la arquitectura del proyecto.
- No cambiar nombres, estructura o convenciones existentes.
- No agregar código innecesario para resolver una tarea simple.
