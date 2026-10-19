import email.message
import fcntl
import json
import mimetypes
import os
import smtplib
import ssl
import subprocess
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


STATE_DIRECTORY = Path(os.environ.get("BACKUP_STATE_DIRECTORY", "/var/lib/bond-backup"))
DATABASE_DIRECTORY = os.environ.get("PGDATA", "/var/lib/postgresql/data")
SUPABASE_API = os.environ.get("SUPABASE_URL", "").rstrip("/") + "/storage/v1"
SUPABASE_BUCKET = os.environ.get("SUPABASE_PROFILE_PHOTOS_BUCKET", "Bond")
SUPABASE_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")
LIST_PAGE_SIZE = 1000
MEDIA_ARCHIVE_NAME = "supabase-storage.tar"
ERROR_COOLDOWN = timedelta(hours=1)


def log(message):
    print(f"{datetime.now(timezone.utc).isoformat()} {message}", flush=True)


def state_path(name):
    STATE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    return STATE_DIRECTORY / name


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json(path, value):
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(value), encoding="utf-8")
    temporary_path.replace(path)


def send_heartbeat(job, suffix=""):
    heartbeat_name = (
        "DB"
        if job.startswith("db-")
        else "MEDIA"
        if job == "media"
        else "WAL"
        if job == "monitor-wal"
        else ""
    )
    if not heartbeat_name:
        return
    url = os.environ.get(f"BACKUP_{heartbeat_name}_HEARTBEAT_URL", "").strip()
    if not url:
        return
    request = urllib.request.Request(url.rstrip("/") + suffix, data=b"", method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10):
            pass
    except Exception as error:
        log(f"heartbeat job={job} outcome=error error={error}")


def should_send_failure(job):
    path = state_path("alerts.json")
    alerts = read_json(path, {})
    last_alert = alerts.get(job)
    now = datetime.now(timezone.utc)
    if last_alert:
        try:
            if now - datetime.fromisoformat(last_alert) < ERROR_COOLDOWN:
                return False
        except ValueError:
            pass
    alerts[job] = now.isoformat()
    write_json(path, alerts)
    return True


def send_failure_email(job, error):
    if not should_send_failure(job):
        return
    recipient = os.environ.get("BACKUP_ALERT_EMAIL", "doubletpf@gmail.com").strip()
    sender = os.environ.get("BACKUP_SMTP_FROM", "").strip()
    username = os.environ.get("BACKUP_SMTP_USER", "").strip()
    password = os.environ.get("BACKUP_SMTP_PASSWORD", "")
    host = os.environ.get("BACKUP_SMTP_HOST", "").strip()
    port = int(os.environ.get("BACKUP_SMTP_PORT", "587"))
    if not sender:
        sender = username
    if not host or not sender or not recipient:
        log(f"alert job={job} outcome=not-sent reason=smtp-not-configured")
        return
    message = email.message.EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = f"Bond: falló el backup {job}"
    message.set_content(
        f"La ejecución de backup {job} falló el "
        f"{datetime.now(timezone.utc).isoformat()} UTC.\n\n{error}"
    )
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=20) as smtp:
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
                if username:
                    smtp.login(username, password)
                smtp.send_message(message)
        log(f"alert job={job} outcome=sent recipient={recipient}")
    except Exception as smtp_error:
        log(f"alert job={job} outcome=error error={smtp_error}")


def run_job(job, operation, heartbeat=True):
    if heartbeat:
        send_heartbeat(job, "/start")
    log(f"job={job} outcome=started")
    try:
        operation()
    except Exception as error:
        log(f"job={job} outcome=failed error={error}")
        send_failure_email(job, error)
        if heartbeat:
            send_heartbeat(job, "/fail")
        raise
    log(f"job={job} outcome=success")
    if heartbeat:
        send_heartbeat(job)


def run_command(arguments, env=None, capture_output=False):
    return subprocess.run(
        arguments,
        check=True,
        env=env,
        text=True,
        capture_output=capture_output,
    )


