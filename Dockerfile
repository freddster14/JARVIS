FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (workspace-aware)
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production

# Copy compiled server
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/node_modules ./node_modules

# Copy built React client (served by Express in production)
COPY --from=builder /app/client/dist /app/client/dist

EXPOSE 3001

# Run DB migrations then start server
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
