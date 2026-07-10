import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ethers } from 'ethers';
import { Web3Provider } from '../../../core/provider/web3.provider';
import { RedisService } from '../../../core/redis/redis.service';
import { WalletRepository } from '../repository/wallet.repository';

/**
 * WalletService
 *
 * Manages wallet linking for email-registered users.
 *
 * All wallet connections require cryptographic proof of ownership:
 * 1. Client requests a challenge nonce   → GET  /wallet/challenge
 * 2. Client signs the challenge message  → MetaMask
 * 3. Client submits address + signature  → POST /wallet/connect
 * 4. Server ecrecovers and verifies      → sets walletAddress + walletVerifiedAt
 *
 * This prevents anyone from linking a wallet they don't own.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly CHALLENGE_PREFIX = 'wallet-challenge:';
  private readonly CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly web3: Web3Provider,
    private readonly redisService: RedisService,
  ) {}

  // ─── Challenge ────────────────────────────────────────────────────────────

  /**
   * Generate a signed challenge message for the user's wallet to sign.
   * Stored in Redis for 5 minutes keyed by userId.
   *
   * @param userId  - Authenticated user requesting the challenge
   * @param address - Wallet address they want to link
   */
  async generateChallenge(userId: string, address: string): Promise<{ message: string; nonce: string }> {
    const nonce    = Math.random().toString(36).substring(2, 10).toUpperCase();
    const issuedAt = new Date().toISOString();

    const message = [
      'Web3 Battle Arena — Connect Wallet',
      '',
      `User ID: ${userId}`,
      `Wallet:  ${address}`,
      `Nonce:   ${nonce}`,
      `Issued:  ${issuedAt}`,
      `Chain:   Base Sepolia (84532)`,
    ].join('\n');

    // Store nonce + message keyed by userId so it's tied to the authenticated session
    await this.redisService.set(
      `${this.CHALLENGE_PREFIX}${userId}`,
      `${address.toLowerCase()}::${nonce}::${message}`,
      this.CHALLENGE_TTL_MS,
    );

    return { message, nonce };
  }

  // ─── Connect (with proof) ─────────────────────────────────────────────────

  /**
   * Connect a wallet to the user's account.
   * Requires a valid signature proving ownership of the wallet address.
   *
   * @param userId    - Authenticated user
   * @param address   - Wallet address to link
   * @param signature - Signature of the challenge message
   */
  async connect(userId: string, address: string, signature: string) {
    // Retrieve stored challenge for this user
    const stored = await this.redisService.get(`${this.CHALLENGE_PREFIX}${userId}`);
    if (!stored) {
      throw new UnauthorizedException(
        'Challenge not found or expired. Request a new challenge first.',
      );
    }

    // Parse stored data: "address::nonce::full message"
    const firstDouble  = stored.indexOf('::');
    const secondDouble = stored.indexOf('::', firstDouble + 2);
    const storedAddress = stored.substring(0, firstDouble);
    const storedMessage = stored.substring(secondDouble + 2);

    // Ensure the address matches what was challenged
    if (storedAddress !== address.toLowerCase()) {
      throw new BadRequestException('Wallet address does not match the issued challenge');
    }

    // Verify the signature using ecrecover
    const isValid = this.web3.verifyWalletSignature(storedMessage, signature, address);
    if (!isValid) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    // Consume the challenge — one use only
    await this.redisService.del(`${this.CHALLENGE_PREFIX}${userId}`);

    // Check address isn't already claimed by another account
    const existing = await this.walletRepository.findByWallet(address);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('Wallet address is already linked to another account');
    }

    // Generate blockchainProfileId derived from the wallet address
    const blockchainProfileId = ethers.keccak256(
      ethers.toUtf8Bytes(`${address.toLowerCase()}:${userId}`),
    );

    // Persist wallet + verification timestamp + blockchainProfileId
    await this.walletRepository.connectVerified(userId, address, blockchainProfileId);

    // Fire-and-forget: register player on PlayerProfile.sol
    // Fetch username from DB to pass to the contract
    const userRecord = await this.walletRepository.findByUserId(userId);
    const username = (userRecord as any)?.username ?? `Player_${address.slice(2, 8).toUpperCase()}`;

    this.web3
      .registerPlayerOnChain(blockchainProfileId, username)
      .then((txHash) =>
        this.logger.log(`Wallet connect: Player ${userId} registered on-chain. TxHash: ${txHash}`),
      )
      .catch((err) => this.logger.error('Wallet connect: registerPlayerOnChain failed', err));

    return {
      connected:          true,
      walletAddress:      address,
      blockchainProfileId,
      verifiedAt:         new Date().toISOString(),
    };
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  async disconnect(userId: string) {
    await this.walletRepository.disconnect(userId);
    return { connected: false, walletAddress: null };
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  async status(userId: string) {
    const user = await this.walletRepository.findByUserId(userId);
    return {
      connected:          Boolean(user?.walletAddress),
      walletAddress:      user?.walletAddress ?? null,
      walletVerifiedAt:   (user as any)?.walletVerifiedAt ?? null,
      blockchainProfileId: (user as any)?.blockchainProfileId ?? null,
    };
  }
}
