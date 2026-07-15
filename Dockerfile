# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Keep this layer reusable until the dependency manifests change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  NODE_ENV=development npm ci --include=dev --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat && \
  addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Next standalone already contains the traced runtime dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations

USER nextjs

EXPOSE 3000

# Static endpoint: verifies the app without opening a database connection.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
