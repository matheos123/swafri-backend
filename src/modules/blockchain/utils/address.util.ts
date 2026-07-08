import { ethers } from 'ethers';
import { BlockchainInvalidWalletException } from '../exceptions/blockchain.exceptions';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function assertWalletAddress(address: string): string {
  if (!ADDRESS_REGEX.test(address)) {
    throw new BlockchainInvalidWalletException();
  }
  return ethers.getAddress(address);
}

export function isWalletAddress(address: string): boolean {
  return ADDRESS_REGEX.test(address);
}
