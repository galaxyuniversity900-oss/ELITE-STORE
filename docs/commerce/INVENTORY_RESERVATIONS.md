# Inventory reservation expiry

Checkout still decrements finite product stock atomically, and now creates an `ACTIVE` reservation for each finite-stock order line in the same database transaction. Each reservation expires after 30 minutes.

Order lifecycle integration:
- Confirmation consumes active reservations without restoring stock.
- Cancellation releases active reservations and restores their quantities in the same transaction.
- Legacy orders without reservation rows retain the existing stock-restoration path.
- A successful demo payment consumes the order's active reservations.

## Expiry worker

Run:

`npm run inventory:expire-reservations`

Schedule it from the deployment scheduler (for example, once per minute). The worker groups reservations by order, then atomically cancels an expired pending order, marks all due holds expired, restores all affected product quantities, and appends an order status event. It is safe to re-run: terminal reservations are not processed again. The batch size is configurable with `INVENTORY_EXPIRY_BATCH_SIZE` (default 100 reservation rows; max 500).

The repository adds the worker command but does not configure a production scheduler. Configure and monitor the schedule in the target environment before claiming automatic expiry is live. The worker must run with a least-privilege database role and should be monitored for skipped orders and transaction failures.

This foundation currently reserves product-level stock. Variant-level reservation is a follow-up dependency for making ProductVariant SKUs purchasable.
