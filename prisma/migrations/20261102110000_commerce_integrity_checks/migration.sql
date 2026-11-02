-- Enforce core money, quantity and inventory invariants at the database boundary.
-- These checks complement DTO validation; they protect writes from future code paths
-- and accidental direct SQL. Existing invalid rows intentionally fail the migration
-- so they can be reviewed rather than silently rewritten.

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_positive_check"
    CHECK ("price" > 0),
  ADD CONSTRAINT "products_compare_at_price_nonnegative_check"
    CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= 0),
  ADD CONSTRAINT "products_stock_nonnegative_check"
    CHECK ("stockQuantity" IS NULL OR "stockQuantity" >= 0);

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_quantity_range_check"
    CHECK ("quantity" BETWEEN 1 AND 20),
  ADD CONSTRAINT "cart_items_unit_price_nonnegative_check"
    CHECK ("unitPrice" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_totals_nonnegative_check"
    CHECK (
      "subtotal" >= 0
      AND "discountTotal" >= 0
      AND "shippingTotal" >= 0
      AND "grandTotal" >= 0
    ),
  ADD CONSTRAINT "orders_total_reconciliation_check"
    CHECK ("grandTotal" = "subtotal" - "discountTotal" + "shippingTotal"),
  ADD CONSTRAINT "orders_discount_within_total_check"
    CHECK ("discountTotal" <= "subtotal" + "shippingTotal");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive_check"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_amounts_nonnegative_check"
    CHECK ("unitPrice" >= 0 AND "lineTotal" >= 0),
  ADD CONSTRAINT "order_items_line_total_check"
    CHECK ("lineTotal" = "unitPrice" * "quantity");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_nonnegative_check"
    CHECK ("amount" >= 0);
