FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Build frontend
COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy all source (tsx needs it to transpile server.ts at runtime)
COPY package*.json ./
RUN npm ci --include=dev

COPY --from=base /app/dist ./dist
COPY server.ts ./
COPY tsconfig.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "--import", "tsx/esm", "server.ts"]
