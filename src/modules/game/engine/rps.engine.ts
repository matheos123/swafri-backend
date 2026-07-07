export type Move = 'rock' | 'paper' | 'scissors';
export type RoundResult = 'player1' | 'player2' | 'draw';

export interface RoundOutcome {
  result: RoundResult;
  winnerId: string | null;
  move1: Move;
  move2: Move;
}

/** Pure RPS logic — no framework deps, fully unit-testable */
export class RpsEngine {
  private static readonly BEATS: Record<Move, Move> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  static resolveRound(move1: Move, move2: Move, p1Id: string, p2Id: string): RoundOutcome {
    if (move1 === move2) return { result: 'draw', winnerId: null, move1, move2 };
    if (RpsEngine.BEATS[move1] === move2) return { result: 'player1', winnerId: p1Id, move1, move2 };
    return { result: 'player2', winnerId: p2Id, move1, move2 };
  }

  /** Best of 3 (first to 2 wins) */
  static resolveMatch(p1Wins: number, p2Wins: number, p1Id: string, p2Id: string) {
    if (p1Wins >= 2) return { winnerId: p1Id, isComplete: true };
    if (p2Wins >= 2) return { winnerId: p2Id, isComplete: true };
    if (p1Wins + p2Wins >= 5) {
      const winnerId = p1Wins > p2Wins ? p1Id : p2Wins > p1Wins ? p2Id : null;
      return { winnerId, isComplete: true };
    }
    return { winnerId: null, isComplete: false };
  }

  static isValidMove(move: string): move is Move {
    return ['rock', 'paper', 'scissors'].includes(move);
  }
}
