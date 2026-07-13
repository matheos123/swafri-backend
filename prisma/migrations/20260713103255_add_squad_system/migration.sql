-- CreateEnum
CREATE TYPE "SquadRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_INVITE_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_MEMBER_JOINED';
ALTER TYPE "NotificationType" ADD VALUE 'SQUAD_MEMBER_LEFT';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "squadId" TEXT;

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SquadRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadInvite" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SquadInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Squad_ownerId_idx" ON "Squad"("ownerId");

-- CreateIndex
CREATE INDEX "SquadMember_squadId_idx" ON "SquadMember"("squadId");

-- CreateIndex
CREATE INDEX "SquadMember_userId_idx" ON "SquadMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_userId_key" ON "SquadMember"("squadId", "userId");

-- CreateIndex
CREATE INDEX "SquadInvite_squadId_idx" ON "SquadInvite"("squadId");

-- CreateIndex
CREATE INDEX "SquadInvite_inviteeId_idx" ON "SquadInvite"("inviteeId");

-- CreateIndex
CREATE INDEX "SquadInvite_status_idx" ON "SquadInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SquadInvite_squadId_inviteeId_key" ON "SquadInvite"("squadId", "inviteeId");

-- CreateIndex
CREATE INDEX "ChatMessage_squadId_idx" ON "ChatMessage"("squadId");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadInvite" ADD CONSTRAINT "SquadInvite_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadInvite" ADD CONSTRAINT "SquadInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadInvite" ADD CONSTRAINT "SquadInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
