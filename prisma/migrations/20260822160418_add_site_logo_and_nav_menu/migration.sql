-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "site_logo" VARCHAR(500);

-- CreateTable
CREATE TABLE "NavMenu" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(50) NOT NULL,
    "href" VARCHAR(200) NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NavMenu_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NavMenu_active_sort_idx" ON "NavMenu"("active", "sort");