def database_backup(full):
    env = os.environ.copy()
    if full:
        env["WALG_DELTA_MAX_STEPS"] = "0"
    run_command(["wal-g", "backup-push", DATABASE_DIRECTORY], env=env)
    backup_list = run_command(
        ["wal-g", "backup-list", "--json"], env=env, capture_output=True
    )
    if not json.loads(backup_list.stdout):
        raise RuntimeError("WAL-G no encontró backups después de la ejecución")


def storage_request(method, endpoint, payload=None, content_type=None):
    if not os.environ.get("SUPABASE_URL", "").strip() or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL y SUPABASE_SECRET_KEY deben estar configuradas")
    if payload is None:
        body = None
    elif isinstance(payload, bytes):
        body = payload
    else:
        body = json.dumps(payload).encode("utf-8")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if content_type:
        headers["Content-Type"] = content_type
    request = urllib.request.Request(
        SUPABASE_API + endpoint,
        data=body,
        headers=headers,
        method=method,
    )
    return urllib.request.urlopen(request, timeout=120)


def list_storage_objects(prefix=""):
    endpoint = "/object/list/" + urllib.parse.quote(SUPABASE_BUCKET, safe="")
    offset = 0
    while True:
        with storage_request(
            "POST",
            endpoint,
            {"prefix": prefix, "limit": LIST_PAGE_SIZE, "offset": offset},
        ) as response:
            items = json.loads(response.read().decode("utf-8"))
        for item in items:
            name = item.get("name")
            if not name:
                continue
            path = f"{prefix}/{name}" if prefix else name
            if item.get("id") is None:
                yield from list_storage_objects(path)
            else:
                yield path, item
        if len(items) < LIST_PAGE_SIZE:
            return
        offset += len(items)


def object_timestamp(item):
    value = item.get("updated_at") or item.get("created_at")
    if not value:
        return 0
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0


def write_media_tar(tar):
    objects = sorted(list_storage_objects(), key=lambda entry: entry[0])
    if not objects:
        raise RuntimeError(f"El bucket {SUPABASE_BUCKET} no devolvió objetos")
    for path, item in objects:
        encoded_path = urllib.parse.quote(path, safe="/")
        endpoint = (
            "/object/authenticated/"
            + urllib.parse.quote(SUPABASE_BUCKET, safe="")
            + "/"
            + encoded_path
        )
        with storage_request("GET", endpoint) as response:
            size_header = response.headers.get("Content-Length")
            if not size_header:
                raise RuntimeError(f"El objeto {path} no informó su tamaño")
            info = tarfile.TarInfo(name=path)
            info.size = int(size_header)
            info.mtime = object_timestamp(item)
            info.uid = 0
            info.gid = 0
            info.uname = ""
            info.gname = ""
            info.mode = 0o644
            tar.addfile(info, response)
        log(f"media-object path={path} size={size_header}")


def media_backup():
    process = subprocess.Popen(
        ["restic", "backup", "--stdin", "--stdin-filename", MEDIA_ARCHIVE_NAME],
        stdin=subprocess.PIPE,
    )
    try:
        with tarfile.open(fileobj=process.stdin, mode="w|") as tar:
            write_media_tar(tar)
        process.stdin.close()
    except Exception:
        if process.stdin and not process.stdin.closed:
            process.stdin.close()
        process.terminate()
        process.wait()
        raise
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"restic backup finalizó con código {return_code}")
    snapshots = run_command(["restic", "snapshots", "--latest", "1", "--json"], capture_output=True)
    if not snapshots.stdout.strip():
        raise RuntimeError("Restic no devolvió snapshots después del backup")


