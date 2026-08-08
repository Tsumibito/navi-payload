# Payload infrastructure contract

## Runtime

Payload runs as a long-lived Docker service in Coolify. Neon PostgreSQL and Cloudflare R2 are external services. Sablier is not part of the Payload lifecycle and must not stop or delete this container. Neon may scale to zero independently.

The production image contains encrypted `.env.production`. Coolify supplies only `DOTENV_PRIVATE_KEY_PRODUCTION`; the Docker `ENTRYPOINT` decrypts variables in memory with dotenvx before starting `node server.js`.

## Database migrations

`postgresAdapter` uses both:

- `push: false` — runtime schema guessing is prohibited;
- `prodMigrations: migrations` — registered migrations run in order during Payload initialization.

Every schema change must add `migrations/YYYYMMDD_HHMMSS_description.ts` and register it, in order, in `migrations/index.ts`. `npm test` rejects missing, duplicated, or out-of-order registry entries. A migration failure prevents the new container from becoming ready; it must never be hidden by starting the server anyway.

The static `/api/health` endpoint is only a liveness check. It intentionally avoids PostgreSQL so routine probes do not wake Neon. After deployment, perform one authenticated API smoke check for Pages, Posts, Tags, Team, and Certificates.

## Release gate

Before deploying Payload:

```bash
npm test
npm run typecheck
npm run build
```

After deployment verify `/api/health`, the admin UI, and authenticated reads of the five public content collections. Counts may be zero only when editorially expected; HTTP 500 or missing tables fails the release.

## Prohibited shortcuts

- no plaintext `.env` values in Git, logs, commands, or documentation;
- no 1Password dependency;
- no `push: true` in production;
- no unregistered migration;
- no recurring database health probe;
- no manual production SQL without an equivalent committed migration.
