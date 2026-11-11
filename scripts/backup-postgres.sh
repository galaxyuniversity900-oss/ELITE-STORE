#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/postgres}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
# Include process-local entropy so a restore safety backup cannot overwrite
# the original archive when both backups start in the same second.
ARCHIVE="$BACKUP_DIR/mes-store-$STAMP-${BASHPID}-$RANDOM.dump"
TMP="$ARCHIVE.partial"
while [[ -e "$ARCHIVE" || -e "$TMP" || -e "$ARCHIVE.sha256" || -e "$ARCHIVE.manifest" ]]; do
  ARCHIVE="$BACKUP_DIR/mes-store-$STAMP-${BASHPID}-$RANDOM.dump"
  TMP="$ARCHIVE.partial"
done
trap 'rm -f "$TMP"' EXIT

command -v docker >/dev/null || { echo "ERROR: docker is required." >&2; exit 1; }
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -ec '
  : "${POSTGRES_DB:?POSTGRES_DB is not set in the database container}"
  : "${POSTGRES_USER:?POSTGRES_USER is not set in the database container}"
  pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"
' > "$TMP"

test -s "$TMP" || { echo "ERROR: pg_dump produced an empty archive." >&2; exit 1; }
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" sh -ec 'pg_restore --list' < "$TMP" >/dev/null
mv "$TMP" "$ARCHIVE"
chmod 600 "$ARCHIVE"
HASH="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
cat > "$ARCHIVE.sha256" <<EOF
$HASH  $(basename "$ARCHIVE")
EOF
chmod 600 "$ARCHIVE.sha256"

cat > "$ARCHIVE.manifest" <<EOF
{
  "format": "postgresql-custom",
  "createdAt": "$STAMP",
  "archive": "$(basename "$ARCHIVE")",
  "sha256": "$HASH",
  "database": "resolved inside PostgreSQL container",
  "includesRoles": false,
  "includesOwnershipAndACL": false
}
EOF
chmod 600 "$ARCHIVE.manifest"
echo "Backup created: $ARCHIVE"
echo "SHA-256: $HASH"
echo "Store this archive and its manifest in encrypted off-host storage."
