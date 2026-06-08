#!/bin/sh
set -e

echo "Esperando a la base de datos..."
until npx prisma db push --accept-data-loss >/dev/null 2>&1; do
  echo "Base de datos no disponible, reintentando en 2 segundos..."
  sleep 2
done

echo "Esquema Prisma cargado."
exec npm run start:dev
