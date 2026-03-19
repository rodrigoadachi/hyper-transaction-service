#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
  echo "Running database migrations..."
  node ./scripts/db-migrate.cjs
fi

exec "$@"