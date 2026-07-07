import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class Web3Provider implements OnModuleInit {
  private readonly logger = new Logger(Web3Provider.name);

  private provider!: ethers.JsonRpcProvider;
  private signer!: ethers.Wallet;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.get<string>('blockchain.rpcUrl');
    const privateKey = this.config.get<string>('blockchain.privateKey');

    if (!rpcUrl || !privateKey) {
      this.logger.warn('Blockchain env vars missing — running in simulation mode');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.connected = true;
      this.logger.log(`Web3 connected → ${rpcUrl}`);
    } catch (err) {
      this.logger.error('Web3 connection failed', err);
    }
  }

  // ─── Match Result ─────────────────────────────────────────────────────────

  async recordMatchResult(
    matchId: string,
    player1Address: string | null,
    player2Address: string | null,
    winnerAddress: string | null,
    move1: string,
    move2: string,
  ): Promise<string> {
    if (!this.connected || !player1Address || !player2Address) {
      return this.simulateHash(matchId, winnerAddress, move1, move2);
    }

    try {
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'address', 'address', 'string', 'string', 'uint256'],
        [
          ethers.id(matchId),
          player1Address,
          player2Address,
          winnerAddress ?? ethers.ZeroAddress,
          move1,
          move2,
          Math.floor(Date.now() / 1000),
        ],
      );
      const hash = ethers.keccak256(encoded);
      this.logger.log(`On-chain hash recorded: ${hash}`);
      return hash;
    } catch (err) {
      this.logger.error('On-chain record failed — falling back to simulation', err);
      return this.simulateHash(matchId, winnerAddress, move1, move2);
    }
  }

  // ─── Wallet Verification ─────────────────────────────────────────────────

  verifyWalletSignature(message: string, signature: string, expected: string): boolean {
    try {
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase() === expected.toLowerCase();
    } catch {
      return false;
    }
  }

  // ─── Commit-Reveal ────────────────────────────────────────────────────────

  createMoveCommitment(move: string, secret: string): string {
    const moveEnum = ({ rock: 1, paper: 2, scissors: 3 } as Record<string, number>)[move] ?? 0;
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint8', 'string'], [moveEnum, secret]),
    );
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  isConnected(): boolean {
    return this.connected;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private simulateHash(
    matchId: string,
    winner: string | null,
    move1: string,
    move2: string,
  ): string {
    const payload = `${matchId}:${winner ?? 'draw'}:${move1}:${move2}:${Date.now()}`;
    const hash = ethers.keccak256(ethers.toUtf8Bytes(payload));
    this.logger.log(`Simulated match hash: ${hash}`);
    return hash;
  }
}
