# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL deps (dev included) for building the frontend
COPY package*.json ./
RUN npm install

# Copy source and build Vite frontend
COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production deps only.
# tsx is now in "dependencies" so it's included here.
# Vite is in devDependencies and NOT needed at runtime (guarded by IS_PROD check).
COPY package*.json ./
RUN npm install --omit=dev

# Copy pre-built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server TypeScript source (tsx transpiles it at runtime)
COPY server.ts ./
COPY tsconfig.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Use tsx binary directly — the correct way to run TypeScript in production
CMD ["./node_modules/.bin/tsx", "server.ts"]
