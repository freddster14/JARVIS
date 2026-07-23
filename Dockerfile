FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (workspace-aware)
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm ci

# Copy source and build
COPY . .
RUN npm run db:generate --workspace=server
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production

# Copy compiled server
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/prisma ./prisma
COPY --from=builder /app/server/node_modules ./node_modules

# npm workspaces hoists shared deps (prisma, @prisma/client, etc.) to the
# monorepo root instead of server/node_modules — copy that too, preserving
# the parent directory relationship so Node's module resolution finds them
COPY --from=builder /app/node_modules /app/node_modules

# Copy built React client (served by Express in production)
COPY --from=builder /app/client/dist /app/client/dist

EXPOSE 3001

# Run DB migrations then start server (npx resolves prisma regardless of
# whether it landed in server/node_modules or the hoisted root)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
