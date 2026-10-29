# Bond Legal Web

Sitio Astro estático para las páginas públicas de privacidad, términos de uso y eliminación de cuenta de Bond. En producción se sirve desde el mismo origen que la API bajo `/legal/`.

## Desarrollo

```powershell
npm install
npm run dev
```

Abrí `http://localhost:4321/legal/`.

Para probar el formulario y la confirmación externa, ejecutá también el backend en `http://localhost:3000` y configurá `API_BASE_URL=http://localhost:3000` y `LEGAL_BASE_URL=http://localhost:4321/legal/` en su `.env` local. El backend requiere SMTP configurado para enviar el enlace de confirmación.

## Build

```powershell
npm run build
```

Las páginas generadas quedan en `dist/`.

## Configuración de publicación

La compilación admite estas variables:

- `PUBLIC_SITE_URL`: origen público. Por defecto usa `https://srv2008002.hstgr.cloud`.
- `PUBLIC_DEVELOPER_NAME`: responsable que aparece como desarrollador en Google Play. Por defecto usa `DobleT`.
- `PUBLIC_PRIVACY_EMAIL`: contacto para consultas de privacidad. Por defecto usa `dobletpf@gmail.com`.
- `PUBLIC_POLICY_EFFECTIVE_DATE`: fecha de entrada en vigor en formato `AAAA-MM-DD`. La versión actual usa `2026-10-30`.

La política establece una edad mínima de 13 años. La declaración Data safety de Google Play se completa por separado y debe coincidir con las prácticas descritas aquí. La solicitud externa de eliminación usa un enlace de confirmación enviado al correo registrado; el servicio de correo debe estar configurado en el servidor.

## URLs de producción previstas

- `https://srv2008002.hstgr.cloud/legal/privacy/`
- `https://srv2008002.hstgr.cloud/legal/terms/`
- `https://srv2008002.hstgr.cloud/legal/account-deletion/`

El servicio `legal` se agrega a `docker-compose.prod.yml` y Caddy deriva `/legal/*` al sitio.
