import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';

// ─── ABI Loader ──────────────────────────────────────────────────────────────
function loadAbi(contractName: string): ethers.InterfaceAbi {
  const abiPath = path.join(__dirname, '..', 'abi', `${contractName}.json`);
  const raw = fs.readFileSync(abiPath, 'utf8');
  return JSON.parse(raw) as ethers.InterfaceAbi;
}

// ─── Badge name → on-chain badge ID mapping ──────────────────────────────────
const BADGE_ID_MAP: Record<string, number> = {
  'First Victory':   1,
  'Ten Victories':   2,
  'Fifty Victories': 3,
  'On Fire':         4,
  'Legendary':       5,
  'Veteran':         6,
  'Centurion':       7,
};

@Injectable()
export class Web3Provider implements OnModuleInit {
  private readonly logger = new Logger(Web3Provider.name);

  private provider!:          ethers.JsonRpcProvider;
  private signer!:            ethers.Wallet;
  private connected = false;

  // Contract instances (read-only + read-write)
  private playerProfileContract!:   ethers.Contract;
  private matchRegistryContract!:   ethers.Contract;
  private achievementBadgeContract!: ethers.Contract;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl    = this.config.get<string>('blockchain.rpcUrl');
    const privateKey = this.config.get<string>('blockchain.privateKey');

