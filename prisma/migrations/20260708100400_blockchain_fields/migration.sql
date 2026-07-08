-- This migration was applied directly to the database and is being reconciled locally.
-- CreateEnum
CREATE TYPE "OnChainStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "onChainStatus" "OnChainStatus";
ALTER TABLE "Match" ADD COLUMN "onChainTxHash" TEXT;
ALTER TABLE "Match" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN "onChainPoints" INTEGER NOT NULL DEFAULT 0;
