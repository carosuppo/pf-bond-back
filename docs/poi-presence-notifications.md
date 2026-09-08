# Notificar ingreso/egreso de puntos de interés

Implementado en ambos repositorios sobre `feature/point-of-interest`. Sin commit, push ni PR. La migración se entrega sin aplicarla a la base de datos existente.

## Backend

- `User.notificationsEnabled`: habilitación global de push, predeterminada en true.
- `Member.notificationsEnabled`: mute de todas las notificaciones del grupo, predeterminado en true; independiente de compartir ubicación.
- Enum `NotificationType`: POINT_OF_INTEREST_CREATED, POINT_OF_INTEREST_UPDATED, POINT_OF_INTEREST_ENTERED y POINT_OF_INTEREST_EXITED.
- `MemberNotificationPreference`: memberId, type, enabled, timestamps; único por memberId/type; borrado en cascada. Ausencia de fila equivale a true. Actualización por upsert.
- `PointOfInterestPresence`: memberId, pointOfInterestId, isInside, timestamps. Único por miembro/POI, índice por POI y cascadas. No guarda historial.
- Migración: `prisma/migrations/20260908000000_notification_preferences_and_poi_presence/migration.sql`. Sólo agrega columnas, enum, tablas, índices y restricciones. Usuarios y miembros existentes quedan habilitados por defecto.
- API con SessionAuthGuard y CurrentUser. Nunca toma userId del body. Los cambios de grupo/tipo comprueban membresía actual y grupo activo.
- Los destinatarios se consultan en cada evento: usuario y grupo activos, membresía actual, actor excluido, global y grupo habilitados y ausencia de preferencia false para el tipo. Se conservan múltiples dispositivos y eliminación de tokens inválidos.
- El lookup de dispositivos vuelve a comprobar usuario activo y preferencia global, también para envíos directos.
- El listener existente de creación/modificación ahora usa `sendToGroupExceptUserByType` y recibe también los eventos de ingreso/egreso; no hay otro sistema de push.
- `LocationService.updateCurrentLocation` coordina persistencia y evaluación. Heartbeat no evalúa presencias.
- `PointOfInterestPresenceService` calcula Haversine con radio terrestre 6.371.000 metros. Sólo procesa grupos activos con sharing personal u obligatorio efectivo.
- Primera muestra: `isInside = distance <= radius`, sin evento.
- Histéresis exacta: `margin = min(max(5, radius * 0.10), 20, radius * 0.25)`. Afuera entra cuando `distance <= radius - margin`; adentro sale cuando `distance >= radius + margin`; entre límites conserva el estado.
- Persistencia antes de emisión. Inserción inicial con unique/skipDuplicates; transición con update condicional por id de presencia y estado anterior. Transacciones y bloqueos de filas coordinan evaluaciones y resets. Se vuelve a comprobar sharing y versión del POI antes de guardar.
- Desactivar sharing personal limpia las presencias si deja de ser efectivo. Desactivar sharing obligatorio limpia las de miembros sin sharing personal. Reactivar establece un nuevo baseline silencioso.
- Cambiar realmente radio/latitud/longitud limpia presencias en la misma transacción que actualiza el POI. Nombre/descripción o geometría idéntica no limpian. Soft delete elimina sus presencias.
- Silenciar no detiene la detección ni almacena notificaciones para enviarlas después.
- Eventos nuevos: `point-of-interest.entered` / `PointOfInterestEnteredEvent` y `point-of-interest.exited` / `PointOfInterestExitedEvent`.
- Los errores de FCM se capturan y registran en el listener. Los errores de evaluación se capturan con Logger en LocationService. No revierten ubicación/presencia ni generan rechazos sin manejar.
- La solicitud a FCM comienza por la cadena inmediata de eventos, sin timers, jobs, cron o polling. Las pruebas verifican el envío sin avanzar temporizadores. No se midió una garantía de latencia bajo carga ni la entrega física en Android; requieren la prueba conectada.

### Contrato REST

| Método | Ruta | Body |
|---|---|---|
| GET | /notification/preferences | — |
| PATCH | /notification/preferences/global | {"enabled": false} |
| PATCH | /notification/preferences/group/:groupId | {"enabled": false} |
| PATCH | /notification/preferences/group/:groupId/type | {"type": "POINT_OF_INTEREST_ENTERED", "enabled": false} |

GET devuelve `{enabled, groups: [{groupId, groupName, enabled, types}]}`, sólo con grupos activos actuales. PATCH global/grupo devuelve `{enabled}`; PATCH tipo devuelve `{type, enabled}`. Tipo inválido/booleano inválido produce 400; grupo ajeno produce 403.

### Contenido exacto de las pushes

Ingreso:

