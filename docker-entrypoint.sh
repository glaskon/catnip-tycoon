#!/bin/sh
echo "Catnip Tycoon startup"
echo "Starting PostgreSQL via official entrypoint..."
echo "Starting Node.js app..."

# All the real work is in the Dockerfile CMD:
# docker-entrypoint.sh postgres &  (handles init + start)
# node /app/server/index.js  (game server)
# This file is kept for extensibility
exec "$@"