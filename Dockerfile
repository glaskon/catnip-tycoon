# --- Build stage ---
FROM node:20-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# --- Production stage ---
FROM node:20-bookworm

# Install PostgreSQL (Debian manages cluster automatically)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production deps from build
COPY --from=build /app/node_modules ./node_modules

# Copy application source
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Set PostgreSQL environment (use Debian default cluster path)
ENV PGDATA=/var/lib/postgresql/16/main
ENV PG_MAJOR=16
ENV POSTGRES_USER=catnip
ENV POSTGRES_PASSWORD=catnip_dev_2026
ENV POSTGRES_DB=catnip_tycoon
ENV POSTGRES_HOST=localhost
ENV POSTGRES_PORT=5432
ENV PORT=3000

# Ensure entrypoint is executable
RUN chmod +x /docker-entrypoint.sh

# Expose ports
EXPOSE 3000 5432

# Start entrypoint
CMD ["bash", "/docker-entrypoint.sh"]