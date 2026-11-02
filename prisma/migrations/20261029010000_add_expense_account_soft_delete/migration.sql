ALTER TABLE "ExpenseAccount"
ADD COLUMN "createdByUserId" INTEGER,
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "ExpenseAccount"
ADD CONSTRAINT "ExpenseAccount_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
