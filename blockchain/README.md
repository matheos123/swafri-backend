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

## GameReward Contract (Phase 2)

`contracts/GameReward.sol` is the on-chain rewards ledger for verified match outcomes.

The backend remains the gameplay authority. After a match is validated off-chain, the backend wallet (contract owner) writes immutable records and rewards to the blockchain.

### Contract purpose

- Record completed matches with winner, timestamp, game type, result hash, points, and badge earned
- Track cumulative player points on-chain
- Mint and track achievement badges without duplicating badge ownership

### Storage design

| Storage | Type | Purpose |
|---|---|---|
| `_matches` | `mapping(uint256 => MatchRecord)` | Immutable match history |
| `_matchExists` | `mapping(uint256 => bool)` | Duplicate match prevention |
| `_playerPoints` | `mapping(address => uint256)` | Cumulative player points |
| `_playerBadges` | `mapping(address => mapping(uint8 => bool))` | Badge ownership flags |

`MatchRecord` struct fields:

- `winner`
- `timestamp`
- `gameType`
- `resultHash`
- `pointsAwarded`
- `badgeEarned`

### Badge IDs

| ID | Badge |
|---|---|
| 0 | None |
| 1 | Water |
| 2 | Fire |
| 3 | Gold |
| 4 | Diamond |
| 5 | Platinum |

### Owner-only functions

| Function | Description |
|---|---|
| `recordMatch(...)` | Store a validated match result |
| `awardPoints(address, uint256)` | Add points to a player total |
| `mintBadge(address, uint8)` | Mint a badge if not already owned |

### Read functions

| Function | Description |
|---|---|
| `getMatch(uint256)` | Return stored match data |
| `matchExists(uint256)` | Check whether a match was recorded |
| `getPlayerPoints(address)` | Return total points |
| `hasBadge(address, uint8)` | Check badge ownership |
| `getPlayerBadges(address)` | Return all owned badge IDs |

### Events

| Event | When emitted |
|---|---|
| `MatchRecorded` | A match is stored on-chain |
| `PointsAwarded` | Points are added to a player |
| `BadgeAwarded` | A badge is minted to a player |

### Access control

- Uses OpenZeppelin `Ownable`
- Only the backend deployer wallet (`owner`) can write data
- Players cannot call `recordMatch`, `awardPoints`, or `mintBadge` directly

### Security features

- Custom errors for gas-efficient reverts
- Duplicate match ID prevention
- Duplicate badge mint prevention
- Zero-address validation on sensitive writes
- Checks-Effects-Interactions pattern (no external calls)

### Example backend integration (Phase 3+)

After match finalization in the NestJS backend:

```typescript
// Pseudocode — backend only, not implemented in this workspace yet
const matchId = 101;
const winner = "0xPlayerWallet...";
const timestamp = Math.floor(Date.now() / 1000);
const gameType = "rps";
const resultHash = ethers.id(`${matchId}:${winner}:rock:scissors`);
const pointsAwarded = 10;
const badgeEarned = 1; // Water

await gameReward.recordMatch(
  matchId,
  winner,
  timestamp,
  gameType,
  resultHash,
  pointsAwarded,
  badgeEarned,
);

await gameReward.awardPoints(winner, 10);

if (shouldMintBadge) {
  await gameReward.mintBadge(winner, 1);
}
```

Typical win flow:

1. Backend validates match winner
2. Backend calls `recordMatch(...)`
3. Backend calls `awardPoints(winner, 10)`
4. Backend optionally calls `mintBadge(winner, badgeId)`
5. Backend stores returned transaction hashes in the database

### Run contract tests

```bash
cd blockchain
npm run compile
npm test
```

## Backend Integration (later)

1. Deploy `GameReward` to Polygon Amoy (Phase 3).
2. Export ABI from `artifacts/contracts/GameReward.sol/GameReward.json`.
3. Share deployed address with backend `.env`.
4. Backend `BlockchainService` will consume ABI + address + RPC.

## Security

- Never commit `.env` or private keys.
- Use a dedicated deployer wallet with testnet funds only.
