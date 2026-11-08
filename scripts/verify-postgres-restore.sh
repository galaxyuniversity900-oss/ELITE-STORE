#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
SOURCE_DB="${SOURCE_DB:-mes_store}"
DB_USER="${DB_USER:-mes_store}"
DUMP_FILE="$(mktemp)"
RESTORE_DB="${RESTORE_DB:-mes_store_restore_ci}"
cleanup() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres dropdb -U "$DB_USER" --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

psql_source() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$SOURCE_DB" "$@"
}
psql_restored() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -X -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$RESTORE_DB" "$@"
}

# Create a portable custom-format backup and restore it into a fresh disposable database.
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" -d "$SOURCE_DB" -Fc > "$DUMP_FILE"
test -s "$DUMP_FILE"
docker compose -f "$COMPOSE_FILE" exec -T postgres createdb -U "$DB_USER" -T template0 "$RESTORE_DB"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore -U "$DB_USER" -d "$RESTORE_DB" --clean --if-exists --no-owner --exit-on-error < "$DUMP_FILE"

# Require the core commerce and notification tables before integrity comparison.
REQUIRED_TABLES=(addresses orders order_items products notification_outbox notification_delivery_attempts notification_delivery_events)
SOURCE_TABLES="$(psql_source -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
RESTORED_TABLES="$(psql_restored -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
if [[ -z "$SOURCE_TABLES" ]]; then
  echo "No public tables found in source database"
  exit 1
fi
if [[ "$SOURCE_TABLES" != "$RESTORED_TABLES" ]]; then
  echo "PUBLIC TABLE LIST MISMATCH"
  echo "SOURCE:"
  printf '%s\\n' "$SOURCE_TABLES"
  echo "RESTORED:"
  printf '%s\\n' "$RESTORED_TABLES"
  exit 1
fi

TABLE_NAMES=()
while IFS= read -r table; do
  [[ -n "$table" ]] && TABLE_NAMES+=("$table")
done <<< "$SOURCE_TABLES"

for required in "${REQUIRED_TABLES[@]}"; do
  if ! printf '%s\\n' "${TABLE_NAMES[@]}" | grep -Fxq -- "$required"; then
    echo "REQUIRED TABLE MISSING from source backup: public.$required"
    exit 1
  fi
done

if [[ "${#TABLE_NAMES[@]}" -lt "${#REQUIRED_TABLES[@]}" ]]; then
  echo "Insufficient public table coverage: ${#TABLE_NAMES[@]} found, ${#REQUIRED_TABLES[@]} required"
  exit 1
fi

echo "Public tables discovered: ${TABLE_NAMES[*]}"
TABLE_COUNT=0
for table in "${TABLE_NAMES[@]}"; do
  source_sig="$(psql_source -v table_name="$table" -Atc 'SELECT COUNT(*) || '':'' || COALESCE(md5(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text)), md5('''')) FROM :"table_name" AS t')"
  restored_sig="$(psql_restored -v table_name="$table" -Atc 'SELECT COUNT(*) || '':'' || COALESCE(md5(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text)), md5('''')) FROM :"table_name" AS t')"
  if [[ "$source_sig" != "$restored_sig" ]]; then
    echo "DATA INTEGRITY MISMATCH in public.$table"
    echo "SOURCE:   $source_sig"
    echo "RESTORED: $restored_sig"
    exit 1
  fi
  TABLE_COUNT=$((TABLE_COUNT + 1))
done

# Compare every public sequence, including both last_value and is_called.
SOURCE_SEQUENCES="$(psql_source -Atc "SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")"
RESTORED_SEQUENCES="$(psql_restored -Atc "SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")"
if [[ "$SOURCE_SEQUENCES" != "$RESTORED_SEQUENCES" ]]; then
  echo "PUBLIC SEQUENCE LIST MISMATCH"
  echo "SOURCE:"
  printf '%s\\n' "$SOURCE_SEQUENCES"
  echo "RESTORED:"
  printf '%s\\n' "$RESTORED_SEQUENCES"
  exit 1
fi

SEQUENCE_NAMES=()
while IFS= read -r sequence; do
  [[ -n "$sequence" ]] && SEQUENCE_NAMES+=("$sequence")
done <<< "$SOURCE_SEQUENCES"

echo "Public sequences discovered: ${SEQUENCE_NAMES[*]:-none}"
SEQUENCE_COUNT=0
for sequence in "${SEQUENCE_NAMES[@]}"; do
  source_seq="$(psql_source -v sequence_name="$sequence" -Atc 'SELECT last_value || '':'' || is_called FROM :"sequence_name"')"
  restored_seq="$(psql_restored -v sequence_name="$sequence" -Atc 'SELECT last_value || '':'' || is_called FROM :"sequence_name"')"
  if [[ "$source_seq" != "$restored_seq" ]]; then
    echo "SEQUENCE STATE MISMATCH in public.$sequence"
    echo "SOURCE:   $source_seq"
    echo "RESTORED: $restored_seq"
    exit 1
  fi
  SEQUENCE_COUNT=$((SEQUENCE_COUNT + 1))
done

# Compare schema object counts after pg_restore has exited successfully.
SCHEMA_QUERY="SELECT 'constraints:' || COUNT(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' UNION ALL SELECT 'indexes:' || COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i' UNION ALL SELECT 'triggers:' || COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal UNION ALL SELECT 'views:' || COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m') UNION ALL SELECT 'routines:' || COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1;"
SOURCE_SCHEMA="$(psql_source -Atc "$SCHEMA_QUERY")"
RESTORED_SCHEMA="$(psql_restored -Atc "$SCHEMA_QUERY")"
if [[ "$SOURCE_SCHEMA" != "$RESTORED_SCHEMA" ]]; then
  echo "SCHEMA OBJECT COUNT MISMATCH"
  echo "SOURCE:"
  printf '%s\\n' "$SOURCE_SCHEMA"
  echo "RESTORED:"
  printf '%s\\n' "$RESTORED_SCHEMA"
  exit 1
fi

echo "PostgreSQL backup/restore integrity verification passed"
echo "Compared public tables: $TABLE_COUNT"
echo "Compared sequences: $SEQUENCE_COUNT"
echo "Schema object counts:"
printf '%s\\n' "$RESTORED_SCHEMA"
