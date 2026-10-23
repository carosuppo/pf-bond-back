import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


class StorageState:
    restored = {}
    original = b"bond-image-validation"


class StorageHandler(BaseHTTPRequestHandler):
    def log_message(self, format_string, *args):
        return

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/storage/v1/object/list/Bond":
            payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            prefix = payload["prefix"]
            if prefix == "":
                items = [{"name": "users", "id": None}]
            elif prefix == "users":
                items = [{"name": "7", "id": None}]
            elif prefix == "users/7":
                items = [
                    {
                        "name": "profile.png",
                        "id": "object-id",
                        "updated_at": "2026-10-19T10:00:00Z",
                        "metadata": {"size": len(StorageState.original)},
                    }
                ]
            else:
                items = []
            body = json.dumps(items).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        key = unquote(parsed.path.split("/object/Bond/", 1)[1])
        StorageState.restored[key] = self.rfile.read(int(self.headers["Content-Length"]))
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"{}")

    def do_GET(self):
        body = StorageState.original
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class BackupRunnerMediaTest(unittest.TestCase):
    def test_media_backup_can_be_restored_to_storage(self):
        StorageState.restored = {}
        server = ThreadingHTTPServer(("127.0.0.1", 0), StorageHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        with tempfile.TemporaryDirectory() as directory:
            env = os.environ.copy()
            env.update(
                {
                    "BACKUP_STATE_DIRECTORY": os.path.join(directory, "state"),
                    "RESTIC_REPOSITORY": os.path.join(directory, "restic"),
                    "RESTIC_PASSWORD": "validation-only",
                    "SUPABASE_URL": f"http://127.0.0.1:{server.server_port}",
                    "SUPABASE_SECRET_KEY": "validation-only",
                    "SUPABASE_PROFILE_PHOTOS_BUCKET": "Bond",
                    "PYTHONDONTWRITEBYTECODE": "1",
                }
            )
            runner = os.path.join(os.path.dirname(__file__), "backup_runner.py")
            subprocess.run(["restic", "init"], env=env, check=True, capture_output=True)
            subprocess.run(
                [sys.executable, runner, "media"],
                env=env,
                check=True,
                capture_output=True,
                timeout=60,
            )
            subprocess.run(
                ["restic", "forget", "--keep-within", "90d", "--prune"],
                env=env,
                check=True,
                capture_output=True,
                timeout=60,
            )
            archive = subprocess.Popen(
                ["restic", "dump", "latest", "supabase-storage.tar"],
                env=env,
                stdout=subprocess.PIPE,
            )
            subprocess.run(
                [sys.executable, runner, "restore-media"],
                env=env,
                stdin=archive.stdout,
                check=True,
                capture_output=True,
                timeout=60,
            )
            archive.stdout.close()
            self.assertEqual(archive.wait(), 0)
        server.shutdown()
        server.server_close()
        self.assertEqual(StorageState.restored, {"users/7/profile.png": StorageState.original})


if __name__ == "__main__":
    unittest.main()
