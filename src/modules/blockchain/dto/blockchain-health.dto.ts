import { ApiProperty } from '@nestjs/swagger';

export class BlockchainHealthDto {
  @ApiProperty({ example: 'healthy' })
  status!: string;

  @ApiProperty({ example: 'polygonAmoy' })
  network!: string;

  @ApiProperty({ example: '0xc6B4Edae0666e59f6475079A58d97483A1fd0d42', nullable: true })
  contractAddress!: string | null;

  @ApiProperty({ example: 80002 })
  chainId!: number;

  @ApiProperty({ example: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb', nullable: true })
  owner!: string | null;

  @ApiProperty()
  rpcConnected!: boolean;

  @ApiProperty()
  contractDeployed!: boolean;
}
