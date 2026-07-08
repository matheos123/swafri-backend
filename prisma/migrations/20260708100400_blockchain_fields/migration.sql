-- CreateEnum
CREATE TYPE "OnChainStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "onChainPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "onChainTxHash" TEXT,
ADD COLUMN "onChainStatus" "OnChainStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verifiedAt" TIMESTAMP(3);