- Título: `Ingreso a punto de interés`
- Body: `{memberName} ingresó a "{pointOfInterestName}" en el grupo {groupName}.`

Egreso:

- Título: `Egreso de punto de interés`
- Body: `{memberName} salió de "{pointOfInterestName}" en el grupo {groupName}.`

Data para ingreso (en egreso cambia type a POINT_OF_INTEREST_EXITED):

```json
{
  "type": "POINT_OF_INTEREST_ENTERED",
  "groupId": "3",
  "pointOfInterestId": "8",
  "memberUserId": "7"
}
```

Todos los valores son strings. Los nombres se obtienen del usuario/grupo reales.

## Frontend

- Configuración mantiene Modificar mi perfil y agrega Notificaciones con `Icons.notifications_outlined`.
- Ruta nombrada `/notifications`: `NotificationPreferencesScreen`. La pantalla de grupo se abre mediante MaterialPageRoute y recibe groupId.
- Modelos `NotificationPreferences` y `GroupNotificationPreferences`; service HTTP existente extendido; `NotificationPreferencesProvider` con ChangeNotifier.
- El provider pertenece a la ruta y se carga desde backend al abrirla; no se guarda en preferencias locales ni se comparte entre sesiones.
- Switch global y mute de grupo conservan todos los valores específicos. Global OFF deshabilita las filas de grupo; grupo OFF deshabilita los switches de tipo.
- Cuatro tipos con los textos solicitados. Cambios optimistas, indicador de guardado, error visible y rollback. Las solicitudes de modificación simultáneas se bloquean.
- Carga, error con Reintentar, lista vacía y refresco manual; al volver del detalle se recarga la lista desde backend.
- `PushNotificationData` incorpora memberUserId en parseo/serialización y sigue aceptando tipos genéricos. No se agrega navegación al tocar la push.
- Foreground tracking, TaskHandler, heartbeat, geolocator, flutter_foreground_task, AndroidManifest, stopWithTask, allowAutoRestart y WebSocket no fueron modificados.

## Prueba manual con Thunder Client

### Preparar backend y dispositivo

1. Desde `Back/pf-bond-back`, aplicar la migración en la base configurada cuando corresponda:
   ```powershell
   npx.cmd prisma migrate deploy
   npx.cmd prisma generate
   npm.cmd run build
   npm.cmd run start:dev
   ```
   No usar migrate reset ni db push con accept-data-loss.
2. Configurar Firebase con la configuración existente del backend. Mantener el celular con Bond y la sesión de `prueba2@gmail.com`; conceder permiso de notificaciones. El login de la app registra su token mediante el flujo existente.
3. Usar como `baseUrl` el backend real, por ejemplo `http://localhost:3000` en Thunder Client. No hay prefijo /api en el código actual. El celular necesita la dirección accesible del backend en su configuración.
4. Evitar que otro celular logueado como `prueba@gmail.com` publique GPS real durante la simulación. Cerrar sesión en ese celular; quitar de recientes no detiene el tracking. El receptor prueba2 puede mantener su tracking habitual.
5. Crear variables en Thunder Client: `baseUrl`, `actorToken`, `receiverToken`, `groupId`, `pointId`.
6. `POST {{baseUrl}}/user/login`, JSON:
   ```json
   {"email": "prueba@gmail.com", "password": "CONTRASEÑA_REAL"}
   ```
   Copiar sessionToken de la respuesta a actorToken. Repetir para prueba2 y guardar receiverToken si se quieren probar preferencias vía HTTP. Usar contraseñas reales; no se incluyen credenciales en este documento.
7. Cada request autenticada lleva `Authorization: Bearer {{actorToken}}` o receiverToken según se indique y `Content-Type: application/json`.

### Obtener grupo y activar sharing

1. Con actorToken, `GET /group`. Buscar `prueba grupo 1` y guardar su id real como groupId.
2. Con receiverToken, `GET /group` y confirmar que también aparece ese id. Si falta alguna membresía, usar el código de invitación del grupo con `POST /group/join`, body `{"invitationCode":"CODIGO_REAL"}`.
3. Con actorToken, `GET /location/sharing`. Revisar effectiveLocationSharing para groupId.
4. Si hace falta, `PUT /location/group/{{groupId}}/sharing`, body `{"enabled":true}`.
5. Con receiverToken, habilitar global y grupo por PATCH y los cuatro tipos por sus PATCH; también puede hacerse desde Configuración → Notificaciones.

### Crear un POI nuevo

Con actorToken, `POST /group/{{groupId}}/point-of-interest`:

```json
{
  "name": "Colegio prueba ingreso",
  "latitude": -34.6037,
  "longitude": -58.3816,
  "radius": 100
}
```

