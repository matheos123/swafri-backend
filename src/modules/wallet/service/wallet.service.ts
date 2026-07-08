import { BadRequestException, Injectable } from '@nestjs/common';
import { Web3Provider } from '../../../core/provider/web3.provider';
import { WalletRepository } from '../repository/wallet.repository';

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly web3: Web3Provider,
  ) {}

  async connect(userId: string, walletAddress: string, message: string, signature: string) {
    const normalizedWalletAddress = walletAddress.toLowerCase();
    const signatureValid = await this.verifySignature(message, signature, normalizedWalletAddress);
    if (!signatureValid) {
      throw new BadRequestException('Invalid wallet signature');
    }

    const existing = await this.walletRepository.findByWallet(normalizedWalletAddress);
    if (existing && existing.id !== userId) {
      throw new BadRequestException('Wallet already linked to another account');
    }

    await this.walletRepository.connect(userId, normalizedWalletAddress);
    return { connected: true, walletAddress: normalizedWalletAddress };
  }

  async disconnect(userId: string) {
    await this.walletRepository.disconnect(userId);
    return { connected: false, walletAddress: null };
  }

  async status(userId: string) {
    const user = await this.walletRepository.findByUserId(userId);
    return { connected: Boolean(user?.walletAddress), walletAddress: user?.walletAddress };
  }

  async verifySignature(
    message: string,
    signature: string,
    walletAddress: string,
  ): Promise<boolean> {
    return this.web3.verifyWalletSignature(message, signature, walletAddress);
  }
}
