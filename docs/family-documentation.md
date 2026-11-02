# Documentación familiar

Implementación local de BND-124, BND-127, BND-128 y BND-129. Backups y restauración se excluyeron por indicación posterior del usuario. No se modificaron GitHub ni servicios remotos.

## Contrato

Todas las rutas parten de `/group/:groupId/documentation` y requieren el Bearer de una sesión vigente. `SessionAuthGuard` valida la sesión; el repository valida la membresía actual y que el grupo no esté eliminado. No se publican rutas de Storage, credenciales ni enlaces firmados/públicos.

| Método y ruta | Operación |
| --- | --- |
| GET `/` | Lista documentos de raíz; `folderId` navega; `memberId` busca en todo el grupo, incluidas subcarpetas |
| POST `/documents` | Multipart: `file` y `name` obligatorios; `memberId` y `folderId` opcionales |
| PATCH `/documents/:id` | Multipart parcial, archivo opcional; `folderId` vacío mueve a raíz; `memberId` vacío quita la asociación |
| GET `/documents/:id/content` | Bytes protegidos, Content-Type validado, `private, no-store`, `nosniff` |
| DELETE `/documents/:id` | Elimina metadatos y retira el objeto en una transacción |
| POST `/folders` | JSON `{name, parentId?}` |
| PATCH `/folders/:id` | JSON `{name}`; no cambia padre ni grupo |
| DELETE `/folders/:id` | Borra recursivamente y retira objetos de todos los descendientes |

La respuesta de listado contiene `documents`, el árbol completo `folders` (para navegación, destinos y ubicación del filtro), y `members` con `active`. Los integrantes históricos pueden filtrarse pero no seleccionarse para nuevas asociaciones. Los documentos conservan la identidad y nombre histórico del integrante si abandona el grupo; no se eliminan con su membresía. El creador se conserva como dato de auditoría.

PDF, JPEG, PNG y WebP: hasta **10.485.760 bytes**, con MIME y firma comprobados en backend. La firma no sustituye un escáner antimalware ni garantiza que un archivo completo pueda decodificarse: el visor informa los PDF dañados o cifrados y las imágenes inválidas.

El integrante es opcional: `memberId` y `memberName` pueden ser `null`. Al crear, omitir `memberId`, enviarlo vacío en multipart o enviarlo como `null` en JSON significa «sin integrante». Al editar, omitirlo conserva la asociación actual, mientras que vacío/`null` la elimina. Un ID informado sigue debiendo pertenecer al grupo. Los documentos sin integrante aparecen en «Todos» y siguen protegidos por los permisos del grupo.

La migración `20261027000000_optional_document_member` hace ambas columnas nullable y actualiza el trigger de pertenencia. Se aplicó el 27/10/2026 a la base local `bond` del contenedor `bond-bd` (puerto local 5434), después de verificar que la migración inicial ya estaba aplicada. Se confirmó el checksum, la nulabilidad de ambas columnas y la ausencia de migraciones locales pendientes.

## Persistencia y fallos

`DocumentFolder` y `FamilyDocument` tienen claves compuestas con el grupo para impedir referencias cruzadas. Un trigger valida pertenencia al crear/cambiar el integrante, sin impedir la eliminación posterior de su membresía. Los padres de las carpetas son inmutables. Los servicios usan la interfaz `IDocumentRepository`, sin consultas Prisma fuera del repository.

Cada carga registra primero un objeto `pending` en `DocumentObject`, con ruta UUID independiente del nombre y de las carpetas. Después de subir a Storage, una transacción publica los metadatos y activa el objeto. La publicación vence a la hora y vuelve a validar pertenencia al grupo. Un fallo nunca publica un documento parcial: el objeto pendiente se conserva en el registro de limpieza. Las llamadas a Storage tienen un límite de 60 segundos.

Reemplazar publica una ruta nueva y retira la anterior en la misma transacción. Un contador de versión evita que dos reemplazos concurrentes sobrescriban silenciosamente el resultado. El archivo anterior se conserva si falla la carga o la transacción. La descarga vuelve a comprobar acceso y versión después de obtener los bytes de Storage.

