-- CreateEnum
CREATE TYPE "ExpenseSplitType" AS ENUM ('EQUAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "expenseAccountId" INTEGER NOT NULL,
    "payerMemberId" INTEGER NOT NULL,
    "title" TEXT,
    "amountCents" INTEGER NOT NULL,
    "splitType" "ExpenseSplitType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_expenseAccountId_idx" ON "Expense"("expenseAccountId");

-- CreateIndex
CREATE INDEX "Expense_payerMemberId_idx" ON "Expense"("payerMemberId");

-- CreateIndex
CREATE INDEX "ExpenseShare_memberId_idx" ON "ExpenseShare"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseShare_expenseId_memberId_key" ON "ExpenseShare"("expenseId", "memberId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ExpenseAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payerMemberId_fkey" FOREIGN KEY ("payerMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
