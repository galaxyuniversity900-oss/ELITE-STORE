# Commerce end-to-end, load and recovery verification

This suite runs against the disposable Docker Compose stack in GitHub Actions. It does not contact live payment, courier, WhatsApp or email providers.

## Critical customer/admin journey

`npm run qa:commerce:e2e` verifies:
- Product catalogue response and an active/in-stock product.
- Guest cart creation and persistence of product/quantity.
- Checkout rejects a missing `Idempotency-Key`.
- Cash-on-delivery checkout creates one order and queues notifications transactionally.
- Replaying the same checkout key returns the original order without creating a duplicate.
- Admin APIs reject unauthenticated access.
- A CI-only bootstrap administrator can authenticate and read overview, orders and notification history.
- The new order has one WhatsApp and one email outbox record.
- Demo payment mutation endpoints remain unavailable in production mode.

## Load profile

`npm run qa:storefront:load` runs k6 against the read-only product catalogue:
- 5 virtual users ramp to 20 and then ramp down over 40 seconds.
- Failure rate must remain below 1%.
- P95 request latency must remain below 1,500 ms.
- More than 99% of checks must pass.

This is a CI regression profile, not a production capacity certification. Production sizing requires representative catalogue volume, network geography, cache state, database size, and a longer soak test.

## Backup and restore

`npm run qa:postgres:restore` creates a PostgreSQL custom-format backup and restores it into a fresh disposable database. It then compares every public table using both row counts and deterministic MD5 checksums over sorted JSON row representations, compares every public sequence's `last_value` and `is_called` state, and checks restored schema object counts for constraints, indexes, triggers, views and routines. Restore runs with `pg_restore --exit-on-error`; any restore error or mismatch fails the gate.

This validates logical dump/restore consistency for the disposable CI database. It does not prove production backup scheduling, encryption, off-site retention, point-in-time recovery (PITR), backup immutability, or an agreed RPO/RTO. Never point this test at production.

## Running locally

Start the full stack with the required disposable environment variables, then run the three commands above. Never point the restore test at a production database. The workflow tears down the disposable Compose volumes after verification.
