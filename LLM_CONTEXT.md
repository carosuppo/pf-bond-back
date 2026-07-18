# LLM_CONTEXT.md

## 1. Proyecto

Este proyecto es un backend monolítico privado para Bond, una plataforma diseñada para coordinar grupos como familias, amigos y equipos de trabajo. Expone una API REST consumida por las aplicaciones oficiales del proyecto.

## 2. Objetivo

El objetivo es mantener una base de código consistente, mantenible y escalable. Ante varias soluciones válidas, se debe priorizar la que mejor respete la separación de responsabilidades y los patrones existentes, evitando sugerir nuevas abstracciones, librerías o refactorizaciones que no hayan sido solicitadas.

## 3. Cómo interpretar el contexto

Al no tener acceso directo al repositorio, basá tus respuestas únicamente en este documento y en el código provisto en el chat, si es que hay uno. Si una tarea requiere conocer un archivo no compartido (ej. un Service, un Controller, una interfaz o el schema.prisma), solicitálo explícitamente en lugar de asumir su estructura o comportamiento.

## 4. Arquitectura

El proyecto implementa una Arquitectura en Capas estricta.

Flujo de una petición:

HTTP Request
↓
Controller (Adapta HTTP, recibe DTOs)
↓
Service (Lógica de negocio)
↓
Repository Interface (Contrato de persistencia)
↓
Repository (Implementación con Prisma)
↓
Database (PostgreSQL)

## 5. Convenciones del proyecto

Responsabilidades: Controllers no tienen lógica de negocio ni acceso a Prisma. Services dependen exclusivamente de interfaces (IRepository). Repositories son los únicos que interactúan con Prisma.

Endpoints: Cada endpoint ejecuta una única operación del Service.

Respuestas: Prohibido exponer modelos de base de datos directamente en las respuestas HTTP; utilizar siempre DTOs.

Nomenclatura:

Archivos: kebab-case (group.controller.ts, create-group.dto.ts)

Clases: PascalCase (GroupService)

Variables: camelCase

Interfaces de Repositorio: Prefijo I (IGroupRepository)

## 6. Modelo de dominio

La persistencia se implementa exclusivamente mediante Prisma y PostgreSQL.

Existe un único archivo schema.prisma.

Reutilizar métodos existentes en los Repositories para evitar consultas duplicadas.

Mantener las migraciones consistentes con el modelo de datos; no modificar modelos sin una necesidad explícita de la tarea.

## 7. Persistencia

Al enviar tus respuestas y código:

Limitate estrictamente al alcance de la tarea solicitada. No realices refactorizaciones ajenas al objetivo.

Prohibido el uso de any, @ts-ignore o @ts-nocheck.

No introduzcas nuevas librerías, abstracciones o patrones sin consultarlo previamente.

Justificá tus decisiones de diseño de forma breve únicamente cuando la solución elegida no sea la más evidente.

## 8. Información que puede ser necesaria

Dependiendo de la tarea, solicitá los siguientes archivos antes de implementar o asumir una solución si no están en el contexto:

schema.prisma

Controller

Service

Interfaz del Repository (IModuleRepository)

Repository concreto (ModuleRepository)

DTOs asociados a la operación
