#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker/docker-compose.yml}"
DUMP_FILE="$(mktemp)"
RESTORE_DB="mes_store_restore_ci"
cleanup() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres dropdb -U mes_store --if-exists "$RESTORE_DB" >/dev/null 2>&1 || true
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U mes_store -d mes_store -Fc > "$DUMP_FILE"
test -s "$DUMP_FILE"
docker compose -f "$COMPOSE_FILE" exec -T postgres createdb -U mes_store -T template0 "$RESTORE_DB"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_restore -U mes_store -d "$RESTORE_DB" --no-owner --exit-on-error < "$DUMP_FILE"

QUERY="SELECT 'products:' || COUNT(*) FROM products UNION ALL SELECT 'orders:' || COUNT(*) FROM orders UNION ALL SELECT 'order_items:' || COUNT(*) FROM order_items UNION ALL SELECT 'payments:' || COUNT(*) FROM payments UNION ALL SELECT 'notification_outbox:' || COUNT(*) FROM notification_outbox UNION ALL SELECT 'notification_delivery_attempts:' || COUNT(*) FROM notification_delivery_attempts UNION ALL SELECT 'notification_delivery_events:' || COUNT(*) FROM notification_delivery_events ORDER BY 1;"
SOURCE_COUNTS="$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U mes_store -d mes_store -Atc "$QUERY")"
RESTORED_COUNTS="$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U mes_store -d "$RESTORE_DB" -Atc "$QUERY")"
if [[ "$SOURCE_COUNTS" != "$RESTORED_COUNTS" ]]; then
  echo "Backup restore row-count mismatch"
  echo "SOURCE:"
  printf '%s\n' "$SOURCE_COUNTS"
  echo "RESTORED:"
  printf '%s\n' "$RESTORED_COUNTS"
  exit 1
fi
echo "PostgreSQL backup/restore verification passed"
printf '%s\n' "$RESTORED_COUNTS"
