-- Artisan verification packets from the Bal Nova signup flow.
CREATE TABLE "ArtisanOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "legalName" TEXT,
    "phone" TEXT,
    "ghanaCardNumber" TEXT,
    "ghanaCardFrontUrl" TEXT,
    "ghanaCardBackUrl" TEXT,
    "livenessSelfieUrl" TEXT,
    "guarantorName" TEXT,
    "guarantorPhone" TEXT,
    "guarantorIdNumber" TEXT,
    "primaryTrade" TEXT,
    "subSpecialties" JSONB,
    "operationalBase" TEXT,
    "operationalLat" DOUBLE PRECISION,
    "operationalLng" DOUBLE PRECISION,
    "momoNumber" TEXT,
    "payoutAccountName" TEXT,
    "headshotUrl" TEXT,
    "diagnosticFee" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "bio" TEXT,
    "workPhotos" JSONB,
    "companyName" TEXT,
    "rgdCertificateUrl" TEXT,
    "directorCardUrl" TEXT,
    "corporateTin" TEXT,
    "officeLocation" TEXT,
    "officeLat" DOUBLE PRECISION,
    "officeLng" DOUBLE PRECISION,
    "technicianCount" INTEGER,
    "tradeCategories" JSONB,
    "payoutAccount" TEXT,
    "logoUrl" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArtisanOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtisanOnboarding_userId_key" ON "ArtisanOnboarding"("userId");
CREATE INDEX "ArtisanOnboarding_track_status_idx" ON "ArtisanOnboarding"("track", "status");
CREATE INDEX "ArtisanOnboarding_primaryTrade_idx" ON "ArtisanOnboarding"("primaryTrade");

ALTER TABLE "ArtisanOnboarding"
ADD CONSTRAINT "ArtisanOnboarding_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer hire, diagnostic payment, quote, escrow, resolution workflow.
CREATE TABLE "HireRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "proId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "polishedDescription" TEXT,
    "trade" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'standard',
    "status" TEXT NOT NULL DEFAULT 'awaiting_diagnostic_payment',
    "diagnosticFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "surgeFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diagnosticPaymentId" TEXT,
    "finalQuoteAmount" DOUBLE PRECISION,
    "finalQuoteNote" TEXT,
    "finalPaymentId" TEXT,
    "location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HireRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HireRequest_customerId_createdAt_idx" ON "HireRequest"("customerId", "createdAt");
CREATE INDEX "HireRequest_proId_status_createdAt_idx" ON "HireRequest"("proId", "status", "createdAt");
CREATE INDEX "HireRequest_trade_urgency_status_createdAt_idx" ON "HireRequest"("trade", "urgency", "status", "createdAt");

ALTER TABLE "HireRequest"
ADD CONSTRAINT "HireRequest_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HireRequest"
ADD CONSTRAINT "HireRequest_proId_fkey"
FOREIGN KEY ("proId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
