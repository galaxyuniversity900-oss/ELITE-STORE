# MES STORE Container Runtime and Migration Procedure

This document describes the container boundaries introduced by the security image-scan work.

## Image stages

- `build` contains the development toolchain, Prisma CLI and full workspace dependencies. It is used to compile the API and as the explicit one-off migration image.
- The default API image is the final `runtime` stage. It contains compiled application files, generated Prisma Client and production dependencies only.
- API runtime starts with `node apps/api/dist/main.js`; npm and npx are not part of the runtime image.
- Storefront and Admin runtime images prune development dependencies after build and invoke the local Next.js executable directly.

## Controlled database migration

The API container does not run schema migrations or seed data at application startup. This prevents every replica from attempting schema changes and avoids coupling application restarts to product seeding.

After the production owner has approved a release and verified a pre-deployment backup:

1. Start or verify the private PostgreSQL service.
2. Run the one-off migration target from the API builder stage.
3. Verify the migration exit code and database schema.
4. Start or update API, storefront and Admin containers.
5. Run readiness, catalogue, admin authentication and checkout smoke tests.
6. Re-enable traffic only after the release owner signs off.

Example single-host commands (use the owner's actual protected environment file and host):

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
docker compose --profile migration -f infra/docker/docker-compose.yml run --build --rm migrate
docker compose -f infra/docker/docker-compose.yml up -d --build api web admin
```

The `migration` profile is opt-in and is not started by a normal `docker compose up`. The migration container uses the builder stage and is removed after completion.

## Seeding

Product seeding is intentionally not part of the API startup or migration service. Review `scripts/seed-products.mjs` and its idempotency/overwrite behavior before any production use. The CI workflow seeds only its disposable PostgreSQL database after applying migrations.

## Release safety

- Keep PostgreSQL and Redis private; publish only the reverse-proxy HTTPS entry points.
- Run migrations as one controlled job, not concurrently from multiple API replicas.
- Use immutable image digests tied to a reviewed commit SHA.
- Never use CI-only credentials or `.env.example` placeholders in production.
- The GitHub Pages workflow remains a separate static-site deployment and does not publish these containers.
- A successful image scan or CI run is not proof of production TLS, secrets, backup retention, monitoring, provider approval or restore readiness.