def media_retention():
    snapshots = subprocess.run(
        ["restic", "snapshots", "--json"],
        check=False,
        text=True,
        capture_output=True,
    )
    if snapshots.returncode != 0:
        raise RuntimeError(snapshots.stderr.strip() or "No se pudieron listar los snapshots Restic")
    if json.loads(snapshots.stdout or "[]"):
        run_command(["restic", "forget", "--keep-within", "90d", "--prune"])


def timestamp(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00").replace(" ", "T"))


def monitor_wal():
    query = (
        "SELECT json_build_object("
        "'wal_bytes', wal_bytes, "
        "'failed_count', failed_count, "
        "'last_failed_time', last_failed_time, "
        "'last_archived_time', last_archived_time)::text "
        "FROM pg_stat_wal CROSS JOIN pg_stat_archiver"
    )
    result = run_command(
        ["psql", "-XAt", "-d", os.environ.get("PGDATABASE", "bond"), "-c", query],
        capture_output=True,
    )
    current = json.loads(result.stdout.strip())
    path = state_path("wal-monitor.json")
    previous = read_json(path, None)
    now = datetime.now(timezone.utc)
    last_repository_check = timestamp(
        previous.get("repository_checked_at") if previous else None
    )
    repository_check_due = (
        last_repository_check is None
        or now - last_repository_check > timedelta(minutes=5)
    )
    if repository_check_due:
        run_command(["wal-g", "backup-list", "--json"], capture_output=True)
        current["repository_checked_at"] = now.isoformat()
    else:
        current["repository_checked_at"] = previous["repository_checked_at"]
    write_json(path, current)
    if previous is None:
        return
    if int(current["failed_count"]) > int(previous["failed_count"]):
        raise RuntimeError("PostgreSQL informó un nuevo fallo al archivar WAL")
    if int(current["wal_bytes"]) > int(previous["wal_bytes"]):
        archived_at = timestamp(current.get("last_archived_time"))
        if archived_at is None or now - archived_at > timedelta(minutes=5):
            raise RuntimeError("Hay actividad nueva en PostgreSQL, pero no se archivaron WAL en los últimos 5 minutos")


def restore_media():
    if not SUPABASE_BUCKET:
        raise RuntimeError("SUPABASE_PROFILE_PHOTOS_BUCKET debe estar configurada")
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|") as tar:
        for item in tar:
            if not item.isfile() or item.name.startswith("/") or ".." in Path(item.name).parts:
                continue
            source = tar.extractfile(item)
            if source is None:
                continue
            body = source.read()
            if len(body) != item.size:
                raise RuntimeError(f"El tamaño recuperado no coincide para {item.name}")
            content_type = mimetypes.guess_type(item.name)[0] or "application/octet-stream"
            endpoint = (
                "/object/"
                + urllib.parse.quote(SUPABASE_BUCKET, safe="")
                + "/"
                + urllib.parse.quote(item.name, safe="/")
            )
            with storage_request(
                "POST",
                endpoint,
                payload=body,
                content_type=content_type,
            ) as response:
                response.read()
            log(f"media-restore path={item.name} size={item.size}")


def retention():
    run_command(["wal-g", "delete", "retain", "FULL", "14", "--confirm"])
    media_retention()


def execute(job):
    if job == "restore-media":
        restore_media()
        return
    if job not in {"db-full", "db-incremental", "media", "retention", "monitor-wal"}:
        raise ValueError(f"Operación desconocida: {job}")
    lock_name = "monitor-wal" if job == "monitor-wal" else "backup"
    with state_path(f"{lock_name}.lock").open("w", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        if job == "db-full":
            run_job(job, lambda: database_backup(True))
        elif job == "db-incremental":
            run_job(job, lambda: database_backup(False))
        elif job == "media":
            run_job(job, media_backup)
        elif job == "retention":
            run_job(job, retention, heartbeat=False)
        else:
            run_job(job, monitor_wal)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Debe indicarse una única operación")
        execute(sys.argv[1])
    except Exception as exception:
        print(f"backup-runner outcome=error error={exception}", file=sys.stderr, flush=True)
        sys.exit(1)
