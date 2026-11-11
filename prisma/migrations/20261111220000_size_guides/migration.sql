CREATE TABLE "size_guides" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "measurementUnit" TEXT NOT NULL DEFAULT 'cm',
  "measurements" JSONB NOT NULL,
  "fitAdvice" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "size_guides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "size_guides_categoryId_name_key" ON "size_guides"("categoryId", "name");
CREATE INDEX "size_guides_categoryId_isActive_idx" ON "size_guides"("categoryId", "isActive");

ALTER TABLE "size_guides"
  ADD CONSTRAINT "size_guides_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
