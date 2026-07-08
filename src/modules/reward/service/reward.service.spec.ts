import { OnChainStatus } from '@prisma/client';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { BlockchainTransactionRevertedException } from '../../blockchain/exceptions/blockchain.exceptions';
import { RewardService } from './reward.service';

describe('RewardService', () => {
  let rewardService: RewardService;
  let blockchainService: jest.Mocked<
    Pick<BlockchainService, 'isReady' | 'recordMatch' | 'awardPoints' | 'mintBadge'>
  >;

  const baseInput = {
    matchId: 'match-uuid-1',
    winnerId: 'user-1',
    winnerWallet: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb',
    currentStreak: 3,
    resultHash: '0xabc123',
    gameType: 'rps',
    timestamp: 1_700_000_000,
  };

  beforeEach(() => {
    blockchainService = {
      isReady: jest.fn().mockReturnValue(true),
      recordMatch: jest.fn().mockResolvedValue({
        transactionHash: '0xrecord',
        gasUsed: '100000',
        blockNumber: 42,
      }),
      awardPoints: jest.fn().mockResolvedValue({
        transactionHash: '0xpoints',
        gasUsed: '80000',
        blockNumber: 43,
      }),
      mintBadge: jest.fn().mockResolvedValue({
        transactionHash: '0xbadge',
        gasUsed: '90000',
        blockNumber: 44,
      }),
    };

    rewardService = new RewardService(blockchainService as unknown as BlockchainService);
  });

  it('records match, awards points, and mints badge at streak milestone', async () => {
    const result = await rewardService.processCompletedMatch(baseInput);

    expect(blockchainService.recordMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: baseInput.matchId,
        winner: baseInput.winnerWallet,
        pointsAwarded: 10,
        badgeEarned: 1,
      }),
    );
    expect(blockchainService.awardPoints).toHaveBeenCalledWith(baseInput.winnerWallet, 10);
    expect(blockchainService.mintBadge).toHaveBeenCalledWith(baseInput.winnerWallet, 1);
    expect(result.onChainStatus).toBe(OnChainStatus.CONFIRMED);
    expect(result.onChainTxHash).toBe('0xrecord');
    expect(result.pointsAwarded).toBe(10);
    expect(result.badgeAwarded).toBe(1);
    expect(result.transactionHashes).toEqual(['0xrecord', '0xpoints', '0xbadge']);
  });

  it('does not mint badge when streak is not a milestone', async () => {
    const result = await rewardService.processCompletedMatch({
      ...baseInput,
      currentStreak: 4,
    });

    expect(blockchainService.mintBadge).not.toHaveBeenCalled();
    expect(result.badgeAwarded).toBe(0);
    expect(result.onChainStatus).toBe(OnChainStatus.CONFIRMED);
  });

  it('returns pending when winner has no wallet', async () => {
    const result = await rewardService.processCompletedMatch({
      ...baseInput,
      winnerWallet: null,
    });

    expect(blockchainService.recordMatch).not.toHaveBeenCalled();
    expect(result.onChainStatus).toBe(OnChainStatus.PENDING);
    expect(result.error).toContain('no linked wallet');
  });

  it('returns pending when blockchain is unavailable', async () => {
    blockchainService.isReady.mockReturnValue(false);

    const result = await rewardService.processCompletedMatch(baseInput);

    expect(blockchainService.recordMatch).not.toHaveBeenCalled();
    expect(result.onChainStatus).toBe(OnChainStatus.PENDING);
    expect(result.error).toContain('unavailable');
  });

  it('returns pending when blockchain write fails', async () => {
    blockchainService.recordMatch.mockRejectedValue(new Error('RPC timeout'));

    const result = await rewardService.processCompletedMatch(baseInput);

    expect(result.onChainStatus).toBe(OnChainStatus.PENDING);
    expect(result.error).toContain('RPC timeout');
  });

  it('continues when badge was already minted on-chain', async () => {
    blockchainService.mintBadge.mockRejectedValue(
      new BlockchainTransactionRevertedException('BadgeAlreadyMinted'),
    );

    const result = await rewardService.processCompletedMatch(baseInput);

    expect(result.onChainStatus).toBe(OnChainStatus.CONFIRMED);
    expect(result.transactionHashes).toEqual(['0xrecord', '0xpoints']);
  });

  it('maps streak milestones to expected badge IDs', async () => {
    const cases = [
      { streak: 5, badgeId: 2 },
      { streak: 10, badgeId: 4 },
      { streak: 15, badgeId: 5 },
    ];

    for (const testCase of cases) {
      jest.clearAllMocks();
      blockchainService.isReady.mockReturnValue(true);

      const result = await rewardService.processCompletedMatch({
        ...baseInput,
        currentStreak: testCase.streak,
      });

      expect(result.badgeAwarded).toBe(testCase.badgeId);
      expect(blockchainService.mintBadge).toHaveBeenCalledWith(
        baseInput.winnerWallet,
        testCase.badgeId,
      );
    }
  });
});
