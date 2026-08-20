# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# --- Production stage ---
FROM node:20-alpine

# Install PostgreSQL (Alpine style - no Debian cluster manager)
RUN apk add --no-cache postgresql16 postgresql16-client

WORKDIR /app

# Copy production deps from build
COPY --from=build /app/node_modules ./node_modules

# Copy application source
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./
COPY docker-entrypoint.sh /docker-entrypoint.sh

ENV PGDATA=/var/lib/postgresql/16/data
ENV POSTGRES_USER=catnip
ENV POSTGRES_PASSWORD=catnip_dev_2026
ENV POSTGRES_DB=catnip_tycoon
ENV POSTGRES_HOST=localhost
ENV POSTGRES_PORT=5432
ENV PORT=3000

RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000 5432

CMD ["/docker-entrypoint.sh"]