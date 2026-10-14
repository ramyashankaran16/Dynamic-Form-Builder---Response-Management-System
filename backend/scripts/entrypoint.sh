#!/bin/sh
set -e

python -m scripts.wait_for_db

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
  echo "Seeding roles and admin user..."
  python -m app.db.init_db
fi

exec "$@"
