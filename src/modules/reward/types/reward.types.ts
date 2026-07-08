import { OnChainStatus } from '@prisma/client';

export interface ProcessCompletedMatchInput {
  matchId: string;
  winnerId: string;
  winnerWallet: string | null;
  currentStreak: number;
  resultHash: string;
  gameType?: string;
  timestamp?: number;
}

export interface RewardProcessResult {
  onChainStatus: OnChainStatus;
  onChainTxHash: string | null;
  verifiedAt: Date | null;
  pointsAwarded: number;
  badgeAwarded: number;
  transactionHashes: string[];
  blockNumber?: number;
  elapsedMs: number;
  error?: string;
}
