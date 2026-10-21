# Backups automáticos de Bond

## Política

La base PostgreSQL 17 se respalda con WAL-G hacia un proyecto Supabase dedicado a copias. Se genera un backup completo los domingos a las 03:00 UTC y un backup incremental todos los días a las 03:15 UTC. El archivado de WAL está habilitado continuamente y PostgreSQL fuerza un cambio de segmento cada 4 minutos cuando hay actividad.

Las imágenes del bucket de Supabase usado por Bond se respaldan diariamente a las 04:00 UTC en un repositorio Restic independiente, cifrado con una contraseña propia. La retención conserva snapshots de archivos dentro de los últimos 90 días. PostgreSQL conserva 14 backups completos semanales, junto con los incrementales y WAL que dependen de ellos; esto cubre aproximadamente 98 días. WAL-G elimina automáticamente las copias y WAL que ya no son necesarios al aplicar esa política.

El RPO operativo inicial es de 5 minutos, medido como tiempo máximo objetivo de datos recientes que podrían perderse. El valor originalmente expresado como 5% no es una unidad operativa de recuperación: no puede convertirse a minutos o bytes sin conocer cuánto y con qué frecuencia cambian los datos. El RPO de 5 minutos debe validarse observando la llegada de WAL al repositorio. El RTO objetivo es 30 minutos y el límite aceptado es 1 hora; debe medirse durante una restauración con tamaños de producción.

Las copias de PostgreSQL y de archivos son independientes. Para una recuperación coherente de imágenes, se restaura un snapshot de archivos y se recupera PostgreSQL a un instante no posterior a ese snapshot. Las imágenes eliminadas de Supabase después de una copia siguen disponibles en sus snapshots Restic retenidos.

## Preparación de Supabase

Crear un proyecto Supabase separado para backups y un bucket privado llamado `bond-backups`. El proyecto debe estar en una región diferente al VPS. Crear credenciales S3 desde la configuración de Storage de ese proyecto y configurar su endpoint, región y claves en `backup/.env`.

Supabase S3 no ofrece versionado de objetos y sus claves S3 tienen acceso a todos los buckets del proyecto, por lo que el proyecto dedicado limita el alcance de esas credenciales. WAL-G y Restic aplican su propia retención; no configurar reglas de lifecycle que borren objetos directamente del bucket.

Crear `backup/.env` copiando `backup/.env.example`. En instalaciones existentes, actualizar también `RESTIC_REPOSITORY` a `rclone:supabase:bond-backups/bond/media`. Generar una clave de 32 bytes para WAL-G con `openssl rand -base64 32` y una contraseña aleatoria larga para Restic. Guardar ambas fuera del VPS, en un gestor de secretos seguro, y configurar permisos restrictivos para `backup/.env` en el servidor. La pérdida de las claves impide descifrar las copias.

El repositorio de Restic usa rclone para acceder al endpoint S3 de Supabase, que incluye una ruta base. Después de cambiar la imagen del runner, reconstruirla y recrear solo ese servicio para aplicar la configuración de rclone:

```bash
docker compose -f docker-compose.prod.yml build postgres
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backup-runner
```

Inicializar el repositorio de Restic una sola vez después de crear el bucket y configurar las credenciales:

```bash
docker compose -f docker-compose.prod.yml exec backup-runner sh -c '. /run/bond-backup.env; restic init'
docker compose -f docker-compose.prod.yml exec backup-runner python3 /usr/local/bin/backup_runner.py db-full
docker compose -f docker-compose.prod.yml exec backup-runner sh -c '. /run/bond-backup.env; python3 /usr/local/bin/backup_runner.py media'
```

El servidor SMTP usa los valores `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` y `MAIL_FROM` de `.env`. Los fallos se notifican a `doubletpf@gmail.com`. Para detectar también la ausencia de ejecuciones, configurar monitores externos de Healthchecks.io y colocar sus URLs en `BACKUP_DB_HEARTBEAT_URL`, `BACKUP_MEDIA_HEARTBEAT_URL` y `BACKUP_WAL_HEARTBEAT_URL`. Configurar las alertas de esos monitores para enviarlas a `doubletpf@gmail.com`.

## Activación en producción

Después de completar `.env` y `backup/.env`, desde `bond-back` ejecutar:

```bash
docker compose -f docker-compose.prod.yml build postgres
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec postgres wal-g backup-list --json
docker compose -f docker-compose.prod.yml exec postgres wal-g wal-show
```

