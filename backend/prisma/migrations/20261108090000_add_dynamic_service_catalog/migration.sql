-- Dynamic service catalog: admin-managed services, packages, reusable add-ons and amenities.
-- Additive only: no existing table is altered, so historical orders, order items and
-- subscriptions keep the price snapshots they were created with.

-- CreateEnum
CREATE TYPE "ServiceBookingFlow" AS ENUM ('STANDARD', 'NO_EXTRAS', 'MEMBERSHIP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingIntervalUnit" AS ENUM ('ONE_TIME', 'PER_HOUR', 'PER_DAY', 'PER_MONTH', 'PER_YEAR', 'PER_SESSION', 'PER_ITEM', 'PER_SETUP', 'PER_BOOKING', 'PER_PODCAST', 'PER_CLIP', 'CUSTOM');

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryBadge" TEXT,
    "iconName" TEXT NOT NULL DEFAULT 'Layers',
    "heroImageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "flowType" "ServiceBookingFlow" NOT NULL DEFAULT 'STANDARD',
    "customSteps" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "unitAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingUnit" "BillingIntervalUnit" NOT NULL DEFAULT 'PER_MONTH',
    "durationMinutes" INTEGER,
    "durationDays" INTEGER,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "capacityText" TEXT,
    "capacityMin" INTEGER,
    "capacityMax" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rulesNotice" TEXT,
    "governmentNotice" TEXT,
    "adminFlagNote" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogAddOn" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "unitAmountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingUnit" "BillingIntervalUnit" NOT NULL DEFAULT 'ONE_TIME',
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "maxQuantity" INTEGER NOT NULL DEFAULT 10,
    "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "adminFlagNote" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAddOn" (
    "serviceId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "priceOverrideCents" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceAddOn_pkey" PRIMARY KEY ("serviceId","addOnId")
);

-- CreateTable
CREATE TABLE "PlanAddOn" (
    "planId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "priceOverrideCents" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanAddOn_pkey" PRIMARY KEY ("planId","addOnId")
);

-- CreateTable
CREATE TABLE "CatalogAmenity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "iconUrl" TEXT,
    "iconName" TEXT NOT NULL DEFAULT 'Check',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogAmenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceAmenity" (
    "serviceId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceAmenity_pkey" PRIMARY KEY ("serviceId","amenityId")
);

-- CreateTable
CREATE TABLE "PlanAmenity" (
    "planId" TEXT NOT NULL,
    "amenityId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanAmenity_pkey" PRIMARY KEY ("planId","amenityId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "ServiceCategory_active_displayOrder_idx" ON "ServiceCategory"("active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogPlan_slug_key" ON "CatalogPlan"("slug");

-- CreateIndex
CREATE INDEX "CatalogPlan_serviceId_active_sortOrder_idx" ON "CatalogPlan"("serviceId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogAddOn_slug_key" ON "CatalogAddOn"("slug");

-- CreateIndex
CREATE INDEX "CatalogAddOn_active_idx" ON "CatalogAddOn"("active");

-- CreateIndex
CREATE INDEX "ServiceAddOn_addOnId_idx" ON "ServiceAddOn"("addOnId");

-- CreateIndex
CREATE INDEX "PlanAddOn_addOnId_idx" ON "PlanAddOn"("addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogAmenity_slug_key" ON "CatalogAmenity"("slug");

-- CreateIndex
CREATE INDEX "CatalogAmenity_active_idx" ON "CatalogAmenity"("active");

-- CreateIndex
CREATE INDEX "ServiceAmenity_amenityId_idx" ON "ServiceAmenity"("amenityId");

-- CreateIndex
CREATE INDEX "PlanAmenity_amenityId_idx" ON "PlanAmenity"("amenityId");

-- AddForeignKey
ALTER TABLE "CatalogPlan" ADD CONSTRAINT "CatalogPlan_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddOn" ADD CONSTRAINT "ServiceAddOn_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAddOn" ADD CONSTRAINT "ServiceAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "CatalogAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAddOn" ADD CONSTRAINT "PlanAddOn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CatalogPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAddOn" ADD CONSTRAINT "PlanAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "CatalogAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAmenity" ADD CONSTRAINT "ServiceAmenity_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAmenity" ADD CONSTRAINT "ServiceAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "CatalogAmenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAmenity" ADD CONSTRAINT "PlanAmenity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CatalogPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAmenity" ADD CONSTRAINT "PlanAmenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "CatalogAmenity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
