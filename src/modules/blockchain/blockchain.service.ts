import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BLOCKCHAIN_CONFIG_KEY } from './constants/blockchain.constants';
import {
  BlockchainInsufficientGasException,
  BlockchainNetworkMismatchException,
  BlockchainTransactionRevertedException,
  BlockchainUnavailableException,
} from './exceptions/blockchain.exceptions';
import { GameRewardContract } from './interfaces/game-reward.interface';
import {
  BlockchainHealth,
  BlockchainTransactionResult,
  OnChainMatchRecord,
  RecordMatchParams,
} from './types/blockchain.types';
import { loadGameRewardAbi } from './utils/abi-loader.util';
import { assertWalletAddress } from './utils/address.util';
import { toOnChainMatchId } from './utils/match-id.util';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);

  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private contractAddress: string | null = null;
  private expectedChainId: number | null = null;
  private ready = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const rpcUrl = this.config.get<string>(`${BLOCKCHAIN_CONFIG_KEY}.rpcUrl`);
    const privateKey = this.config.get<string>(`${BLOCKCHAIN_CONFIG_KEY}.privateKey`);
    const gameRewardAddress = this.config.get<string>(`${BLOCKCHAIN_CONFIG_KEY}.gameRewardAddress`);
    const chainId = this.config.get<number>(`${BLOCKCHAIN_CONFIG_KEY}.chainId`);

    if (!rpcUrl || !privateKey || !gameRewardAddress) {
      this.logger.warn('Blockchain env vars missing — BlockchainService unavailable');
      return;
    }

    try {
      this.expectedChainId = chainId ?? 80002;
      this.contractAddress = ethers.getAddress(gameRewardAddress);
      this.provider = new ethers.JsonRpcProvider(rpcUrl, this.expectedChainId);
      this.signer = new ethers.Wallet(privateKey, this.provider);

      const abi = loadGameRewardAbi();
      this.contract = new ethers.Contract(this.contractAddress, abi, this.signer);

      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.expectedChainId) {
        throw new BlockchainNetworkMismatchException(this.expectedChainId, Number(network.chainId));
      }

      const code = await this.provider.getCode(this.contractAddress);
      if (!code || code === '0x') {
        throw new BlockchainUnavailableException(
          'GameReward contract not deployed at configured address',
        );
      }

      const owner = await (this.contract as unknown as GameRewardContract).owner();
      this.ready = true;
      this.logger.log(
        `BlockchainService ready → chainId=${this.expectedChainId} contract=${this.contractAddress} owner=${owner}`,
      );
    } catch (error) {
      this.logger.error('BlockchainService initialization failed', error as Error);
      this.ready = false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async getHealth(): Promise<BlockchainHealth> {
    if (!this.provider || !this.contractAddress || !this.expectedChainId) {
      return {
        status: 'unavailable',
        network: 'unknown',
        contractAddress: null,
        chainId: this.expectedChainId ?? 0,
        owner: null,
        rpcConnected: false,
        contractDeployed: false,
      };
    }

    try {
      const network = await this.provider.getNetwork();
      const code = await this.provider.getCode(this.contractAddress);
      const owner = this.ready
        ? await (this.contract as unknown as GameRewardContract).owner()
        : null;

      const chainMatch = Number(network.chainId) === this.expectedChainId;
      const contractDeployed = Boolean(code && code !== '0x');

      const status =
        this.ready && chainMatch && contractDeployed
          ? 'healthy'
          : contractDeployed
            ? 'degraded'
            : 'unavailable';

      return {
        status,
        network: network.name,
        contractAddress: this.contractAddress,
        chainId: Number(network.chainId),
        owner,
        rpcConnected: true,
        contractDeployed,
      };
    } catch {
      return {
        status: 'unavailable',
        network: 'unknown',
        contractAddress: this.contractAddress,
        chainId: this.expectedChainId,
        owner: null,
        rpcConnected: false,
        contractDeployed: false,
      };
    }
  }

  async recordMatch(params: RecordMatchParams): Promise<BlockchainTransactionResult> {
    const contract = this.getContract();
    const matchId = toOnChainMatchId(params.matchId);
    const winner = assertWalletAddress(params.winner);
    const resultHash = this.normalizeBytes32(params.resultHash);

    return this.executeWrite(
      'recordMatch',
      {
        matchId: matchId.toString(),
        wallet: winner,
      },
      () =>
        contract.recordMatch(
          matchId,
          winner,
          BigInt(params.timestamp),
          params.gameType,
          resultHash,
          BigInt(params.pointsAwarded),
          params.badgeEarned,
        ),
    );
  }

  async awardPoints(player: string, points: number): Promise<BlockchainTransactionResult> {
    const contract = this.getContract();
    const wallet = assertWalletAddress(player);

    return this.executeWrite('awardPoints', { wallet, points: String(points) }, () =>
      contract.awardPoints(wallet, BigInt(points)),
    );
  }

  async mintBadge(player: string, badgeId: number): Promise<BlockchainTransactionResult> {
    const contract = this.getContract();
    const wallet = assertWalletAddress(player);

    if (badgeId < 1 || badgeId > 5) {
      throw new BlockchainTransactionRevertedException('Badge ID must be between 1 and 5');
    }

    return this.executeWrite('mintBadge', { wallet, badgeId: String(badgeId) }, () =>
      contract.mintBadge(wallet, badgeId),
    );
  }

  async getPlayerPoints(wallet: string): Promise<string> {
    const contract = this.getReadContract();
    const address = assertWalletAddress(wallet);
    const points = await contract.getPlayerPoints(address);
    return points.toString();
  }

  async getPlayerBadges(wallet: string): Promise<number[]> {
    const contract = this.getReadContract();
    const address = assertWalletAddress(wallet);
    const badges = await contract.getPlayerBadges(address);
    return badges.map((badge) => Number(badge));
  }

  async getMatch(
    matchId: string | number | bigint,
  ): Promise<OnChainMatchRecord & { matchId: string }> {
    const contract = this.getReadContract();
    const onChainId = toOnChainMatchId(matchId);

    try {
      const [winner, timestamp, gameType, resultHash, pointsAwarded, badgeEarned] =
        await contract.getMatch(onChainId);

      return {
        matchId: onChainId.toString(),
        winner,
        timestamp,
        gameType,
        resultHash,
        pointsAwarded,
        badgeEarned: Number(badgeEarned),
      };
    } catch (error) {
      if (this.isMatchNotFoundError(error)) {
        throw new NotFoundException(`On-chain match ${onChainId.toString()} not found`);
      }
      throw this.mapError(error);
    }
  }

  private getContract(): GameRewardContract {
    if (!this.ready || !this.contract) {
      throw new BlockchainUnavailableException();
    }
    return this.contract as unknown as GameRewardContract;
  }

  private getReadContract(): GameRewardContract {
    if (!this.contract || !this.provider) {
      throw new BlockchainUnavailableException();
    }
    return this.contract as unknown as GameRewardContract;
  }

  private async executeWrite(
    functionName: string,
    context: Record<string, string>,
    action: () => Promise<{
      hash: string;
      wait: () => Promise<{ gasUsed?: bigint; blockNumber?: number }>;
    }>,
  ): Promise<BlockchainTransactionResult> {
    const startedAt = Date.now();

    try {
      const tx = await action();
      const receipt = await tx.wait();
      const elapsedMs = Date.now() - startedAt;

      this.logger.log({
        function: functionName,
        ...context,
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed?.toString(),
        elapsedMs,
      });

      return {
        transactionHash: tx.hash,
        gasUsed: receipt.gasUsed?.toString(),
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      this.logger.error({
        function: functionName,
        ...context,
        elapsedMs: Date.now() - startedAt,
        error: (error as Error).message,
      });
      throw this.mapError(error);
    }
  }

  private normalizeBytes32(value: string): string {
    if (/^0x[a-fA-F0-9]{64}$/.test(value)) return value;
    return ethers.id(value);
  }

  private isMatchNotFoundError(error: unknown): boolean {
    const message =
      (error as { shortMessage?: string; message?: string })?.shortMessage ??
      (error as Error)?.message ??
      '';
    return message.includes('MatchNotFound');
  }

  private mapError(error: unknown): Error {
    const err = error as {
      code?: string;
      shortMessage?: string;
      message?: string;
      reason?: string;
    };

    const message = err.shortMessage ?? err.reason ?? err.message ?? 'Unknown blockchain error';

    if (
      err.code === 'NETWORK_ERROR' ||
      err.code === 'SERVER_ERROR' ||
      message.includes('ECONNREFUSED')
    ) {
      return new BlockchainUnavailableException('Blockchain RPC is unavailable');
    }

    if (message.includes('insufficient funds') || message.includes('gas')) {
      return new BlockchainInsufficientGasException(message);
    }

    if (message.includes('MatchAlreadyRecorded') || message.includes('BadgeAlreadyMinted')) {
      return new BlockchainTransactionRevertedException(message);
    }

    if (message.includes('execution reverted') || message.includes('CALL_EXCEPTION')) {
      return new BlockchainTransactionRevertedException(message);
    }

    if (message.includes('invalid address')) {
      return new BlockchainUnavailableException(message);
    }

    return new BlockchainUnavailableException(message);
  }
}
