#!/bin/sh
set -e
echo "Applying database migrations..."
npx prisma migrate deploy
if [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "Loading demo data (skipped if data already exists)..."
  npx tsx prisma/seed.ts
fi
echo "Starting REGEN HIS on port ${PORT:-3000}"
exec npx next start -p "${PORT:-3000}"
