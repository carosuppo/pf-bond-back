-- CreateTable
CREATE TABLE "ExpenseAccount" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAccountMember" (
    "id" SERIAL NOT NULL,
    "expenseAccountId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,

    CONSTRAINT "ExpenseAccountMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseAccount_groupId_idx" ON "ExpenseAccount"("groupId");

-- CreateIndex
CREATE INDEX "ExpenseAccount_eventId_idx" ON "ExpenseAccount"("eventId");

-- CreateIndex
CREATE INDEX "ExpenseAccountMember_memberId_idx" ON "ExpenseAccountMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAccountMember_expenseAccountId_memberId_key" ON "ExpenseAccountMember"("expenseAccountId", "memberId");

-- AddForeignKey
ALTER TABLE "ExpenseAccount" ADD CONSTRAINT "ExpenseAccount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAccount" ADD CONSTRAINT "ExpenseAccount_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAccountMember" ADD CONSTRAINT "ExpenseAccountMember_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "ExpenseAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAccountMember" ADD CONSTRAINT "ExpenseAccountMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
