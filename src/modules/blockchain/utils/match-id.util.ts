import { ethers } from 'ethers';

/**
 * Converts a backend match identifier (UUID or numeric string) to the uint256
 * value expected by the GameReward contract.
 */
export function toOnChainMatchId(matchId: string | number | bigint): bigint {
  if (typeof matchId === 'bigint') return matchId;
  if (typeof matchId === 'number') return BigInt(matchId);

  const trimmed = matchId.trim();
  if (/^\d+$/.test(trimmed)) return BigInt(trimmed);

  return ethers.toBigInt(ethers.id(trimmed));
}

export function parseMatchIdParam(matchId: string): bigint {
  return toOnChainMatchId(matchId);
}
