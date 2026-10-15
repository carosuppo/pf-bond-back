# Métricas internas — Sprint 6

## Corrección de ubicación y actividad en primer plano

La vista privada `bond_metrics.sprint6` conserva las tres métricas de grupos sin cambiar sus cálculos. No se agregaron tablas, campos, permisos Android ni lecturas GPS. No se configuró Grafana ni se hicieron operaciones Git.

| Columna | Definición |
| --- | --- |
| `users_sharing_location` | Denominador: usuarios únicos con al menos un Member en un Group no eliminado, donde `locationSharingEnabled OR shareLocationMandatorily`. Cuenta incluso si no tienen Location o capturedAt. |
| `users_with_recent_location` | Numerador: usuarios del conjunto anterior con Location actual y `capturedAt` en `(ahora - 15 minutos, ahora]`. |
| `users_with_recent_location_percent` | Numerador / denominador × 100; cero cuando nadie comparte. No usa `lastSeenAt`. |
| `weekly_active_users_foreground` | Usuarios únicos con `lastActivityAt` en `(ahora - 7 días, ahora]`, registrado por una señal autenticada de Flutter en primer plano. |
| `groups_with_two_or_more_members` | Sin cambios: grupos no eliminados con al menos dos Member. |
| `groups_with_poi`, `groups_with_poi_percent` | Sin cambios: grupos activos con POI no eliminado, permanente o temporal con `endTime > ahora`. Denominador: todos los grupos activos. |
| `groups_with_events`, `groups_with_events_percent` | Sin cambios: grupos activos con al menos un evento no eliminado, incluso pasado. Denominador: todos los grupos activos. |

`total_users` se conserva como total auxiliar por compatibilidad, pero **ya no es el denominador de ubicación**. `active_groups` también se conserva. La vista devuelve una fila de ceros sin datos; todas las fechas se comparan en UTC. No devuelve usuarios individuales, coordenadas ni actividad histórica.

## Señal de actividad

`POST /user/activity`, sin body, utiliza `SessionAuthGuard` y `CurrentUser`. La identidad proviene exclusivamente de la sesión; cualquier userId enviado en el body se ignora. Responde 204 sin datos. No es un endpoint de consulta de estadísticas. No permite elegir fecha, usuario o ubicación. Los errores de persistencia responden 503 con texto constante, sin detalles personales.

Se eliminó el interceptor de operaciones. Crear eventos, iniciar sesión por HTTP, hacer GET, recibir notificaciones, heartbeats, GPS automático, WebSockets y jobs no escriben actividad por sí mismos. El endpoint es el único punto de entrada del registro.

Flutter instancia un único `ForegroundActivityService` en la raíz de la app, observa AuthProvider y el ciclo de vida, y envía exclusivamente cuando existe sesión no expirada y el estado es `AppLifecycleState.resumed`. Registra login, restauración válida y retorno al primer plano aunque el usuario solo mire el mapa o calendario. Mientras permanece en primer plano, intenta como máximo una vez cada cinco minutos. Cambios repetidos de estado/notificaciones de AuthProvider no duplican señales y nunca hay dos solicitudes simultáneas.

En `inactive`, `hidden`, `paused` o `detached` cancela el temporizador. También lo cancela durante cambios de autenticación, logout, eliminación de cuenta, expiración y dispose. Si vuelve al primer plano antes de cinco minutos, espera el intervalo restante. Cambiar de sesión reinicia ese límite local. Las fallas se absorben sin alterar autenticación, navegación ni UI; reintenta en el intervalo habitual solo si continúa en primer plano. Reutiliza ApiClient y su timeout de 20 segundos, sin servicio Android adicional.

Repository conserva un UPDATE parametrizado por PK con condición atómica: como máximo una escritura cada cinco minutos por usuario, también con solicitudes concurrentes o varios dispositivos. Cada señal puede ejecutar una consulta, pero las repetidas no modifican filas. No cambia `updatedAt`.

