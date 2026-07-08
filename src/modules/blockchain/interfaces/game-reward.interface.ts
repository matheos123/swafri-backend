import { InterfaceAbi } from 'ethers';

export interface GameRewardArtifact {
  contractName: string;
  abi: InterfaceAbi;
}

export interface GameRewardContract {
  recordMatch: (
    matchId: bigint,
    winner: string,
    timestamp: bigint,
    gameType: string,
    resultHash: string,
    pointsAwarded: bigint,
    badgeEarned: number,
  ) => Promise<{ hash: string; wait: () => Promise<{ gasUsed?: bigint; blockNumber?: number }> }>;
  awardPoints: (
    player: string,
    points: bigint,
  ) => Promise<{ hash: string; wait: () => Promise<{ gasUsed?: bigint; blockNumber?: number }> }>;
  mintBadge: (
    player: string,
    badgeId: number,
  ) => Promise<{ hash: string; wait: () => Promise<{ gasUsed?: bigint; blockNumber?: number }> }>;
  getPlayerPoints: (player: string) => Promise<bigint>;
  getPlayerBadges: (player: string) => Promise<bigint[]>;
  getMatch: (matchId: bigint) => Promise<[string, bigint, string, string, bigint, number]>;
  owner: () => Promise<string>;
}
