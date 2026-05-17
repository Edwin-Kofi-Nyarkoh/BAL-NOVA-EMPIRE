-- CreateTable
CREATE TABLE "NovaCreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'posted',
    "source" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadUnlock" (
    "id" TEXT NOT NULL,
    "proId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "creditCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unlocked',
    "contactDeadline" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovaCreditTransaction_source_reference_key" ON "NovaCreditTransaction"("source", "reference");

-- CreateIndex
CREATE INDEX "NovaCreditTransaction_userId_createdAt_idx" ON "NovaCreditTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NovaCreditTransaction_userId_type_createdAt_idx" ON "NovaCreditTransaction"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadUnlock_proId_orderId_key" ON "LeadUnlock"("proId", "orderId");

-- CreateIndex
CREATE INDEX "LeadUnlock_proId_createdAt_idx" ON "LeadUnlock"("proId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadUnlock_orderId_createdAt_idx" ON "LeadUnlock"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "NovaCreditTransaction" ADD CONSTRAINT "NovaCreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadUnlock" ADD CONSTRAINT "LeadUnlock_proId_fkey" FOREIGN KEY ("proId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadUnlock" ADD CONSTRAINT "LeadUnlock_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
