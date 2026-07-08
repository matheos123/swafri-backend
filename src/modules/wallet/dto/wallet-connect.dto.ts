import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class WalletConnectDto {
  @ApiProperty({
    example: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb',
    description: 'MetaMask wallet address (0x + 40 hex characters)',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  walletAddress!: string;

  @ApiProperty({
    example: 'Connect wallet to Web3 Battle Arena',
    description:
      'Exact text signed in MetaMask. Recommended constant: Connect wallet to Web3 Battle Arena',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    example:
      '0x8f2a5d1f3e9c4b7a6d2c1f8e5a9b3c4d7e1f0a2b8c6d4e3f1a9b7c5d3e2f1a6b1c8f2a5d1f3e9c4b7a6d2c1f8e5a9b3c4d7e1f0a2b8c6d4e3f1a9b7c5d3e2f1a6b1b',
    description: 'Signature from ethers `signer.signMessage(message)` / MetaMask personal_sign',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}
