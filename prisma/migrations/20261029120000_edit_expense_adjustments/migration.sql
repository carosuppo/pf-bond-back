CREATE TYPE "ExpenseAdjustmentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

ALTER TABLE "Expense"
ADD COLUMN "createdByUserId" INTEGER,
ADD COLUMN "lastEditedByUserId" INTEGER,
ADD COLUMN "lastEditedAt" TIMESTAMP(3);

ALTER TABLE "ExpenseShare"
ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ExpenseAdjustment" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "expenseShareId" INTEGER NOT NULL,
    "debtorMemberId" INTEGER NOT NULL,
    "creditorMemberId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "ExpenseAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "settledByMemberId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "ExpenseAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExpenseAdjustment_amountCents_check" CHECK ("amountCents" > 0),
    CONSTRAINT "ExpenseAdjustment_members_check" CHECK ("debtorMemberId" <> "creditorMemberId"),
    CONSTRAINT "ExpenseAdjustment_settlement_check" CHECK (
        ("status" = 'PAID' AND "settledAt" IS NOT NULL AND "settledByMemberId" = "debtorMemberId") OR
        ("status" <> 'PAID' AND "settledAt" IS NULL AND "settledByMemberId" IS NULL)
    )
);

CREATE INDEX "ExpenseAdjustment_expenseId_status_idx" ON "ExpenseAdjustment"("expenseId", "status");
CREATE INDEX "ExpenseAdjustment_expenseShareId_status_idx" ON "ExpenseAdjustment"("expenseShareId", "status");
CREATE INDEX "ExpenseAdjustment_debtorMemberId_status_idx" ON "ExpenseAdjustment"("debtorMemberId", "status");
CREATE INDEX "ExpenseAdjustment_creditorMemberId_status_idx" ON "ExpenseAdjustment"("creditorMemberId", "status");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_lastEditedByUserId_fkey"
FOREIGN KEY ("lastEditedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdjustment" ADD CONSTRAINT "ExpenseAdjustment_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdjustment" ADD CONSTRAINT "ExpenseAdjustment_expenseShareId_fkey"
FOREIGN KEY ("expenseShareId") REFERENCES "ExpenseShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdjustment" ADD CONSTRAINT "ExpenseAdjustment_debtorMemberId_fkey"
FOREIGN KEY ("debtorMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdjustment" ADD CONSTRAINT "ExpenseAdjustment_creditorMemberId_fkey"
FOREIGN KEY ("creditorMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseAdjustment" ADD CONSTRAINT "ExpenseAdjustment_settledByMemberId_fkey"
FOREIGN KEY ("settledByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
