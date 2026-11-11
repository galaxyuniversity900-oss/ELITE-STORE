CREATE TYPE "ProductRelationType" AS ENUM (
  'COMPLETE_THE_LOOK',
  'SIMILAR',
  'PAIR_WITH'
);

CREATE TABLE "product_relations" (
  "id" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "relatedProductId" TEXT NOT NULL,
  "relationType" "ProductRelationType" NOT NULL DEFAULT 'COMPLETE_THE_LOOK',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_relations_no_self_reference_check" CHECK ("sourceProductId" <> "relatedProductId")
);

CREATE UNIQUE INDEX "product_relations_source_related_type_key"
  ON "product_relations"("sourceProductId", "relatedProductId", "relationType");
CREATE INDEX "product_relations_source_type_sort_idx"
  ON "product_relations"("sourceProductId", "relationType", "sortOrder");
CREATE INDEX "product_relations_related_type_idx"
  ON "product_relations"("relatedProductId", "relationType");

ALTER TABLE "product_relations"
  ADD CONSTRAINT "product_relations_sourceProductId_fkey"
  FOREIGN KEY ("sourceProductId") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_relations"
  ADD CONSTRAINT "product_relations_relatedProductId_fkey"
  FOREIGN KEY ("relatedProductId") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
