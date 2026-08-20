#!/bin/sh
echo "=== Catnip Tycoon on Alpine ==="
echo "PORT=$PORT"
echo "POSTGRES_USER=$POSTGRES_USER"

# Init PostgreSQL if needed
if [ ! -d "$PGDATA" ] || [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL..."
    mkdir -p "$PGDATA"
    chown -R postgres:postgres "$PGDATA"
    su postgres -c "initdb -D $PGDATA" 2>&1
    
    # Configure auth
    echo "local all all trust" > $PGDATA/pg_hba.conf
    echo "host all all 127.0.0.1/32 md5" >> $PGDATA/pg_hba.conf
    echo "host all all ::1/128 md5" >> $PGDATA/pg_hba.conf
    
    echo "PostgreSQL initialized."
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
su postgres -c "pg_ctl -D $PGDATA -w start" 2>&1

# Create user/database
su postgres -c "psql -c \"CREATE USER ${POSTGRES_USER:-catnip} WITH PASSWORD '${POSTGRES_PASSWORD:-catnip_dev_2026}'\"" 2>&1 || true
su postgres -c "psql -c \"CREATE DATABASE ${POSTGRES_DB:-catnip_tycoon} OWNER ${POSTGRES_USER:-catnip}\"" 2>&1 || true

echo "PostgreSQL ready."
echo "Starting Node server..."

cd /app
exec node server/index.js