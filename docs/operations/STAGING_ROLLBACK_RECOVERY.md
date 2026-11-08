# MES STORE staging, release rollback and recovery

## Staging boundary

- Use a separate staging hostname, database, Redis instance, storage bucket and provider credentials. Never point staging at production data.
- Use isolated GitHub Environment secrets with required reviewers. Do not copy production secrets into pull-request workflows.
- Deploy immutable images tagged with the full Git commit SHA; record the digest and migration version for every release.
- Keep staging provider adapters in sandbox/test mode. Live WhatsApp/email/payment sends remain disabled unless explicitly approved for a controlled provider test.
- The current GitHub Pages workflow deploys only static files; API, PostgreSQL and Redis require a separately provisioned runtime host.

## Rollback procedure

1. Freeze new releases and record the failing release SHA, image digests, migration version and incident time.
2. Roll the API/web/admin runtime back to the last known-good immutable image digests.
3. Roll back static GitHub Pages by redeploying the last known-good commit/artifact; do not force-push or rewrite `main`.
4. Do not automatically reverse database migrations. Prefer forward-compatible expand/contract migrations; restore a database only after owner approval and a verified safety backup.
5. Use `scripts/restore-postgres.sh` only with an explicitly confirmed target database and verified SHA-256 sidecar. Run integrity and application smoke checks before reopening traffic.
6. Record recovery actions, data-loss window and root cause in the incident log.

## Recovery targets

RPO/RTO values are not set in the repository and must be approved by the hosting owner. Off-site encrypted backup destination, encryption key custody, retention period, restore operator and periodic restore-drill schedule are also owner configuration. A local archive and checksum are not an off-site backup.

## Privacy lifecycle

- Classify account, address, phone, order, payment-reference and notification data.
- Approve retention periods with the data controller before enabling destructive redaction.
- Keep notification recipient/payload scrubbing after successful delivery; retain only operational metadata needed for disputes and diagnostics.
- Run PII redaction in dry-run mode first, review counts and exceptions, then require a second explicit confirmation for writes.
- Document deletion requests, backups expiry, legal holds and audit-log retention. Do not delete records under an unresolved legal hold.
