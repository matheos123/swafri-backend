/*
  Warnings:

  - You are about to drop the column `onChainStatus` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `onChainTxHash` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `verifiedAt` on the `Match` table. All the data in the column will be lost.
  - You are about to drop the column `onChainPoints` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Match" DROP COLUMN "onChainStatus",
DROP COLUMN "onChainTxHash",
DROP COLUMN "verifiedAt";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "onChainPoints",
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "OnChainStatus";

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
