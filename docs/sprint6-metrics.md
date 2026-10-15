# Métricas internas — Sprint 6

Implementación local; no endpoint ni acceso desde la app. Una vista ordinaria de solo lectura devuelve una fila de agregados actuales. No conserva series históricas. No se cambiaron frontend, geolocalización, autenticación ni despliegue.

## Definiciones

| Métrica / columna | Cálculo |
| --- | --- |
| `users_with_recent_location`, `users_with_recent_location_percent` | Usuarios únicos con ubicación actual cuyo `capturedAt` está en `(ahora - 15 minutos, ahora]` y al menos una membresía en grupo no eliminado donde `locationSharingEnabled OR shareLocationMandatorily`. Denominador: **todos los usuarios existentes**, incluidos los que no tienen grupos. |
| `weekly_active_users_observed` | Usuarios con `lastActivityAt` en `(ahora - 7 días, ahora]`. **Actividad explícita observada, no WAU humano exacto**. |
| `groups_with_two_or_more_members` | Grupos con `deletedAt IS NULL` y al menos dos filas `Member`. La unicidad usuario/grupo ya está garantizada por Prisma. |
| `groups_with_poi`, `groups_with_poi_percent` | Grupos activos con POI no eliminado, permanente o temporal con `endTime > ahora`. Temporal sin vencimiento no cuenta; permanente cuenta aunque tenga un endTime legado. |
| `groups_with_events`, `groups_with_events_percent` | Grupos activos con al menos un evento cuyo `deletedAt IS NULL`, incluso eventos pasados. |

Los porcentajes de grupos usan todos los grupos activos. Denominadores auxiliares: `total_users`, `active_groups`. Sin datos, todos los valores son cero. Múltiples grupos, POI o eventos no duplican usuarios/grupos. Las comparaciones usan UTC, compatible con los timestamps Prisma sin zona; el reloj de PostgreSQL es el de inicio de la consulta.

Se reutiliza la duración `LocationTrackingConfig.staleAfter` del frontend (15 minutos), pero **no** su indicador de presencia basado en `lastSeenAt`: un heartbeat no demuestra una captura GPS reciente. Capturas nulas, antiguas o futuras no cuentan. No se leen coordenadas en la vista.

## Actividad: alcance y limitaciones

Un interceptor HTTP posterior al éxito observa una lista cerrada de métodos existentes:

- Login exitoso y logout; cambios de perfil, contraseña y foto.
- Crear, unirse y editar grupos o su imagen; cambiar roles y quitar miembros.
- Crear, editar, cancelar eventos y cambiar su ubicación; configurar/eliminar recordatorios manualmente.
- Crear, editar y eliminar POI; crear cuentas de gastos.

El identificador proviene de la sesión autenticada o del resultado del login; nunca del body. Se excluyen GET, toda la API de ubicación (incluso ajustes de sharing), alta de cuenta, eliminación de cuenta, tokens push, notificaciones, WebSockets y tareas programadas. Los servicios invocados fuera de HTTP no registran actividad. Nuevos métodos quedan excluidos hasta revisar sus consumidores. La lista exacta está en `src/metrics/activity.interceptor.ts`.

Solo el backend no puede distinguir a una persona de un script que ejecuta una acción permitida. Quienes solo abren o consultan la app no aparecen. Por ello esta es una señal conservadora de operaciones explícitas observadas, no un recuento exacto de humanos ni un límite inferior matemático garantizado. El frontend no se modifica para instrumentar interacción.

Se almacena un único `User.lastActivityAt`, inicialmente NULL, sin backfill desde sesiones, GPS ni `updatedAt`. UPDATE parametrizado y condicional: una escritura como máximo por usuario cada 15 minutos (también con concurrencia entre instancias), aunque cada acción elegible ejecuta una consulta por PK. No se guarda una caché de identificadores. `updatedAt` no cambia. La ventana puede subcontar hasta 15 minutos en el borde semanal; no existe historial previo al despliegue y hacen falta siete días para una ventana completa. Fallas de persistencia también pueden subcontar: se conserva la respuesta de negocio y solo se emite un aviso constante, sin detalles personales. La consulta agrega latencia a las acciones elegibles.

