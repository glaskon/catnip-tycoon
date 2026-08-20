#!/bin/bash
set -e

echo "[Entrypoint] ========================================"
echo "[Entrypoint] Catnip Tycoon container starting..."
echo "[Entrypoint] PGDATA=$PGDATA"
echo "[Entrypoint] PG_MAJOR=$PG_MAJOR"
echo "[Entrypoint] POSTGRES_USER=$POSTGRES_USER"
echo "[Entrypoint] POSTGRES_DB=$POSTGRES_DB"

# Check current cluster status
CLUSTER_EXISTS=false
if pg_lsclusters -h 2>/dev/null | grep -q "$PG_MAJOR main"; then
  CLUSTER_EXISTS=true
  echo "[Entrypoint] Found existing PostgreSQL cluster $PG_MAJOR/main"
fi

# If cluster doesn't exist (e.g., during Docker build), create it
if [ "$CLUSTER_EXISTS" != "true" ]; then
  echo "[Entrypoint] Creating PostgreSQL cluster $PG_MAJOR/main..."
  pg_createcluster $PG_MAJOR main --start
fi

# Start the cluster
echo "[Entrypoint] Starting PostgreSQL cluster..."
pg_ctlcluster $PG_MAJOR main start || true

# Configure password auth
echo "local all all trust" > $PGDATA/pg_hba.conf
echo "host all all 127.0.0.1/32 md5" >> $PGDATA/pg_hba.conf
echo "host all all ::1/128 md5" >> $PGDATA/pg_hba.conf

# Reload config
pg_ctlcluster $PG_MAJOR main reload

# Create user and database
echo "[Entrypoint] Ensuring database user and database exist..."
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER:-catnip}'\" | grep -q 1 || psql -c \"CREATE USER ${POSTGRES_USER:-catnip} WITH PASSWORD '${POSTGRES_PASSWORD:-catnip_dev_2026}'\"" 2>&1 || true
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB:-catnip_tycoon}'\" | grep -q 1 || psql -c \"CREATE DATABASE ${POSTGRES_DB:-catnip_tycoon} OWNER ${POSTGRES_USER:-catnip}\"" 2>&1 || true
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB:-catnip_tycoon} TO ${POSTGRES_USER:-catnip}\"" 2>&1 || true

echo "[Entrypoint] ✅ PostgreSQL ready: $POSTGRES_USER@localhost:$POSTGRES_PORT/$POSTGRES_DB"

# Wait for PostgreSQL to accept connections
for i in $(seq 1 15); do
  if su - postgres -c "psql -c 'SELECT 1' > /dev/null 2>&1" postgres; then
    echo "[Entrypoint] ✅ PostgreSQL accepting connections."
    break
  fi
  echo "[Entrypoint] Waiting for PostgreSQL... ($i/15)"
  sleep 1
done

# Start Node.js application
echo "[Entrypoint] Starting Catnip Tycoon server..."
exec node server/index.js