    if (!rpcUrl || !privateKey) {
      this.logger.warn('Blockchain env vars missing — running in simulation mode');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer   = new ethers.Wallet(privateKey, this.provider);
      this.connected = true;
      this.logger.log(`Web3 connected → ${rpcUrl}`);
      this.logger.log(`Deployer wallet → ${this.signer.address}`);

      this.initContracts();
    } catch (err) {
      this.logger.error('Web3 connection failed', err);
    }
  }

  // ─── Contract Initialization ──────────────────────────────────────────────

  private initContracts(): void {
    const profileAddr      = this.config.get<string>('blockchain.contracts.playerProfile');
    const matchAddr        = this.config.get<string>('blockchain.contracts.battleArena');
    const achievementAddr  = this.config.get<string>('blockchain.contracts.achievementNft');

    if (profileAddr) {
      this.playerProfileContract = new ethers.Contract(
        profileAddr,
        loadAbi('PlayerProfile'),
        this.signer,
      );
      this.logger.log(`PlayerProfile contract → ${profileAddr}`);
    } else {
      this.logger.warn('PLAYER_PROFILE_ADDRESS not set — PlayerProfile calls will be simulated');
    }

    if (matchAddr) {
      this.matchRegistryContract = new ethers.Contract(
        matchAddr,
        loadAbi('MatchRegistry'),
        this.signer,
      );
      this.logger.log(`MatchRegistry contract → ${matchAddr}`);
    } else {
      this.logger.warn('BATTLE_ARENA_ADDRESS not set — MatchRegistry calls will be simulated');
    }

    if (achievementAddr) {
      this.achievementBadgeContract = new ethers.Contract(
        achievementAddr,
        loadAbi('AchievementBadge'),
        this.signer,
      );
      this.logger.log(`AchievementBadge contract → ${achievementAddr}`);
    } else {
      this.logger.warn('ACHIEVEMENT_NFT_ADDRESS not set — AchievementBadge calls will be simulated');
    }
  }

  // ─── PlayerProfile — Write ────────────────────────────────────────────────

  /**
   * Register a player on-chain via PlayerProfile.sol.
   * Called asynchronously (fire-and-forget) after SIWE login or wallet connect.
   *
   * @param blockchainProfileId - keccak256 bytes32 profile ID (hex string)
   * @param username            - Player's display name
   * @returns transaction hash or simulated hash
   */
  async registerPlayerOnChain(
    blockchainProfileId: string,
    username: string,
  ): Promise<string> {
    if (!this.connected || !this.playerProfileContract) {
      return this.simulateHash(`register:${blockchainProfileId}:${username}`);
    }

    try {
      // Check if already registered to avoid reverted txn
      const alreadyRegistered = await this.playerProfileContract['isRegistered'](
        this.signer.address,
      );
      if (alreadyRegistered) {
        this.logger.log(`Player already registered on-chain: ${blockchainProfileId}`);
        return blockchainProfileId;
      }

      const profileIdBytes32 = blockchainProfileId.startsWith('0x')
        ? blockchainProfileId
        : `0x${blockchainProfileId}`;

      const tx = await this.playerProfileContract['registerPlayer'](
        profileIdBytes32,
        username,
      );
      const receipt = await tx.wait();
      this.logger.log(`PlayerProfile.registerPlayer tx: ${receipt.hash}`);
      return receipt.hash as string;
    } catch (err) {
      this.logger.error('registerPlayerOnChain failed — using simulated hash', err);
      return this.simulateHash(`register:${blockchainProfileId}:${username}`);
    }
  }

  /**
   * Check if a wallet address is already registered on PlayerProfile.sol.
   */
  async isPlayerRegisteredOnChain(walletAddress: string): Promise<boolean> {
    if (!this.connected || !this.playerProfileContract) return false;
    try {
      return await this.playerProfileContract['isRegistered'](walletAddress) as boolean;
    } catch (err) {
      this.logger.error('isPlayerRegisteredOnChain failed', err);
      return false;
    }
  }

  /**
   * Fetch player info from PlayerProfile.sol by wallet address.
   * Returns null if not found or not connected.
   */
  async getPlayerOnChain(
    walletAddress: string,
  ): Promise<{ profileId: string; username: string; registeredAt: number } | null> {
    if (!this.connected || !this.playerProfileContract) return null;
    try {
      const [profileId, username, registeredAt] =
        await this.playerProfileContract['getPlayer'](walletAddress) as [string, string, bigint];
      return {
        profileId,
        username,
        registeredAt: Number(registeredAt),
      };
    } catch (err) {
      this.logger.warn('getPlayerOnChain — player not found or error', err);
      return null;
    }
  }

  // ─── MatchRegistry — Write ────────────────────────────────────────────────

  /**
   * Record a match result on MatchRegistry.sol.
   * Non-blocking — called after match finalization for ranked matches.
   *
   * @param matchId        - UUID match ID (will be hashed to bytes32)
   * @param winnerAddress  - Winner's wallet address (or null for a draw)
   * @param loserAddress   - Loser's wallet address (or null for a draw)
   * @param resultHash     - Pre-computed keccak256 result hash
   * @returns transaction hash or simulated hash
   */
  async recordMatchOnChain(
    matchId: string,
    winnerAddress: string | null,
    loserAddress: string | null,
    resultHash: string,
  ): Promise<string> {
    if (!this.connected || !this.matchRegistryContract) {
      return this.simulateHash(`match:${matchId}:${resultHash}`);
    }

    try {
      const matchIdBytes32   = ethers.id(matchId);  // keccak256 of UTF-8 matchId
      const resultHashBytes32 = resultHash.startsWith('0x')
        ? resultHash
        : `0x${resultHash}`;

      const winnerAddr = winnerAddress ?? ethers.ZeroAddress;
      const loserAddr  = loserAddress  ?? ethers.ZeroAddress;

      const tx = await this.matchRegistryContract['recordMatch'](
        matchIdBytes32,
        winnerAddr,
        loserAddr,
        resultHashBytes32,
      );
      const receipt = await tx.wait();
      this.logger.log(`MatchRegistry.recordMatch tx: ${receipt.hash} | match: ${matchId}`);
      return receipt.hash as string;
    } catch (err) {
      this.logger.error('recordMatchOnChain failed — using simulated hash', err);
      return this.simulateHash(`match:${matchId}:${resultHash}`);
    }
  }

  /**
   * Check if a match has been recorded on-chain.
   */
  async isMatchOnChain(matchId: string): Promise<boolean> {
    if (!this.connected || !this.matchRegistryContract) return false;
    try {
      const matchIdBytes32 = ethers.id(matchId);
      return await this.matchRegistryContract['matchExists'](matchIdBytes32) as boolean;
    } catch (err) {
      this.logger.error('isMatchOnChain failed', err);
      return false;
    }
  }

  /**
   * Fetch match data from MatchRegistry.sol.
   */
  async getMatchOnChain(
    matchId: string,
  ): Promise<{ winner: string; loser: string; resultHash: string; timestamp: number } | null> {
    if (!this.connected || !this.matchRegistryContract) return null;
    try {
      const matchIdBytes32 = ethers.id(matchId);
      const [winner, loser, resultHash, timestamp] =
        await this.matchRegistryContract['getMatch'](matchIdBytes32) as [string, string, string, bigint];
      return {
        winner,
        loser,
        resultHash,
        timestamp: Number(timestamp),
      };
    } catch (err) {
      this.logger.warn('getMatchOnChain — match not found or error', err);
      return null;
    }
  }

  // ─── AchievementBadge — Write ─────────────────────────────────────────────

  /**
   * Mint an ERC-1155 achievement badge NFT on-chain.
   * Non-blocking — called after achievement is awarded.
   *
   * @param playerAddress - Player's wallet address
   * @param badgeName     - Badge name (must match BADGE_ID_MAP keys)
   * @returns transaction hash or simulated hash
   */
  async mintBadgeOnChain(
    playerAddress: string,
    badgeName: string,
  ): Promise<string> {
    const badgeId = BADGE_ID_MAP[badgeName];

    if (!this.connected || !this.achievementBadgeContract || badgeId === undefined) {
      if (badgeId === undefined) {
        this.logger.warn(`Unknown badge name: "${badgeName}" — cannot mint on-chain`);
      }
      return this.simulateHash(`badge:${playerAddress}:${badgeName}`);
    }

    try {
      // Check if already owns badge to avoid reverting
      const alreadyHas = await this.achievementBadgeContract['hasBadge'](
        playerAddress,
        badgeId,
      );
      if (alreadyHas) {
        this.logger.log(`Player ${playerAddress} already has badge "${badgeName}" (ID: ${badgeId})`);
        return `already-owned:${badgeId}`;
      }

      const tx = await this.achievementBadgeContract['mint'](playerAddress, badgeId);
      const receipt = await tx.wait();
      this.logger.log(
        `AchievementBadge.mint tx: ${receipt.hash} | player: ${playerAddress} | badge: "${badgeName}" (ID: ${badgeId})`,
      );
      return receipt.hash as string;
    } catch (err) {
      this.logger.error('mintBadgeOnChain failed — using simulated hash', err);
      return this.simulateHash(`badge:${playerAddress}:${badgeName}`);
    }
  }

  /**
   * Check if a player has a specific badge.
   */
  async hasBadgeOnChain(playerAddress: string, badgeName: string): Promise<boolean> {
    const badgeId = BADGE_ID_MAP[badgeName];
    if (!this.connected || !this.achievementBadgeContract || badgeId === undefined) return false;
    try {
      return await this.achievementBadgeContract['hasBadge'](playerAddress, badgeId) as boolean;
    } catch (err) {
      this.logger.error('hasBadgeOnChain failed', err);
      return false;
    }
  }

  // ─── Wallet Verification ─────────────────────────────────────────────────

  /**
   * Verify an Ethereum wallet signature using ecrecover.
   * Used for SIWE and wallet-connect flows.
   */
  verifyWalletSignature(message: string, signature: string, expected: string): boolean {
    try {
      const recovered = ethers.verifyMessage(message, signature);
      return recovered.toLowerCase() === expected.toLowerCase();
    } catch {
      return false;
    }
  }

  // ─── Match Result Hash (for local hash generation before sending on-chain) ──

  /**
   * Compute the deterministic result hash for a match.
   * This is what gets stored on-chain in MatchRegistry.sol.
   */
  computeMatchResultHash(
    matchId: string,
    player1Address: string | null,
    player2Address: string | null,
    winnerAddress: string | null,
    move1: string,
    move2: string,
  ): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'address', 'address', 'string', 'string', 'uint256'],
      [
        ethers.id(matchId),
        player1Address ?? ethers.ZeroAddress,
        player2Address ?? ethers.ZeroAddress,
        winnerAddress  ?? ethers.ZeroAddress,
        move1,
        move2,
        Math.floor(Date.now() / 1000),
      ],
    );
    return ethers.keccak256(encoded);
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

  hasPlayerProfile(): boolean {
    return this.connected && !!this.playerProfileContract;
  }

  hasMatchRegistry(): boolean {
    return this.connected && !!this.matchRegistryContract;
  }

  hasAchievementBadge(): boolean {
    return this.connected && !!this.achievementBadgeContract;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private simulateHash(input: string): string {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(`${input}:${Date.now()}`));
    this.logger.log(`Simulated hash for "${input}": ${hash}`);
    return hash;
  }
}
