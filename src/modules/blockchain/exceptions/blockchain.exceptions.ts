import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

export class BlockchainUnavailableException extends ServiceUnavailableException {
  constructor(message = 'Blockchain service is not configured or unavailable') {
    super(message);
  }
}

export class BlockchainNetworkMismatchException extends BadRequestException {
  constructor(expected: number, actual: number) {
    super(`Blockchain network mismatch: expected chainId ${expected}, got ${actual}`);
  }
}

export class BlockchainTransactionRevertedException extends ConflictException {
  constructor(message = 'Blockchain transaction reverted') {
    super(message);
  }
}

export class BlockchainInsufficientGasException extends BadRequestException {
  constructor(message = 'Insufficient gas or funds for blockchain transaction') {
    super(message);
  }
}

export class BlockchainInvalidWalletException extends BadRequestException {
  constructor(message = 'Invalid wallet address') {
    super(message);
  }
}
