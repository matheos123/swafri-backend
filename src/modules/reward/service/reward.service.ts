import { Injectable, Logger } from '@nestjs/common';
import { OnChainStatus } from '@prisma/client';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { BlockchainTransactionRevertedException } from '../../blockchain/exceptions/blockchain.exceptions';
import { GAME_TYPE_RPS, WIN_POINTS } from '../constants/reward.constants';
import { ProcessCompletedMatchInput, RewardProcessResult } from '../types/reward.types';
import { determineBadgeForStreak } from '../utils/badge-eligibility.util';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  async processCompletedMatch(input: ProcessCompletedMatchInput): Promise<RewardProcessResult> {
    const startedAt = Date.now();
    const gameType = input.gameType ?? GAME_TYPE_RPS;
    const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
    const badgeId = determineBadgeForStreak(input.currentStreak) ?? 0;

    const baseResult: RewardProcessResult = {
      onChainStatus: OnChainStatus.PENDING,
      onChainTxHash: null,
      verifiedAt: null,
      pointsAwarded: WIN_POINTS,
      badgeAwarded: badgeId,
      transactionHashes: [],
      elapsedMs: 0,
    };

    if (!input.winnerWallet) {
      const message = 'Winner has no linked wallet — blockchain rewards deferred';
      this.logger.warn({ matchId: input.matchId, winnerId: input.winnerId, message });
      return { ...baseResult, error: message, elapsedMs: Date.now() - startedAt };
    }

    if (!this.blockchainService.isReady()) {
      const message = 'Blockchain service unavailable — rewards deferred';
      this.logger.warn({ matchId: input.matchId, winnerId: input.winnerId, message });
      return { ...baseResult, error: message, elapsedMs: Date.now() - startedAt };
    }

    const transactionHashes: string[] = [];

    try {
      const recordTx = await this.blockchainService.recordMatch({
        matchId: input.matchId,
        winner: input.winnerWallet,
        timestamp,
        gameType,
        resultHash: input.resultHash,
        pointsAwarded: WIN_POINTS,
        badgeEarned: badgeId,
      });
      transactionHashes.push(recordTx.transactionHash);

      const pointsTx = await this.blockchainService.awardPoints(input.winnerWallet, WIN_POINTS);
      transactionHashes.push(pointsTx.transactionHash);

      if (badgeId > 0) {
        await this.mintBadgeIfEligible(
          input.matchId,
          input.winnerWallet,
          badgeId,
          transactionHashes,
        );
      }

      const elapsedMs = Date.now() - startedAt;
      this.logger.log({
        matchId: input.matchId,
        winner: input.winnerWallet,
        pointsAwarded: WIN_POINTS,
        badgeAwarded: badgeId,
        transactionHash: recordTx.transactionHash,
        transactionHashes,
        elapsedMs,
      });

      return {
        onChainStatus: OnChainStatus.CONFIRMED,
        onChainTxHash: recordTx.transactionHash,
        verifiedAt: new Date(),
        pointsAwarded: WIN_POINTS,
        badgeAwarded: badgeId,
        transactionHashes,
        blockNumber: recordTx.blockNumber,
        elapsedMs,
      };
    } catch (error) {
      const message = (error as Error).message;
      const elapsedMs = Date.now() - startedAt;

      this.logger.error({
        matchId: input.matchId,
        winner: input.winnerWallet,
        pointsAwarded: WIN_POINTS,
        badgeAwarded: badgeId,
        transactionHashes,
        elapsedMs,
        error: message,
      });

      return {
        ...baseResult,
        onChainTxHash: transactionHashes[0] ?? null,
        badgeAwarded: badgeId,
        transactionHashes,
        elapsedMs,
        error: message,
      };
    }
  }

  private async mintBadgeIfEligible(
    matchId: string,
    winnerWallet: string,
    badgeId: number,
    transactionHashes: string[],
  ): Promise<void> {
    try {
      const badgeTx = await this.blockchainService.mintBadge(winnerWallet, badgeId);
      transactionHashes.push(badgeTx.transactionHash);
    } catch (error) {
      if (
        error instanceof BlockchainTransactionRevertedException &&
        error.message.includes('BadgeAlreadyMinted')
      ) {
        this.logger.warn({
          matchId,
          winner: winnerWallet,
          badgeId,
          message: 'Badge already minted on-chain — skipping',
        });
        return;
      }
      throw error;
    }
  }
}
