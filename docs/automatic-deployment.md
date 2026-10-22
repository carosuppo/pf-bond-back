# Despliegue automático en la VPS

El workflow `.github/workflows/deploy-backend.yml` actualiza la VPS cada vez que se suben cambios a `main`. También puede ejecutarse manualmente desde la pestaña Actions de GitHub.

## Requisitos en la VPS

El usuario `bond` debe poder entrar por SSH, ejecutar `git pull --ff-only origin main` en `/home/bond/apps/pf-bond-back` y ejecutar `docker compose`. Verificarlo iniciando una sesión como `bond` y ejecutando:

```bash
cd /home/bond/apps/pf-bond-back
git pull --ff-only origin main
docker compose -f docker-compose.prod.yml ps
```

El repositorio de GitHub debe poder descargarse desde la VPS usando la autenticación SSH que ya tenga configurada para `bond`.

## Clave de despliegue

Generar una clave Ed25519 dedicada para Actions:

```bash
ssh-keygen -t ed25519 -C github-actions-bond-deploy -f github-actions-bond-deploy -N ""
```

Agregar el contenido de `github-actions-bond-deploy.pub` a `/home/bond/.ssh/authorized_keys` en la VPS y asegurar que los permisos de `.ssh` y `authorized_keys` sean `700` y `600`. Guardar el contenido de `github-actions-bond-deploy` como el secreto `VPS_SSH_PRIVATE_KEY` en `Settings > Secrets and variables > Actions` del repositorio de GitHub.

Crear también estos secretos del repositorio:

- `VPS_HOST`: hostname o IP de la VPS, sin usuario ni puerto.
- `VPS_USER`: `bond`.
- `VPS_KNOWN_HOSTS`: clave de host SSH de la VPS, obtenida y verificada antes de guardarla.

Para obtener la clave de host, ejecutar `ssh-keyscan -t ed25519 HOST_DE_LA_VPS` desde una máquina confiable, verificar su huella con `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` en la VPS y guardar la línea resultante en `VPS_KNOWN_HOSTS`.

Antes de habilitar Actions, comprobar que `bond` puede ejecutar Docker con `docker compose -f docker-compose.prod.yml ps`. Si recibe un error de permisos, hay que configurar acceso de Docker para `bond`; pertenecer al grupo `docker` equivale a tener privilegios de root.

El workflow reconstruye y levanta los servicios de producción con `docker compose -f docker-compose.prod.yml up -d --build`, reinicia Caddy para recargar su `Caddyfile` y muestra el estado de los contenedores. El backend ejecuta `prisma migrate deploy` al iniciar.
