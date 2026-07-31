# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.17.0

# Debian/glibc is intentional. Payload's image pipeline depends on sharp and
# the former Node 22 failure was most likely in the Alpine/musl native-module
# path, not in Payload's declared Node engine range.
FROM node:${NODE_VERSION}-bookworm-slim AS builder
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

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apt-get update && \
  # Coolify's external Dockerfile health probe requires curl or wget even
  # though the image also declares its own Node-based HEALTHCHECK.
  apt-get install --yes --no-install-recommends curl tini && \
  rm -rf /var/lib/apt/lists/* && \
  npm install --global @dotenvx/dotenvx@2.15.1 --no-audit --no-fund && \
  npm cache clean --force && \
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
STOPSIGNAL SIGTERM

# Static endpoint: verifies the app without opening a database connection.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# Keep decryption in ENTRYPOINT so platform-level command overrides (Coolify,
# Compose, Kubernetes) cannot accidentally bypass production env loading.
ENTRYPOINT ["tini", "--", "dotenvx", "run", "-f", ".env.production", "--"]
CMD ["node", "server.js"]
