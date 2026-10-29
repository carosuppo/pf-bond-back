-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "expenseShareId" INTEGER NOT NULL,
    "fromMemberId" INTEGER NOT NULL,
    "toMemberId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExpensePayment_amountCents_check" CHECK ("amountCents" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayment_expenseShareId_key" ON "ExpensePayment"("expenseShareId");
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");
CREATE INDEX "ExpensePayment_fromMemberId_idx" ON "ExpensePayment"("fromMemberId");
CREATE INDEX "ExpensePayment_toMemberId_idx" ON "ExpensePayment"("toMemberId");

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseShareId_fkey" FOREIGN KEY ("expenseShareId") REFERENCES "ExpenseShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