El servicio `backup-runner` mantiene los horarios y ejecuta las tareas sin depender del proceso del backend. Tras el primer despliegue, verificar que sus logs muestran ejecuciones exitosas y que el bucket recibe backups cifrados. No se debe iniciar producción sin completar las claves y credenciales de destino.

El estado del archivado se puede revisar con:

```bash
docker compose -f docker-compose.prod.yml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT archived_count, failed_count, last_archived_wal, last_archived_time, last_failed_time FROM pg_stat_archiver"'
```

El almacenamiento de 50 GB del VPS no se usa como destino de backup. Los backups de base de datos y archivos se cifran y suben directamente a Supabase; el volumen Docker local continúa alojando la base de datos activa.

## Restauración de PostgreSQL

La restauración se prueba en un VPS, una VM o un entorno Docker aislado, nunca encima de producción. Usar PostgreSQL 17, el mismo repositorio y la clave de cifrado guardada fuera del VPS. La restauración necesita conectividad de escritura al servicio PostgreSQL, pero no modifica el repositorio remoto.

1. Preparar un volumen de datos vacío y el acceso al proyecto Supabase de backups.
2. Configurar `WALG_S3_PREFIX`, `AWS_ENDPOINT`, `AWS_REGION`, `AWS_S3_FORCE_PATH_STYLE`, las credenciales S3 y `WALG_LIBSODIUM_KEY` en el entorno de restauración.
3. Listar las copias disponibles con `wal-g backup-list --pretty` y elegir el backup completo/incremental y punto de recuperación deseados.
4. Con PostgreSQL detenido y el directorio de datos vacío, ejecutar `wal-g backup-fetch /var/lib/postgresql/data LATEST` o indicar el nombre exacto del backup.
5. Crear `/var/lib/postgresql/data/recovery.signal` y configurar `restore_command = 'wal-g wal-fetch %f %p'`. Para un punto en el tiempo, configurar además `recovery_target_time` y `recovery_target_action = 'promote'` en la configuración PostgreSQL.
6. Iniciar PostgreSQL y comprobar el estado de recuperación, `pg_isready`, las tablas y datos esperados.

El ejemplo de descarga usa `LATEST`. Para recuperar un instante concreto se debe seleccionar el backup base que lo precede y dejar que PostgreSQL reproduzca los WAL disponibles hasta `recovery_target_time`.

## Restauración de archivos

Elegir un snapshot de Restic cuyo instante permita restaurar el estado de imágenes deseado. Antes de escribir archivos, apuntar `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_PROFILE_PHOTOS_BUCKET` a un bucket de prueba para un ejercicio aislado.

```bash
docker compose -f docker-compose.prod.yml exec backup-runner sh -c '. /run/bond-backup.env; restic snapshots'
docker compose -f docker-compose.prod.yml exec -T backup-runner sh -c '. /run/bond-backup.env; restic dump SNAPSHOT_ID supabase-storage.tar | python3 /usr/local/bin/backup_runner.py restore-media'
```

El procedimiento vuelve a subir los objetos con sus rutas originales y el tipo MIME derivado de la extensión. Para una recuperación de producción, restaurar los archivos al bucket que usa Bond y mantenerlo emparejado con el punto de recuperación de PostgreSQL.

## Prueba de restauración y verificación

La prueba inicial y las posteriores, como mínimo trimestrales, deben ejecutarse en un entorno aislado:

1. Restaurar una copia completa y sus incrementales posteriores, reproduciendo WAL hasta el instante elegido.
2. Restaurar el snapshot de imágenes correspondiente.
3. Levantar la versión de Bond contra esa base restaurada y contra el bucket restaurado de prueba, sin enviar correos ni notificaciones a usuarios reales.
4. Comprobar que la API puede iniciar sesión, consultar usuarios y grupos, leer eventos y cargar imágenes de perfil y grupo.
5. Registrar el instante recuperado, los checks realizados, el resultado y el tiempo total. Comparar el tiempo con el RTO de 30 minutos y ajustar recursos/procedimiento si se excede.

Los trabajos escriben su resultado en los logs de `backup-runner`, envían correo ante fallos y notifican opcionalmente a monitores externos. Las estadísticas locales de WAL se comprueban cada minuto y la disponibilidad del repositorio remoto cada 5 minutos; Restic y WAL-G verifican su propio resultado y se revisan los metadatos del repositorio antes de declarar una ejecución exitosa.
