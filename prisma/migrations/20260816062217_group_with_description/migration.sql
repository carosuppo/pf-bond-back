/*
  Warnings:

  - You are about to drop the column `roleId` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[invitationCode]` on the table `Group` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invitationCode` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdByUserId` to the `PointOfInterest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `radius` to the `PointOfInterest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_roleId_fkey";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "description" TEXT,
ADD COLUMN     "invitationCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "roleId",
ADD COLUMN     "role" "RoleEnum" NOT NULL;

-- AlterTable
ALTER TABLE "PointOfInterest" ADD COLUMN     "createdByUserId" INTEGER NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "radius" DOUBLE PRECISION NOT NULL;

-- DropTable
DROP TABLE "Role";

-- CreateIndex
CREATE UNIQUE INDEX "Group_invitationCode_key" ON "Group"("invitationCode");
