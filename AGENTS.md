# Navi Payload operating contract

Read this before changing Payload, deploys, schema, or secrets.

- Secrets use dotenvx only. Encrypted production values live in `.env.production`; Coolify supplies only `DOTENV_PRIVATE_KEY_PRODUCTION`. Never introduce 1Password, plaintext secrets, or print decrypted values.
- PostgreSQL schema changes require a timestamped TypeScript migration in `migrations/` and registration in `migrations/index.ts`. Keep `push: false` and `prodMigrations: migrations` in `src/payload.config.ts`.
- Never patch production schema manually as the final fix. An emergency SQL repair must be represented immediately by an idempotent migration.
- Container startup is the migration gate: pending migrations run before Payload finishes initialization; a failed migration must fail the deployment.
- `/api/health` is deliberately database-free so Coolify health probes do not keep Neon awake. Database/API smoke checks run once after a deployment, not every 30 seconds.
- The production image starts only through dotenvx (`ENTRYPOINT` in `Dockerfile`). Do not add another secret store or bypass the entrypoint.
- Collection renames, slugs, localization, versioning, or relation changes require migration review and `npm test`, `npm run typecheck`, and `npm run build`.
- Astro consumes an explicit exported snapshot; Payload deployment does not silently rebuild or overwrite the public site.

Architecture and release details: `INFRASTRUCTURE.md`.