El borrado es lógico respecto a Storage, pero los metadatos desaparecen inmediatamente de la aplicación. La transacción retira los objetos; los cascades de eliminación de grupos/cuentas también los retiran mediante trigger. Si falla la DB, todo se revierte. Una falla de Storage no impide revocar el acceso.

**Limpieza interna, sin backups:** un trabajador por proceso revisa cada hora hasta 100 objetos no referenciados: cargas `pending` mayores de 24 horas y versiones `retired` mayores de 30 días. Solo elimina el registro después de que Storage confirme el borrado; los errores se registran y se reintentan. La limpieza es idempotente entre instancias. La retención no ofrece restauración por la aplicación y no equivale a un backup. No se implementaron tareas WAL-G/Restic, ni se afirma una frecuencia o ventana de recuperación no verificada.

## Configuración y pasos manuales

1. Instalar las dependencias fijadas por el proyecto. El 27/10/2026 se restauró localmente `@nestjs/schedule` 12.0.2 con sus dependencias, sin modificar `package.json` ni el lockfile; el backend compila correctamente.
2. En otros entornos, aplicar las migraciones con el proceso habitual (`prisma migrate deploy`), incluida `20261027000000_optional_document_member`. En la base local `bond` ya están aplicadas las dos migraciones de Documentación. Su historial contiene además tres migraciones anteriores sin archivos en este checkout: `20261015000000_internal_metrics`, `20261015010000_foreground_activity_metrics` y `20261015224010`. No se alteraron esos registros; `migrate status` puede seguir señalando esa diferencia de historial.
3. Generar Prisma Client y compilar backend.
4. Crear manualmente **un bucket privado** `bond-documents` en el proyecto Supabase existente. No habilitar políticas de acceso anónimo ni de descarga directa desde clientes. La aplicación solo descarga a través del backend. El servicio comprueba que el bucket no sea público antes de cargar/descargar.
5. Configurar `SUPABASE_DOCUMENTS_BUCKET=bond-documents` (agregado al `.env` local y al ejemplo). Se reutilizan `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, con el fallback existente `SUPABASE_SERVICE_ROLE_KEY`. No hay nuevas variables obligatorias. El almacenamiento de imágenes existente no se modificó.
6. Desplegar backend y APK mediante el proceso habitual y comprobar el flujo real con un bucket privado de prueba. No se desplegó ni se probó Supabase remoto.

## Verificaciones locales

- Prisma validate y generación de cliente.
- Suite unitaria del backend: 37 suites, 232 pruebas; incluye firmas y límites exactos de tamaño.
- Integración HTTP: 12 pruebas aprobadas, con sesión real guardada en PostgreSQL, repository real, fixture SQL aislado y Storage simulado. Incluye raíz/subcarpetas/filtro, descarga de PDF e imágenes, edición/movimiento/reemplazo, permisos entre grupos y después de abandonar el grupo, revocación durante descarga, concurrencia, fallos de carga/commit/borrado y limpieza reintentable.
- ESLint sobre módulo y pruebas nuevos. La compilación completa del backend pasó tras restaurar la dependencia local `@nestjs/schedule`.
- Frontend: suite existente de 156 pruebas y 8 pruebas específicas nuevas; análisis estático y compilación APK debug. Las pruebas del visor simulan el canal Android; el código nativo se verificó por compilación, no mediante interacción en un dispositivo.

Para repetir la integración se necesita una base **desechable y vacía** `documentation_test` en un PostgreSQL aislado `127.0.0.1:55439`, con `DATABASE_URL` apuntando exactamente allí y `RUN_DOCUMENT_DB_TESTS=1`. Ejecutar `npm run test:e2e -- --runInBand documentation.e2e-spec.ts`. El test rechaza cualquier otro host/puerto/base, crea sus tablas de fixture y las elimina al terminar. No usa `migrate deploy`, no carga las credenciales de Supabase y no debe ejecutarse contra una base con datos. La variable `RUN_DOCUMENT_DB_TESTS` es solo para tests.
