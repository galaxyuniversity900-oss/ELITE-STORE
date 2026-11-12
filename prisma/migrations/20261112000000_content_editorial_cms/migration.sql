CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "content_pages" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" JSONB NOT NULL,
  "heroImageUrl" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");
CREATE INDEX "content_pages_status_publishedAt_idx" ON "content_pages"("status", "publishedAt");

CREATE TABLE "editorial_collections" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "body" JSONB,
  "heroImageUrl" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "editorial_collections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "editorial_collections_slug_key" ON "editorial_collections"("slug");
CREATE INDEX "editorial_collections_status_publishedAt_idx" ON "editorial_collections"("status", "publishedAt");

CREATE TABLE "editorial_collection_items" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "editorial_collection_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "editorial_collection_items_collectionId_productId_key"
  ON "editorial_collection_items"("collectionId", "productId");
CREATE INDEX "editorial_collection_items_collectionId_sortOrder_idx"
  ON "editorial_collection_items"("collectionId", "sortOrder");

ALTER TABLE "editorial_collection_items"
  ADD CONSTRAINT "editorial_collection_items_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "editorial_collections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "editorial_collection_items"
  ADD CONSTRAINT "editorial_collection_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
