# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# --- Production stage ---
FROM postgres:16-alpine

# Install Node.js
RUN apk add --no-cache nodejs npm

ENV POSTGRES_USER=catnip
ENV POSTGRES_PASSWORD=Catnip2026Dev
ENV POSTGRES_DB=catnip_tycoon
ENV PORT=3000

WORKDIR /app

# Copy Node.js deps and app
COPY --from=build /app/node_modules ./node_modules
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./
COPY docker-entrypoint.sh /app-entrypoint.sh
RUN chmod +x /app-entrypoint.sh

EXPOSE 3000

# Use original postgres entrypoint for DB init, then start Node
CMD ["sh", "-c", "docker-entrypoint.sh postgres & sleep 3 && node /app/server/index.js"]