## Base de datos y aplicación

- `prisma/schema.prisma`: único campo nullable `User.lastActivityAt`.
- `prisma/migrations/20261015000000_internal_metrics/migration.sql`: campo, esquema privado `bond_metrics` y vista `sprint6`. Sin tablas, coordenadas, triggers, jobs ni índices nuevos.
- `src/metrics/activity.repository.interface.ts` y `activity.prisma.repository.ts`: persistencia encapsulada en Repository.
- `src/metrics/activity.interceptor.ts` y registro en `src/app.module.ts`: observación selectiva sin modificar los guards/controllers/services existentes.
- Pruebas: `src/metrics/activity.interceptor.spec.ts` y `test/metrics.e2e-spec.ts`.

Aplicar la migración con el proceso habitual de Prisma **antes** de desplegar el cliente regenerado y el backend. No se aplicó a ninguna base remota. `prisma db push` no crea esta vista SQL: en entornos nuevos se necesita la migración. Prisma no administra esta vista como modelo.

La vista agrega cada conjunto y usa EXISTS para la membresía de usuarios; no multiplica filas por joins de POI/eventos. El coste es proporcional a las tablas actuales: empezar con refresco de 5 minutos, revisar EXPLAIN con volumen real antes de agregar índices/materialización. No hay consultas periódicas desde NestJS.

## Consultas para Grafana (pendiente de configurar)

Fuente PostgreSQL, formato Table/Stat:

```sql
SELECT * FROM bond_metrics.sprint6;
```

Paneles individuales, usando alias de visualización:

```sql
SELECT users_with_recent_location AS cantidad,
       users_with_recent_location_percent AS porcentaje FROM bond_metrics.sprint6;
SELECT weekly_active_users_observed AS actividad_explicita_semanal_observada FROM bond_metrics.sprint6;
SELECT groups_with_two_or_more_members AS cantidad FROM bond_metrics.sprint6;
SELECT groups_with_poi AS cantidad, groups_with_poi_percent AS porcentaje FROM bond_metrics.sprint6;
SELECT groups_with_events AS cantidad, groups_with_events_percent AS porcentaje FROM bond_metrics.sprint6;
```

Los porcentajes están en escala 0–100. Titular el segundo panel “Actividad explícita semanal observada (aproximación)”. La vista representa el presente, no puede responder una serie histórica por rango de fechas.

## Acceso restringido (ejemplo para el DBA, no ejecutado en producción)

Usar un rol nuevo dedicado sin membresías heredadas, sin superusuario, BYPASSRLS ni permisos sobre tablas fuente. No reutilizar credenciales del backend. Ejemplo que debe adaptarse a los nombres reales y a las políticas de la instalación:

```sql
CREATE ROLE bond_metrics_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE bond TO bond_metrics_reader;
GRANT USAGE ON SCHEMA bond_metrics TO bond_metrics_reader;
GRANT SELECT ON bond_metrics.sprint6 TO bond_metrics_reader;
ALTER ROLE bond_metrics_reader SET default_transaction_read_only = on;
ALTER ROLE bond_metrics_reader SET statement_timeout = '10s';
```

Provisionar la contraseña por el gestor de secretos, TLS y restricciones de red al configurar Grafana. La vista utiliza derechos del propietario, que debe ser un rol administrativo confiable con acceso a las tablas; **no** convertirla a `security_invoker` ni hacer propietario al lector. `security_barrier` y la ausencia de identificadores mantienen la superficie agregada. La migración revoca acceso PUBLIC al esquema/vista. No otorga nada a los usuarios de la app ni a administradores de grupos.

Auditar grants heredados de PUBLIC y roles antes de habilitar la conexión: NOINHERIT/read-only por sí solos no revocan acceso existente a datos. Verificar conectado como lector que SELECT a la vista funciona y SELECT a `public."User"`, `"Location"`, etc. falla; revisar también funciones SECURITY DEFINER accesibles. No otorgar SELECT ON ALL TABLES IN SCHEMA public. Limitar dashboards y datasource a desarrolladores/administradores internos. Los pequeños conteos y diferencias temporales pueden revelar cambios: no publicar el dashboard ni asumir anonimización irreversible.

