set -eu

python3 -c 'import os, shlex; open("/run/bond-backup.env", "w", encoding="utf-8").write("".join(f"export {key}={shlex.quote(value)}\n" for key, value in os.environ.items()))'
chmod 0600 /run/bond-backup.env
exec crond -f -l 2
