CREATE TABLE "DevicePushToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevicePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevicePushToken_token_key" ON "DevicePushToken"("token");
CREATE INDEX "DevicePushToken_userId_idx" ON "DevicePushToken"("userId");

ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
