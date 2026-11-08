#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
ARCHIVE="${1:-}"
EXPECTED_DB="${RESTORE_DATABASE_NAME:-}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: RESTORE_DATABASE_NAME=<target-db> $0 <backup.dump>" >&2
  exit 2
fi
if [[ -z "$EXPECTED_DB" || "${CONFIRM_DATABASE_RESTORE:-}" != "YES" ]]; then
  echo "Refusing restore. Set RESTORE_DATABASE_NAME and CONFIRM_DATABASE_RESTORE=YES." >&2
  exit 2
fi
command -v docker >/dev/null || { echo "ERROR: docker is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required." >&2; exit 1; }

SIDECAR="$ARCHIVE.sha256"
[[ -f "$SIDECAR" ]] || { echo "ERROR: SHA-256 sidecar is missing." >&2; exit 1; }
(cd "$(dirname "$ARCHIVE")" && sha256sum --check "$(basename "$SIDECAR")")

# Confirm the requested database matches the database configured in the container.
ACTUAL_DB="$(docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -ec 'printf %s "$POSTGRES_DB"')"
[[ "$EXPECTED_DB" == "$ACTUAL_DB" ]] || {
  echo "ERROR: target database confirmation does not match configured database." >&2
  exit 1
}

# Validate archive readability before touching the target database.
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" pg_restore --list < "$ARCHIVE" >/dev/null

# Take a fresh safety backup before the destructive restore.
BACKUP_DIR="$BACKUP_DIR" COMPOSE_FILE="$COMPOSE_FILE" POSTGRES_SERVICE="$SERVICE" "$ROOT_DIR/scripts/backup-postgres.sh"

echo "Restoring PostgreSQL database '$ACTUAL_DB'. Existing objects may be dropped."
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -ec '
  pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error --single-transaction --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' < "$ARCHIVE"

# Basic post-restore integrity checks: migrations table and required commerce tables.
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -ec '
  psql --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" <<'SQL'
DO $restore_check$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RAISE EXCEPTION 'Prisma migrations table is missing after restore';
  END IF;
  IF (
    SELECT COUNT(*) FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('notification_outbox','notification_delivery_attempts','notification_delivery_events')
  ) <> 3 THEN
    RAISE EXCEPTION 'Notification outbox schema is incomplete after restore';
  END IF;
END
$restore_check$;
SQL
'
echo "Restore command completed. Run application smoke tests and compare business record counts before reopening traffic."
