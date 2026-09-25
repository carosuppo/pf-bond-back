-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM (
  'AUTH_LOGIN_FAILED',
  'LOCATION_UNAUTHORIZED',
  'LOCATION_FORBIDDEN'
);

-- CreateEnum
CREATE TYPE "SecurityAlertType" AS ENUM (
  'AUTH_LOGIN_FAILED',
  'LOCATION_ACCESS_DENIED'
);

-- CreateEnum
CREATE TYPE "SecurityAlertStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "SecurityEvent" (
  "id" SERIAL NOT NULL,
  "type" "SecurityEventType" NOT NULL,
  "ip" VARCHAR(45),
  "userId" INTEGER,
  "identifierHash" CHAR(64),
  "method" VARCHAR(10) NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAlert" (
  "id" SERIAL NOT NULL,
  "type" "SecurityAlertType" NOT NULL,
  "correlationKey" VARCHAR(255) NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "windowSeconds" INTEGER NOT NULL,
  "status" "SecurityAlertStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx"
ON "SecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_identifierHash_createdAt_idx"
ON "SecurityEvent"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_createdAt_idx"
ON "SecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_ip_createdAt_idx"
ON "SecurityEvent"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityAlert_type_correlationKey_createdAt_idx"
ON "SecurityAlert"("type", "correlationKey", "createdAt");
