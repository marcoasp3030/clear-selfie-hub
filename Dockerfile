# syntax=docker/dockerfile:1.6

# ---------- Stage 1: build ----------
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# Install deps first (better layer cache)
COPY package.json bun.lockb* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# Copy source and build for Node (no Cloudflare plugin)
COPY . .

# ----- Build-time env (Vite inlines VITE_* into the client bundle) -----
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

ENV DEPLOY_TARGET=node
ENV NODE_ENV=production
RUN bun run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built output and the package metadata required at runtime
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# TanStack Start (Node target) emits a standalone server entry here
CMD ["node", ".output/server/index.mjs"]