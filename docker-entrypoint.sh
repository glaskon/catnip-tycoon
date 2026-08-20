#!/bin/bash
set -e

# Initialize PostgreSQL data directory if empty
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "[Entrypoint] Initializing PostgreSQL..."
  su - postgres -c "initdb -D $PGDATA"

  # Allow password auth
  echo "local all all trust" > $PGDATA/pg_hba.conf
  echo "host all all 127.0.0.1/32 md5" >> $PGDATA/pg_hba.conf
  echo "host all all ::1/128 md5" >> $PGDATA/pg_hba.conf

  # Start PostgreSQL temporarily to create user and database
  su - postgres -c "pg_ctl -D $PGDATA -w start"

  # Create database, user, and set password
  su - postgres -c "psql -c \"CREATE USER ${POSTGRES_USER:-catnip} WITH PASSWORD '${POSTGRES_PASSWORD:-catnip_dev_2026}';\""
  su - postgres -c "psql -c \"CREATE DATABASE ${POSTGRES_DB:-catnip_tycoon} OWNER ${POSTGRES_USER:-catnip};\""
  su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB:-catnip_tycoon} TO ${POSTGRES_USER:-catnip};\""

  # Stop PostgreSQL
  su - postgres -c "pg_ctl -D $PGDATA -w stop"
  echo "[Entrypoint] PostgreSQL initialized."
fi

# Start PostgreSQL in background
echo "[Entrypoint] Starting PostgreSQL..."
su - postgres -c "pg_ctl -D $PGDATA -w start"
echo "[Entrypoint] PostgreSQL ready."

# Wait for PostgreSQL to accept connections
for i in $(seq 1 10); do
  if su - postgres -c "psql -c 'SELECT 1'" > /dev/null 2>&1; then
    break
  fi
  echo "[Entrypoint] Waiting for PostgreSQL... ($i/10)"
  sleep 1
done

# Start Node.js application
echo "[Entrypoint] Starting Catnip Tycoon..."
exec node server/index.js