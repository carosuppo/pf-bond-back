ALTER TABLE "ExpensePayment"
ALTER COLUMN "expenseShareId" DROP NOT NULL,
ADD COLUMN "adjustmentId" INTEGER;

ALTER TABLE "ExpensePayment"
ADD CONSTRAINT "ExpensePayment_obligation_check" CHECK (
    ("expenseShareId" IS NOT NULL AND "adjustmentId" IS NULL) OR
    ("expenseShareId" IS NULL AND "adjustmentId" IS NOT NULL)
);

ALTER TABLE "ExpensePayment"
ADD CONSTRAINT "ExpensePayment_adjustmentId_fkey"
FOREIGN KEY ("adjustmentId") REFERENCES "ExpenseAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ExpensePayment_adjustmentId_key"
ON "ExpensePayment"("adjustmentId");

INSERT INTO "ExpensePayment" (
    "expenseId",
    "adjustmentId",
    "fromMemberId",
    "toMemberId",
    "amountCents",
    "createdAt",
    "confirmedAt"
)
SELECT
    adjustment."expenseId",
    adjustment."id",
    adjustment."settledByMemberId",
    adjustment."creditorMemberId",
    adjustment."amountCents",
    adjustment."settledAt",
    adjustment."settledAt"
FROM "ExpenseAdjustment" AS adjustment
WHERE adjustment."status" = 'PAID';
