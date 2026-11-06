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

# Create a portable custom-format backup and restore it into a fresh database.
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" -d "$SOURCE_DB" -Fc > "$DUMP_FILE"
test -s "$DUMP_FILE"
docker compose -f "$COMPOSE_FILE" exec -T postgres createdb -U "$DB_USER" -T template0 "$RESTORE_DB"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore -U "$DB_USER" -d "$RESTORE_DB" --clean --if-exists --no-owner --exit-on-error < "$DUMP_FILE"

# Compare every public table by row count and deterministic content checksum.
# format('%I', ...) returns safely quoted SQL identifiers from the catalog.
TABLES="$(psql_source -Atc "SELECT format('%I', tablename) FROM pg_tables WHERE schemaname='public' ORDER BY tablename")"
test -n "$TABLES"
TABLE_COUNT=0
while IFS= read -r table; do
  [[ -n "$table" ]] || continue
  source_sig="$(psql_source -Atc "SELECT COUNT(*) || ':' || COALESCE(md5(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text)), md5('')) FROM $table AS t")"
  restored_sig="$(psql_restored -Atc "SELECT COUNT(*) || ':' || COALESCE(md5(string_agg(to_jsonb(t)::text, chr(10) ORDER BY to_jsonb(t)::text)), md5('')) FROM $table AS t")"
  if [[ "$source_sig" != "$restored_sig" ]]; then
    echo "DATA INTEGRITY MISMATCH in public.$table"
    echo "SOURCE:   $source_sig"
    echo "RESTORED: $restored_sig"
    exit 1
  fi
  TABLE_COUNT=$((TABLE_COUNT + 1))
done <<< "$TABLES"

# Compare every public sequence's current value and is_called state.
SEQUENCES="$(psql_source -Atc "SELECT format('%I', sequencename) FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")"
SEQUENCE_COUNT=0
while IFS= read -r sequence; do
  [[ -n "$sequence" ]] || continue
  source_seq="$(psql_source -Atc "SELECT last_value || ':' || is_called FROM $sequence")"
  restored_seq="$(psql_restored -Atc "SELECT last_value || ':' || is_called FROM $sequence")"
  if [[ "$source_seq" != "$restored_seq" ]]; then
    echo "SEQUENCE STATE MISMATCH in public.$sequence"
    echo "SOURCE:   $source_seq"
    echo "RESTORED: $restored_seq"
    exit 1
  fi
  SEQUENCE_COUNT=$((SEQUENCE_COUNT + 1))
done <<< "$SEQUENCES"

# pg_restore exits on any DDL/data error; compare resulting schema object counts.
SCHEMA_QUERY="SELECT 'constraints:' || COUNT(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' UNION ALL SELECT 'indexes:' || COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i' UNION ALL SELECT 'triggers:' || COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal UNION ALL SELECT 'views:' || COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m') UNION ALL SELECT 'routines:' || COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1;"
SOURCE_SCHEMA="$(psql_source -Atc "$SCHEMA_QUERY")"
RESTORED_SCHEMA="$(psql_restored -Atc "$SCHEMA_QUERY")"
if [[ "$SOURCE_SCHEMA" != "$RESTORED_SCHEMA" ]]; then
  echo "SCHEMA OBJECT COUNT MISMATCH"
  echo "SOURCE:"
  printf '%s\n' "$SOURCE_SCHEMA"
  echo "RESTORED:"
  printf '%s\n' "$RESTORED_SCHEMA"
  exit 1
fi

echo "PostgreSQL backup/restore integrity verification passed"
echo "Compared public tables: $TABLE_COUNT"
echo "Compared sequences: $SEQUENCE_COUNT"
echo "Schema object counts:"
printf '%s\n' "$RESTORED_SCHEMA"
