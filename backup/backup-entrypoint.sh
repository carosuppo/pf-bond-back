set -eu

export RCLONE_CONFIG_SUPABASE_TYPE=s3
export RCLONE_CONFIG_SUPABASE_PROVIDER=Other
export RCLONE_CONFIG_SUPABASE_ENV_AUTH=true
export RCLONE_CONFIG_SUPABASE_REGION="$AWS_REGION"
export RCLONE_CONFIG_SUPABASE_ENDPOINT="$AWS_ENDPOINT"
export RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true

python3 -c 'import os, shlex; open("/run/bond-backup.env", "w", encoding="utf-8").write("".join(f"export {key}={shlex.quote(value)}\n" for key, value in os.environ.items()))'
chmod 0600 /run/bond-backup.env
exec crond -f -l 2
