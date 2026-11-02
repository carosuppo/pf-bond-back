# Acceso a Grafana en producción

Grafana se expone solo en `127.0.0.1:3001` de la VPS. Para acceder desde una computadora remota, usar un túnel SSH; no publicar el puerto 3001 en Internet.

Configurar `GRAFANA_ADMIN_USER` y `GRAFANA_ADMIN_PASSWORD` en el `.env` de producción. Después de subir los archivos al repositorio y actualizar la VPS, levantar Grafana junto con el compose de producción:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.grafana.yml up -d grafana
```

Desde la computadora local, abrir otra terminal y mantener este túnel activo:

```bash
ssh -N -L 3001:127.0.0.1:3001 bond@179.197.224.33
```

Abrir `http://localhost:3001` en el navegador e iniciar sesión con `GRAFANA_ADMIN_USER` y `GRAFANA_ADMIN_PASSWORD`.

Comprobar el estado del contenedor en la VPS con:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.prod.grafana.yml ps grafana
```