Guardar id de respuesta como pointId. La push de creación puede llegar ahora: es distinta de una push de ingreso. El POI nuevo garantiza ausencia de presence anterior.

### Simular movimientos

Todos los pasos usan actorToken y `PUT /location/current`.

| Paso | Latitude | Longitude | Accuracy | Resultado para prueba2 |
|---|---:|---:|---:|---|
| Baseline afuera | -34.6052 | -58.3816 | 5 | Sin push de movimiento |
| Ingreso | -34.6037 | -58.3816 | 5 | Una push de ingreso |
| Permanencia | -34.6037 | -58.3816 | 5 | Sin nueva push |
| Egreso | -34.6052 | -58.3816 | 5 | Una push de egreso |
| Permanencia afuera | -34.6052 | -58.3816 | 5 | Sin nueva push |

Body para afuera:

```json
{"latitude": -34.6052, "longitude": -58.3816, "accuracy": 5}
```

Body para adentro:

```json
{"latitude": -34.6037, "longitude": -58.3816, "accuracy": 5}
```

Si el nombre del usuario es prueba, el body será `prueba ingresó a "Colegio prueba ingreso" en el grupo prueba grupo 1.` y luego `prueba salió de "Colegio prueba ingreso" en el grupo prueba grupo 1.`. Si tiene otro nombre en su perfil, se usa ese nombre. El actor no recibe sus propios movimientos.

### Jitter reproducible

Radio 100 m implica umbral de ingreso 90 m y de egreso 110 m. Longitude siempre -58.3816, accuracy 5.

- Partiendo afuera, enviar latitude -34.604680, -34.604617, -34.604590, -34.604563 (aproximadamente 109, 102, 99 y 96 m): sin ingreso.
- Enviar -34.604499 (aproximadamente 89 m): un ingreso.
- Enviar -34.604545, -34.604608, -34.604653 (aproximadamente 94, 101 y 106 m): sin egreso.
- Enviar -34.604698 (aproximadamente 111 m): un egreso.

### Mute por grupo

1. Receptor: Configuración → Notificaciones → prueba grupo 1 → Notificaciones de este grupo OFF.
2. Actor: afuera → adentro. No llega push, pero la presencia cambia.
3. Receptor: reactivar grupo.
4. Actor: repetir adentro. No llega aviso retroactivo.
5. Actor: afuera. Llega egreso si el tipo está habilitado.

Equivalente HTTP con receiverToken: `PATCH /notification/preferences/group/{{groupId}}`, `{"enabled":false}` y luego true.

### Mute por tipo

1. Receptor: grupo/global ON; desactivar sólo Ingresos a puntos de interés.
2. Actor: partir afuera e ingresar. No llega ENTERED.
3. Actor: salir. Sí llega EXITED.
4. Repetir con CREATED/UPDATED: desactivar un tipo, crear/modificar un POI, comprobar ausencia; reactivarlo y repetir una nueva operación.

Equivalente HTTP: `PATCH /notification/preferences/group/{{groupId}}/type` con `{"type":"POINT_OF_INTEREST_ENTERED","enabled":false}`.

### Mute global

1. Receptor: Notificaciones de Bond OFF (o PATCH global enabled false).
2. Actor: generar transiciones reales. No llegan pushes.
3. Receptor: reactivar. Comprobar que los tipos conservan sus valores.
4. Repetir última posición: no llega push retroactiva. Generar una transición nueva: vuelve a llegar.

### Sharing deshabilitado y reactivado

1. Actor dentro del POI.
2. Revisar que shareLocationMandatorily sea false. Si es true, el admin debe usar `PUT /group/{{groupId}}` con `{"shareLocationMandatorily":false}`; el backend actual rechaza desactivar el sharing personal mientras es obligatorio.
3. Con actorToken, `PUT /location/group/{{groupId}}/sharing`, `{"enabled":false}`.
4. Enviar ubicación afuera. Si no hay otros grupos con sharing efectivo, el endpoint devuelve 403 según la política preexistente; si hay otros, publica en ellos pero no evalúa este grupo.
5. Reactivar sharing del grupo con enabled true. Enviar afuera: baseline sin egreso retroactivo.
6. Enviar adentro: nueva transición con push.

### Geometría, nombre y borrado

- Establecer baseline y modificar radio con `PATCH /group/{{groupId}}/point-of-interest/{{pointId}}`, `{"radius":120}`. Siguiente muestra: baseline sin movimiento. Repetir cambiando latitud/longitud.
- Cambiar sólo nombre: no reinicia baseline; la próxima transición real sigue notificando.
- `DELETE /group/{{groupId}}/point-of-interest/{{pointId}}`: soft delete y limpieza; nuevas ubicaciones no producen movimientos de ese POI.

### Membresía y latencia

