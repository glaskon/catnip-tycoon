#!/bin/bash
echo "=== CONTAINER START: $(date) ==="
echo "PGDATA=$PGDATA"
echo "PORT=$PORT"
echo "POSTGRES_USER=$POSTGRES_USER"

# Clean any stale PID from build
rm -f $PGDATA/postmaster.pid 2>/dev/null || true

# Start PostgreSQL
pg_ctlcluster ${PG_MAJOR:-16} main start 2>&1
echo "pg_ctlcluster exit: $?"

# Check status
pg_isready 2>&1
pg_lsclusters 2>&1

# Setup auth
echo "local all all trust" > $PGDATA/pg_hba.conf
echo "host all all 127.0.0.1/32 md5" >> $PGDATA/pg_hba.conf
echo "host all all ::1/128 md5" >> $PGDATA/pg_hba.conf
pg_ctlcluster ${PG_MAJOR:-16} main reload 2>&1

# Create user/db
su - postgres -c "psql -c \"CREATE USER ${POSTGRES_USER:-catnip} WITH PASSWORD '${POSTGRES_PASSWORD:-catnip_dev_2026}'\" 2>&1" || true
su - postgres -c "psql -c \"CREATE DATABASE ${POSTGRES_DB:-catnip_tycoon} OWNER ${POSTGRES_USER:-catnip}\" 2>&1" || true
echo "PostgreSQL setup done."

# Start Node
echo "Starting node..."
cd /app
node server/index.js 2>&1 &
NODE_PID=$!
echo "Node PID: $NODE_PID"
sleep 3

if kill -0 $NODE_PID 2>/dev/null; then
  echo "Node running."
  wait $NODE_PID
else
  echo "Node exited immediately."
  cat /tmp/node*.log 2>/dev/null || true
fi