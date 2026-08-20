# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app

# Copy production deps from build
COPY --from=build /app/node_modules ./node_modules

# Copy server source
COPY server/ ./server/
COPY public/ ./public/
COPY package.json ./

# Expose port
EXPOSE 8000

# Start server
CMD ["node", "server/index.js"]