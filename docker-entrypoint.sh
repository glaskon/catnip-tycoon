#!/bin/sh
echo "=== Catnip Tycoon container starting ==="
echo "PORT=$PORT"
echo "PGDATA=$PGDATA"

export PATH="/usr/lib/postgresql16/bin:/usr/bin:/bin:$PATH"

# Init PostgreSQL fresh
rm -rf $PGDATA
mkdir -p $PGDATA
chown postgres:postgres $PGDATA

# initdb as postgres user
su postgres -c "initdb -D $PGDATA 2>&1"
echo "initdb done."

# Auth config
echo "local all all trust" > $PGDATA/pg_hba.conf
echo "host all all 127.0.0.1/32 trust" >> $PGDATA/pg_hba.conf

# Start PostgreSQL
su postgres -c "pg_ctl -D $PGDATA -w start 2>&1"
echo "PostgreSQL started."

# Create user and database
su postgres -c "psql -c \"CREATE USER ${POSTGRES_USER:-catnip} WITH PASSWORD '${POSTGRES_PASSWORD:-catnip_dev_2026}'\" 2>&1" || true
su postgres -c "psql -c \"CREATE DATABASE ${POSTGRES_DB:-catnip_tycoon} OWNER ${POSTGRES_USER:-catnip}\" 2>&1" || true
echo "Database ready."

# Start Node
cd /app
echo "Starting Node server..."
exec node server/index.js