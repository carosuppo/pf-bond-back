# AGENTS.md

## 1. Proyecto

Aplicación móvil para grupos privados (familias, amigos y círculos sociales) que permite gestionar eventos, calendarios, ubicaciones, recordatorios y puntos de interés.

Arquitectura cliente-servidor:

- Frontend Flutter
- Backend NestJS exponiendo una API REST
- PostgreSQL como base de datos

---

## 2. Objetivo

Desarrollar un backend modular, mantenible y escalable mediante una estricta separación entre presentación, negocio y persistencia.

La prioridad es mantener consistencia con la arquitectura existente antes que introducir nuevos patrones.

---

## 3. Stack

- NestJS
- Node.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Jest
- Docker / Docker Compose
- Git + GitHub

---

## 4. Arquitectura

El backend utiliza una arquitectura en capas.

```
Controller (API)
        ↓
Service / Business Logic
        ↓
Repository / Persistence
        ↓
Prisma
        ↓
PostgreSQL
```

Reglas:

- Controllers únicamente reciben solicitudes y devuelven respuestas.
- Toda la lógica de negocio pertenece a la capa de negocio.
- La persistencia sólo accede a la base de datos.
- Nunca mezclar responsabilidades entre capas.

---

## 5. Convenciones

- Todo el código debe estar en inglés.
- Utilizar camelCase para variables, métodos y propiedades.
- Mantener nombres descriptivos y código autodocumentado.
- Seguir la estructura y convenciones existentes del proyecto antes de crear nuevas.

---

## 6. Base de datos

- Prisma ORM como única forma de acceso a la base.
- PostgreSQL ejecutándose mediante Docker.
- Entidades principales:
  - User
  - Group
  - Location
  - Event
  - Calendar
  - Reminder
  - PointOfInterest
- Siempre respetar el esquema existente.
- Cuando exista, utilizar Soft Delete (`deletedAt`) en lugar de eliminaciones físicas.

---

## 7. Patrones de desarrollo

- Un endpoint implementa una única funcionalidad.
- Las validaciones y reglas de negocio pertenecen a la capa de negocio.
- Los repositorios sólo realizan operaciones de persistencia.
- Priorizar reutilización antes que duplicar código.
- Mantener métodos pequeños y con una única responsabilidad.
- Seguir el patrón utilizado por módulos similares.

---

## 8. Reglas obligatorias

- No agregar lógica de negocio en Controllers.
- No acceder a Prisma fuera de la capa de persistencia.
- No duplicar código existente.
- No usar comentarios para explicar código evidente.
- Comentar únicamente reglas de negocio o decisiones técnicas no autoexplicativas.
- Escribir código claro antes que código documentado.

---

## 9. Nuevo endpoint

Para agregar una nueva funcionalidad:

1. Implementar la lógica de negocio.
2. Crear el Controller correspondiente.
3. Agregar la persistencia necesaria.
4. Mantener la separación entre capas.
5. Escribir pruebas unitarias e integración con Jest.
6. Respetar las convenciones existentes del proyecto.

---

## 10. Manejo de errores

Flujo estándar:

```
Business Rule
        ↓
Exception
        ↓
HTTP JSON Response
```

Las reglas de negocio deben lanzar excepciones específicas y las respuestas HTTP deben ser consistentes.

---

## 11. Checklist

Antes de considerar una tarea terminada:

- ¿Se respetó la arquitectura por capas?
- ¿La lógica está en la capa correcta?
- ¿Se reutilizó código existente?
- ¿No hay responsabilidades mezcladas?
- ¿Se respetan inglés y camelCase?
- ¿Existen pruebas con Jest?
- ¿El código es claro y consistente con el resto del proyecto?

---

## 12. Instrucciones para el agente

Al generar código para este proyecto:

- Analizar primero el patrón existente antes de proponer una solución.
- Mantener consistencia con la arquitectura y el estilo del repositorio.
- Reutilizar componentes, servicios y utilidades existentes cuando sea posible.
- No introducir nuevas librerías o patrones sin una justificación clara.
- Si falta contexto para implementar correctamente una funcionalidad, solicitar la información necesaria en lugar de asumir.
- Explicar brevemente las decisiones de diseño cuando no sean evidentes.
- Generar únicamente el código necesario, evitando sobreingeniería.