- Intentar modificar preferencias de un grupo ajeno debe devolver 403.
- Al consultar preferencias sólo aparecen grupos actuales activos. El repositorio no expone una ruta para abandonar/eliminar una membresía en esta rama: no inventar un endpoint para esa prueba. El filtrado de membresía actual está cubierto en tests de repositorio.
- Medir el intervalo entre detección del backend y llamada a Firebase con debugger/trazas en `PointOfInterestPresenceService` y `FirebasePushService.sendToTokens`. Debe comenzar inmediatamente, sin esperar un temporizador. El tiempo de renderizado del celular depende de FCM/Android.
- Verificar recepción con app abierta, en background y quitada de recientes. Estas pruebas físicas no fueron ejecutadas automáticamente.

## Archivos creados/modificados

### Backend

- `prisma/schema.prisma` (modificado)
- `src/group/repository/group.prisma.repository.ts` (modificado)
- `src/location/bnd-59.location.service.spec.ts` (modificado)
- `src/location/location.module.ts` (modificado)
- `src/location/location.service.spec.ts` (modificado)
- `src/location/location.service.ts` (modificado)
- `src/location/repository/location.prisma.repository.ts` (modificado)
- `src/notification/events/point-of-interest-created.listener.spec.ts` (modificado)
- `src/notification/events/point-of-interest-created.listener.ts` (modificado)
- `src/notification/notification.controller.ts` (modificado)
- `src/notification/notification.module.ts` (modificado)
- `src/notification/notification.service.ts` (modificado)
- `src/notification/repository/device-push-token.repository.interface.ts` (modificado)
- `src/notification/repository/prisma-device-push-token.repository.ts` (modificado)
- `src/point-of-interest/repository/point-of-interest.prisma.repository.ts` (modificado)
- `docs/poi-presence-notifications.md` (nuevo)
- `prisma/migrations/20260908000000_notification_preferences_and_poi_presence/migration.sql` (nuevo)
- `src/notification/dto/notification-preferences.dto.ts` (nuevo)
- `src/notification/events/point-of-interest-entered.event.ts` (nuevo)
- `src/notification/events/point-of-interest-exited.event.ts` (nuevo)
- `src/notification/events/point-of-interest-movement.listener.spec.ts` (nuevo)
- `src/notification/notification-preferences.service.spec.ts` (nuevo)
- `src/notification/notification-preferences.service.ts` (nuevo)
- `src/notification/repository/notification-preferences.repository.interface.ts` (nuevo)
- `src/notification/repository/notification-recipient.repository.spec.ts` (nuevo)
- `src/notification/repository/prisma-notification-preferences.repository.ts` (nuevo)
- `src/point-of-interest/presence/point-of-interest-presence.prisma.repository.ts` (nuevo)
- `src/point-of-interest/presence/point-of-interest-presence.repository.interface.ts` (nuevo)
- `src/point-of-interest/presence/point-of-interest-presence.service.spec.ts` (nuevo)
- `src/point-of-interest/presence/point-of-interest-presence.service.ts` (nuevo)
- `src/point-of-interest/presence/presence-reset.repository.spec.ts` (nuevo)

### Frontend

- `lib/core/routes/app_router.dart` (modificado)
- `lib/core/routes/app_routes.dart` (modificado)
- `lib/features/notification/models/push_notification_data.dart` (modificado)
- `lib/features/notification/services/notification_api_service.dart` (modificado)
- `lib/features/settings/screens/settings_screen.dart` (modificado)
- `lib/features/notification/models/notification_preferences.dart` (nuevo)
- `lib/features/notification/providers/notification_preferences_provider.dart` (nuevo)
- `lib/features/notification/screens/notification_preferences_screen.dart` (nuevo)
- `test/features/notification/notification_preferences_test.dart` (nuevo)

## Validación ejecutada

- Backend: npx prisma generate OK; npm run build OK; npm run lint OK; npm test -- --runInBand: 23 suites, 112 tests OK.
- Flutter: dart format lib test OK (105 archivos examinados, 6 formateados); flutter analyze sin problemas; flutter test: 54 tests OK; flutter build apk --debug OK.
- APK: Front/pf-bond-front/build/app/outputs/flutter-apk/app-debug.apk.
- Git diff --check sin errores en ambos repositorios.
- El build Android emitió una advertencia de compatibilidad futura de firebase_core con Kotlin Gradle Plugin; no impidió generar el APK. No se cambiaron dependencias.
- Tests de persistencia usan dobles de Prisma: verifican filtros, upserts, escrituras condicionales y resets, sin ejecutar contra la base real. La migración no fue aplicada y no se realizó la prueba física de recepción FCM.
- Se conservan las pruebas existentes de auth, ubicación, foreground tracking, heartbeat, WebSocket y POIs.