## Migración y transición

La migración anterior `20261015000000_internal_metrics` se conserva intacta. Se comprobó localmente que `bond_metrics_s6_test` ya tenía la vista y el campo, pero no `_prisma_migrations` (preparada previamente con db push y SQL). No se consultaron bases compartidas/remotas y no se puede afirmar qué migraciones tienen aplicadas; por ello se agrega **20261015010000_foreground_activity_metrics**.

La nueva migración, transaccional:

1. Reinicia a NULL las fechas anteriores de `lastActivityAt`: representaban operaciones y no demuestran uso en primer plano. No toca otros datos de usuario ni `updatedAt`.
2. Renombra `weekly_active_users_observed` a `weekly_active_users_foreground`.
3. Reemplaza la vista y agrega `users_sharing_location`, conservando propietario, permisos y `security_barrier`. No hace DROP VIEW ni cambia las tres métricas de grupos.

Al desplegar, detener primero las instancias antiguas que aún ejecuten el interceptor; aplicar las migraciones pendientes mediante el proceso habitual de Prisma; iniciar el backend nuevo y distribuir Flutter actualizado. No mezclar instancias antiguas durante la transición, porque podrían volver a escribir señales de operaciones. Nunca reaplicar manualmente la migración correctiva: borraría señales válidas nuevas. La ventana semanal se completa después de siete días. Los clientes anteriores no enviarán señales de primer plano. `prisma db push` por sí solo no administra esta vista.

## Grafana y acceso

Consultas actualizadas (format Table/Stat, porcentajes 0–100):

```sql
SELECT users_with_recent_location AS numerador,
       users_sharing_location AS denominador,
       users_with_recent_location_percent AS porcentaje
FROM bond_metrics.sprint6;

SELECT weekly_active_users_foreground FROM bond_metrics.sprint6;

SELECT groups_with_two_or_more_members,
       groups_with_poi, groups_with_poi_percent,
       groups_with_events, groups_with_events_percent
FROM bond_metrics.sprint6;
```

Pendiente: actualizar el nombre de actividad en las consultas, crear la conexión y paneles internos. No hay series históricas. Usar un lector dedicado sin superusuario, BYPASSRLS, membresías ni permisos de tablas personales. Ejemplo para el DBA, no ejecutado en producción:

```sql
CREATE ROLE bond_metrics_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE bond TO bond_metrics_reader;
GRANT USAGE ON SCHEMA bond_metrics TO bond_metrics_reader;
GRANT SELECT ON bond_metrics.sprint6 TO bond_metrics_reader;
ALTER ROLE bond_metrics_reader SET default_transaction_read_only = on;
ALTER ROLE bond_metrics_reader SET statement_timeout = '10s';
```

Provisionar credenciales fuera del código, TLS y restricciones de red. Conservar derechos del propietario confiable de la vista; no usar security_invoker ni hacer al lector propietario. Auditar permisos heredados de PUBLIC y funciones SECURITY DEFINER: NOINHERIT/read-only no eliminan permisos previos. Verificar que SELECT a User/Location falle. No otorgar SELECT a tablas públicas. Mantener dashboard/datasource restringidos a administradores internos, sin acceso para usuarios normales o administradores de grupos.

## Privacidad y límites

Solo se reutiliza `User.lastActivityAt`, una fecha sobrescrita sin historial. Permanece hasta la próxima actualización o eliminación de cuenta; siete días es la ventana del cálculo, no una purga de retención. La eliminación física existente de User elimina el campo; considerar también los plazos de backups. No se guardan pantallas, acciones, IP, IDs adicionales, coordenadas, sesiones históricas ni logs personales nuevos. La señal solo lleva la autenticación existente y no consulta GPS.

