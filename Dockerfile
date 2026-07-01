# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

# Build TypeScript and Tailwind CSS
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy views and migrations (runtime files not compiled by tsc)
COPY views ./views
COPY src/db/migrations ./dist/db/migrations

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
