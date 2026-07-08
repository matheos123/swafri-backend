export type BlockchainHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export interface BlockchainHealth {
  status: BlockchainHealthStatus;
  network: string;
  contractAddress: string | null;
  chainId: number;
  owner: string | null;
  rpcConnected: boolean;
  contractDeployed: boolean;
}

export interface BlockchainTransactionResult {
  transactionHash: string;
  gasUsed?: string;
  blockNumber?: number;
}

export interface OnChainMatchRecord {
  winner: string;
  timestamp: bigint;
  gameType: string;
  resultHash: string;
  pointsAwarded: bigint;
  badgeEarned: number;
}

export interface RecordMatchParams {
  matchId: string | number | bigint;
  winner: string;
  timestamp: number;
  gameType: string;
  resultHash: string;
  pointsAwarded: number;
  badgeEarned: number;
}
