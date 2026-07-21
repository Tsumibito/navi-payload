# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Keep this layer reusable until the dependency manifests change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  NODE_ENV=development npm ci --include=dev --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
# Payload config is imported at compile time, but build never needs production
# credentials. The config supplies inert values only while PAYLOAD_BUILD is set.
ENV PAYLOAD_BUILD=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat curl && \
  npm install --global @dotenvx/dotenvx@2.15.1 --no-audit --no-fund && \
  addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Next standalone already contains the traced runtime dependencies.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./.env.production

USER nextjs

EXPOSE 3000

# Static endpoint: verifies the app without opening a database connection.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

# Keep decryption in ENTRYPOINT so platform-level command overrides (Coolify,
# Compose, Kubernetes) cannot accidentally bypass production env loading.
ENTRYPOINT ["dotenvx", "run", "-f", ".env.production", "--"]
CMD ["node", "server.js"]
