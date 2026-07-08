# Web3 Battle Arena — Blockchain Workspace

Separate Hardhat workspace for smart contract development.  
This project is intentionally isolated from the NestJS backend and will integrate later via ABIs, addresses, and deployment artifacts.

## Stack

- Solidity `0.8.24`
- Hardhat + TypeScript
- Ethers.js v6
- OpenZeppelin Contracts
- Polygon Amoy testnet

## Project Structure

```text
blockchain/
├── contracts/        # Solidity contracts
├── scripts/          # Deployment and utility scripts
├── test/             # Contract tests
├── ignition/         # Hardhat Ignition modules
├── artifacts/        # Compiled contract artifacts (generated)
├── cache/            # Hardhat cache (generated)
└── typechain-types/  # TypeChain bindings (generated)
```

## Setup

```bash
cd blockchain
npm install
cp .env.example .env
```

Fill `.env` with your deployer key and RPC URLs before deploying to testnets.

## Commands

| Command | Description |
|---|---|
| `npm run compile` | Compile contracts |
| `npm test` | Run tests |
| `npm run clean` | Remove artifacts/cache |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:local` | Run deploy script on local network |
| `npm run deploy:amoy` | Deploy to Polygon Amoy |
| `npm run deploy:sepolia` | Deploy to Sepolia (optional) |

## Networks

| Network | Chain ID | Config key |
|---|---|---|
| Hardhat (local) | 31337 | `hardhat` |
| Polygon Amoy | 80002 | `polygonAmoy` |
| Sepolia (optional) | 11155111 | `sepolia` |

## Verification

After deployment, verify on Polygonscan Amoy:

```bash
npx hardhat verify --network polygonAmoy <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Backend Integration (later)

1. Deploy contracts to Polygon Amoy.
2. Export ABIs from `artifacts/contracts/...`.
3. Share deployed addresses with backend `.env`.
4. Backend `BlockchainService` will consume ABI + address + RPC.

## Security

- Never commit `.env` or private keys.
- Use a dedicated deployer wallet with testnet funds only.