Primer plano no demuestra atención humana: una app abierta sin interacción cuenta por definición. El backend confía en la señal del cliente autenticado y no puede probar el estado real del dispositivo ni evitar que un cliente modificado imite la señal. Sin conectividad, con errores, clientes antiguos o cierres antes del envío puede haber subregistro. La frecuencia de muestreo y el límite de escrituras introducen unos minutos de incertidumbre en el borde semanal; dos señales cercanas al límite del servidor pueden diferir hasta un intervalo adicional por latencia. Una petición ya en vuelo al salir de primer plano o cerrar sesión no se puede retirar con ApiClient; puede completarse, pero no genera nuevos envíos ni reinicia el temporizador en segundo plano.

Actualizar privacidad/Data Safety para describir última actividad en primer plano, finalidad de analítica interna, retención y eliminación. Revisar las categorías de actividad/interacciones e identificadores y el uso de la ubicación ya existente para el agregado; no declarar que no se recolectan datos solo porque la salida sea agregada. No requiere permisos Android ni acceso adicional a ubicación. No se certifica cumplimiento integral de publicación.

Fuentes oficiales revisadas en esta sesión:
- [Google Play: User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-GB).

## Archivos y pruebas

Backend: se reemplazó `src/metrics/activity.interceptor.ts` y su prueba por `activity.controller.ts`, `activity.service.ts` y `activity.controller.spec.ts`; se ajustaron `activity.prisma.repository.ts`, `app.module.ts`, `test/metrics.e2e-spec.ts`; se agregó la migración correctiva. `schema.prisma` y la interfaz Repository no cambian.

Flutter: `lib/main.dart` conecta y libera el nuevo `lib/features/metrics/services/foreground_activity_service.dart`; `test/features/metrics/foreground_activity_service_test.dart` cubre ciclo de vida, sesiones, periodicidad, deduplicación y errores. No cambian servicios de ubicación, notificaciones ni negocio.

Integración SQL: usar una base local vacía terminada en `_test`, con esquema y ambas migraciones de métricas, establecer `DATABASE_URL` local y `RUN_METRICS_DB_TESTS=1`, ejecutar `npm run test:e2e -- --runInBand metrics.e2e-spec.ts`. Las fixtures se revierten; el usuario de prueba debe poder crear un rol NOLOGIN transaccional para verificar acceso restringido. Nunca apuntar pruebas a bases compartidas.

### Validaciones locales de esta corrección (15/10/2026)

- Backend completo: 38 suites y 232 pruebas aprobadas. Después se agregó una prueba de sesión expirada: la suite final del endpoint pasó **6/6**.
- PostgreSQL local: **3/3** pruebas de métricas aprobadas, incluidos usuarios sin Location que sí comparten, usuarios solo en grupos eliminados, deduplicación, cero denominador con usuarios existentes, capturedAt antiguo/nulo/futuro, permisos y escrituras concurrentes. Se aplicó la nueva migración únicamente a `bond_metrics_s6_test` en `127.0.0.1:55432`.
- Flutter: **166/166** pruebas de la suite completa aprobadas, incluidas las diez nuevas de actividad.
- Análisis Flutter de main.dart, servicio y prueba: sin problemas. Formato de los archivos Dart nuevos: correcto.
- Prisma validate, ESLint de métricas/prueba SQL y Prettier de los TypeScript modificados: correctos.
- Comparación textual de los CTE de miembros, POI, eventos y grupos: idénticos a la migración anterior.
- Build backend: bloqueado por la dependencia preexistente `@nestjs/schedule` ausente en node_modules; no se cambiaron package.json/lockfiles. La prueba e2e general de AppModule tiene el mismo impedimento conocido. No se compiló APK ni se realizó una prueba manual en un dispositivo Android.

Pendientes operativos: completar la instalación existente para validar build/e2e general; aplicar la migración con las instancias antiguas detenidas; distribuir el cliente actualizado; revisar privacidad/Data Safety y actualizar las consultas de Grafana cuando se configure. No se modificaron bases compartidas ni remotas.