## Privacidad y Google Play

El único dato personal nuevo es la última fecha de actividad explícita observada. Se sobrescribe sin historial y permanece hasta la siguiente actualización o eliminación de la cuenta; no hay purga a los siete días. La ventana semanal no es el plazo de retención. La eliminación física existente de User elimina también el campo; no se crea una copia separada ni un historial de métricas. Las políticas existentes de backups deben contemplar su eliminación/retención.

No se incorporan IP, IDs de dispositivos, permisos Android, lecturas GPS, SDK, ni logs de acciones individuales. Se reutiliza la ubicación actual únicamente para evaluar su fecha y sharing.

Antes de publicar, revisar y actualizar la política de privacidad para informar la finalidad de analítica interna, uso secundario de la fecha de ubicación, última actividad, acceso restringido, retención, eliminación y contacto. Revisar en Data safety las categorías aplicables (actividad/interacciones de la app, identificadores y ubicación ya recolectada) y la finalidad de Analytics; declarar según los flujos reales, no solo porque la salida sea agregada. Evaluar si la información/consentimiento existente cubre este uso de ubicación sensible y actualizarla si corresponde. Este cambio no valida el consentimiento, los permisos en segundo plano, los proveedores ni todos los flujos de la aplicación; **no constituye una certificación de cumplimiento**.

Fuentes oficiales consultadas el 15/10/2026:
- [Google Play: User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB).

## Reproducción de pruebas

Unitarias: `npm test -- --runInBand`. Esquema: `npx prisma validate`. Formato/lint únicamente sobre los archivos cambiados para evitar modificaciones ajenas.

Integración: preparar una base **local, vacía y terminada en `_test`**, con el esquema Prisma y la migración de la vista. Establecer `DATABASE_URL` a esa base y `RUN_METRICS_DB_TESTS=1`, luego ejecutar:

```text
npm run test:e2e -- --runInBand metrics.e2e-spec.ts
```

Sin esa variable las pruebas de métricas SQL se omiten explícitamente. Las fixtures agregadas se revierten en una transacción; la prueba de actividad borra su usuario sintético al terminar. No apuntar las suites generales existentes a una base compartida.

## Resultados locales (15/10/2026)

- `prisma generate` y `prisma validate`: correctos.
- Unitarias completas: **38 suites, 242 pruebas aprobadas**.
- Integración de métricas en PostgreSQL 16 local: **3 pruebas aprobadas** (agregados, acceso restringido y persistencia limitada). La prueba de permisos necesita un usuario de prueba con CREATEROLE; crea un rol NOLOGIN dentro de una transacción y lo revierte.
- Integración existente de eliminación de cuentas: **6 pruebas aprobadas** usando la base local y valores sintéticos `SUPABASE_URL=http://127.0.0.1:9`, `SUPABASE_SECRET_KEY=local-test-placeholder`. No se utilizaron credenciales ni servicios remotos.
- ESLint de `src/metrics/*.ts` y `test/metrics.e2e-spec.ts`: correcto. Prettier de los TypeScript modificados: correcto.
- Build y e2e general: bloqueados por `@nestjs/schedule` ausente de node_modules, aunque ya declarado en package.json. ESLint sobre app.module también reporta los tipos no resolubles de ese import preexistente. No se cambiaron dependencias ni lockfiles para resolver el entorno.
- Se creó exclusivamente `bond_metrics_s6_test` en `127.0.0.1:55432`. El esquema vacío se preparó con Prisma db push y se ejecutó la porción de vista de la migración (el campo ya lo había creado db push). No se validó el historial completo de migraciones ni se modificaron bases remotas.

Pendiente operativo: completar la instalación de dependencias existente y repetir build/e2e general; aplicar la migración con el proceso habitual al desplegar; revisar política de privacidad/Data safety; provisionar el lector restringido, conexión y paneles internos de Grafana. No se configuró Grafana ni un usuario lector permanente.
