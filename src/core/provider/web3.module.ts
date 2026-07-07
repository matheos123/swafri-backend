import { Global, Module } from '@nestjs/common';
import { Web3Provider } from './web3.provider';

@Global()
@Module({
  providers: [Web3Provider],
  exports: [Web3Provider],
})
export class Web3Module {}
