# MES STORE — Production Deployment, Backup & Restore Runbook

**Scope:** production deployment preparation and PostgreSQL disaster recovery. This runbook does not authorize or perform a production deployment.

## Current architecture

- GitHub Pages publishes the static storefront from `main` through `.github/workflows/deploy.yml`.
- The container stack is defined in `infra/docker/docker-compose.yml`: PostgreSQL 16, Redis 7, NestJS API, Next.js storefront and admin.
- PostgreSQL uses the named Docker volume `postgres_data`; Redis uses `redis_data`.
- The API container runs Prisma migrations and the product seed command at startup.
- The current `/api/health` endpoint is a process liveness response. It does not prove database, Redis, queue-worker or provider readiness.
- A successful GitHub Pages deployment is only evidence for the static storefront. It does not deploy or certify the API, database, Redis, workers, backups or restore process.

## Production deployment prerequisites

1. Choose and provision a production host/managed container platform and managed PostgreSQL/Redis where possible.
2. Configure HTTPS at a maintained reverse proxy/load balancer. Expose only 80/443 publicly. Keep PostgreSQL and Redis private; do not publish their ports to the internet.
3. Set `HOST_BIND_ADDRESS=127.0.0.1` for a single-host reverse-proxy deployment, or remove public host-port mappings and use a private container network. Never expose database/cache ports publicly.
4. Use a dedicated production `.env` outside Git, with unique randomly generated values for database, Redis and JWT credentials. Keep provider secrets in the hosting platform's secret manager. Never use values from `.env.example`.
5. Set exact production `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, and public storefront URL. Do not leave localhost defaults.
6. Build immutable images from a reviewed commit SHA, scan dependencies/images, and record image digests. Do not deploy from a moving branch name.
7. Run database migrations as a controlled one-off release job after a verified pre-deployment backup. Do not run multiple migration jobs concurrently.
8. Review `scripts/seed-products.mjs` before using it against production data. Seeding must be idempotent and must never reset or overwrite owner-managed prices, stock, or media.
9. Verify admin bootstrap is disabled after first use, rotate the bootstrap credential, and test admin MFA/access policy where supported.
10. Configure monitoring, alert routing, log retention, rate limiting, incident contacts and a tested rollback plan.
11. Complete the release gates in `docs/commerce/COMMERCIAL_TEST_READINESS.md`. A green CI run is not a production-readiness certificate.

## PostgreSQL backup

### Requirements

- Docker Compose and access to the running `postgres` service.
- The database container must have `POSTGRES_DB` and `POSTGRES_USER` set.
- Backups are written locally under `backups/postgres` by default. The directory is excluded from Git and restricted to the current OS user.
- The custom-format dump excludes cluster roles, ownership and ACLs. Preserve role/grant definitions separately in the infrastructure configuration.
- The script validates archive readability and writes SHA-256 and JSON manifest sidecars.

### Create a backup

```bash
bash scripts/backup-postgres.sh
```

Optional location override:

```bash
BACKUP_DIR=/secure/local/path bash scripts/backup-postgres.sh
```

Copy the dump, checksum and manifest to encrypted off-host/object storage with access logging and retention controls. A backup kept only on the same host/volume is not disaster recovery. Enable provider-side encryption and object versioning/immutability where available. Do not commit backups to GitHub.

### Suggested policy (owner must approve)

- Daily encrypted full backup; retain 30 daily and 12 monthly recovery points.
- Enable managed PostgreSQL point-in-time recovery/WAL archiving with a target RPO of 15 minutes or better if the chosen provider supports it.
- Alert on missed backup jobs, checksum failures, storage quota and restore-test failures.
- Perform a restore drill at least quarterly and after major schema/storage changes.
- Document actual RPO/RTO only after timed restore drills. Do not advertise targets that have not been achieved.

## Restore procedure — destructive

Restore replaces database objects in the configured target database. Never run against production until the incident owner approves the exact target and a maintenance window is active.

1. Stop API, workers and any process that writes to the target database.
2. Confirm the selected archive, checksum sidecar, database name, environment and incident approval.
3. Verify the archive and SHA-256 sidecar.
4. Run the restore command with both explicit confirmations. The script automatically creates a fresh safety backup before destructive restore.

```bash
RESTORE_DATABASE_NAME=mes_store \
CONFIRM_DATABASE_RESTORE=YES \
bash scripts/restore-postgres.sh /secure/path/mes-store-YYYYMMDDTHHMMSSZ.dump
```

The restore script rejects a target name that does not match `POSTGRES_DB`, checks the archive checksum/readability, creates a safety backup, and uses `pg_restore --single-transaction`. It performs basic schema-presence checks after restore.

5. Run migrations only if the incident recovery plan explicitly requires a forward migration. Do not run `db:push` as a production recovery shortcut.
6. Verify record counts and key relationships for users, products, orders, order items, payments, shipments, notification outbox, delivery attempts and delivery events against the pre-incident backup/monitoring snapshot.
7. Run API, storefront, admin login, product catalogue, checkout idempotency and notification outbox smoke tests using controlled test data.
8. Re-enable workers and traffic only after the incident owner signs off. Record the restore source, checksum, start/end times, errors, row-count comparisons and observed RPO/RTO.

## Redis recovery

Redis is used for transient coordination/cache state and is not the source of truth for orders or payments. Do not restore Redis blindly from a stale snapshot during database recovery. Recreate cache/coordination state from the authoritative database and restart workers under controlled conditions. If Redis persistence is required for a specific production workload, configure and test its backup/restore independently.

## Verification performed by repository CI

The CI verifier checks script syntax and required safety controls. It does not connect to production, create a real backup, validate off-site storage, execute a destructive restore, or prove RPO/RTO. Those require a disposable PostgreSQL environment and an owner-approved restore drill.

## Deployment boundary

The current Pages workflow deploys automatically on pushes to `main`. Do not merge a PR or push to `main` until the release owner explicitly approves that static-site deployment. The API/container production deployment is not automated by this workflow and must be provisioned separately.
