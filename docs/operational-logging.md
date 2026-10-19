# Registro y alertas operativas

El backend emite registros mediante el `Logger` de NestJS a stdout y persiste los eventos operativos capturados como JSON Lines dentro de `/usr/src/app/logs`. En Docker, ese directorio usa un volumen persistente y conserva hasta 30 días, con un límite de 10 MB por archivo y 40 archivos en total. Si se alcanza el límite de archivos antes del plazo, se eliminan primero los más antiguos para limitar el espacio utilizado.

Los valores se pueden cambiar mediante `LOG_RETENTION_DAYS`, `LOG_MAX_FILE_SIZE_MB` y `LOG_MAX_FILES`. Los volúmenes `bond-backend-dev-logs` y `bond-backend-prod-logs` sobreviven a la recreación de contenedores; `docker compose down -v` también los elimina.

La salida en vivo se consulta con `docker compose logs -f backend`. Los archivos persistidos se encuentran dentro del volumen montado en `/usr/src/app/logs`, con nombres `bond-AAAA-MM-DD-NNNN.log`; se pueden listar con `docker compose exec backend ls -lh /usr/src/app/logs`. Cada línea contiene módulo, nivel, fecha, operación y detalle seguro del error.

Se registran eventos operativos y errores relevantes, no cada solicitud exitosa. Los mensajes no incluyen credenciales, tokens, cuerpos de solicitudes o respuestas ni coordenadas.

Todas las respuestas HTTP 403 se registran como advertencias con módulo, método y plantilla de ruta, ocultando los valores dinámicos de la URL.

Las alertas operativas se envían por SMTP a `OPERATIONS_ALERT_EMAIL` cuando una misma operación de un módulo falla cinco veces dentro de cinco minutos. Luego se aplica un cooldown de 30 minutos para esa operación. Esos valores se pueden ajustar mediante `OPERATIONS_ALERT_THRESHOLD`, `OPERATIONS_ALERT_WINDOW_SECONDS` y `OPERATIONS_ALERT_COOLDOWN_SECONDS`. Si no se configura `OPERATIONS_ALERT_EMAIL`, se registran los errores pero no se envían alertas operativas.

`GET /health` verifica la conexión con PostgreSQL. Compose marca el contenedor como no saludable después de fallas consecutivas de ese endpoint. Para recibir una notificación cuando el backend o el host completo deja de responder, un monitor de disponibilidad externo debe consultar ese endpoint y enviar la alerta por su propio canal; el servidor caído no puede avisar por sí mismo.
