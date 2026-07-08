import { ethers } from 'ethers';

export interface MatchHashInput {
  matchId: string;
  winnerId: string;
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  lastPlayer1Move?: string;
  lastPlayer2Move?: string;
}

export function generateMatchResultHash(input: MatchHashInput): string {
  const payload = [
    input.matchId,
    input.winnerId,
    input.player1Id,
    input.player2Id,
    input.player1Wins,
    input.player2Wins,
    input.lastPlayer1Move ?? '',
    input.lastPlayer2Move ?? '',
  ].join(':');

  return ethers.id(payload);
}
