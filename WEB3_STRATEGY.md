# Web3 Integration Strategy — Win This Hackathon

> **Core Principle:** Every meaningful action in the game leaves a verifiable, permanent on-chain record. Players own their reputation, achievements, and rewards as real digital assets.

---

## Why Most Web3 Gaming Projects Fail to Impress

- ❌ Wallet connection only (no actual blockchain use)
- ❌ "We'll add NFTs later" (vaporware)
- ❌ Centralized leaderboards with a blockchain sticker
- ❌ Off-chain gameplay with zero verifiability

## How We Stand Out

✅ **On-chain match commitments** — both players commit their move hash before revealing  
✅ **Verifiable match results** — anyone can verify a match actually happened  
✅ **NFT achievement badges** — real ERC-1155 tokens with rarity tiers  
✅ **Token rewards** — ERC-20 utility token for tournaments and governance  
✅ **Player reputation as an NFT** — soulbound profile with on-chain stats  
✅ **Transparent prize pool** — smart contract holds tournament funds  

---

## Web3 Architecture

### Smart Contracts (Deploy on Base, Polygon, or Arbitrum for low gas)

```
contracts/
├── BattleArena.sol          — Core game logic, match recording
├── AchievementNFT.sol       — ERC-1155 for achievement badges
├── ArenaToken.sol           — ERC-20 utility token (ARENA)
├── PlayerProfile.sol        — Soulbound ERC-721 for identity
└── TournamentPool.sol       — Prize pool distribution
```

### Match Flow (Commit-Reveal Pattern)

This is what separates you from amateur projects — **provable fair gameplay**:

```
1. Player A commits: keccak256(move + secret) → tx hash stored on-chain
2. Player B commits: keccak256(move + secret) → tx hash stored on-chain
3. Both reveal: submit (move, secret) → contract verifies hashes match
4. Contract determines winner → emits MatchResult event
5. Backend listens to event → updates leaderboard + issues rewards
```

**Why this matters:** Neither player can cheat. Moves are locked in before reveal. Judges can verify the logic on-chain.

---

## Smart Contract Design

### 1. BattleArena.sol (Core Match Contract)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BattleArena is Ownable, ReentrancyGuard {
    enum Move { None, Rock, Paper, Scissors }
    enum MatchStatus { Waiting, Committed, Revealed, Completed }

    struct Match {
        address player1;
        address player2;
        bytes32 commitment1;
        bytes32 commitment2;
        Move move1;
        Move move2;
        address winner;
        MatchStatus status;
        uint256 timestamp;
    }

    mapping(bytes32 => Match) public matches; // matchId => Match
    mapping(address => uint256) public playerWins;
    mapping(address => uint256) public playerLosses;

    event MatchCreated(bytes32 indexed matchId, address player1, address player2);
    event MoveCommitted(bytes32 indexed matchId, address player);
    event MatchRevealed(bytes32 indexed matchId, address winner, Move move1, Move move2);

    function createMatch(bytes32 matchId, address player1, address player2) external onlyOwner {
        require(matches[matchId].player1 == address(0), "Match exists");
        matches[matchId] = Match({
            player1: player1,
            player2: player2,
            commitment1: bytes32(0),
            commitment2: bytes32(0),
            move1: Move.None,
            move2: Move.None,
            winner: address(0),
            status: MatchStatus.Waiting,
            timestamp: block.timestamp
        });
        emit MatchCreated(matchId, player1, player2);
    }

    function commitMove(bytes32 matchId, bytes32 commitment) external {
        Match storage m = matches[matchId];
        require(msg.sender == m.player1 || msg.sender == m.player2, "Not a player");
        require(m.status == MatchStatus.Waiting || m.status == MatchStatus.Committed, "Invalid state");

        if (msg.sender == m.player1) {
            require(m.commitment1 == bytes32(0), "Already committed");
            m.commitment1 = commitment;
        } else {
            require(m.commitment2 == bytes32(0), "Already committed");
            m.commitment2 = commitment;
        }

        if (m.commitment1 != bytes32(0) && m.commitment2 != bytes32(0)) {
            m.status = MatchStatus.Committed;
        }

        emit MoveCommitted(matchId, msg.sender);
    }

    function revealMove(bytes32 matchId, Move move, string calldata secret) external {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Committed, "Not ready to reveal");
        require(msg.sender == m.player1 || msg.sender == m.player2, "Not a player");

        bytes32 commitment = keccak256(abi.encodePacked(move, secret));

        if (msg.sender == m.player1) {
            require(commitment == m.commitment1, "Invalid reveal");
            m.move1 = move;
        } else {
            require(commitment == m.commitment2, "Invalid reveal");
            m.move2 = move;
        }

        if (m.move1 != Move.None && m.move2 != Move.None) {
            _finalizeMatch(matchId);
        }
    }

    function _finalizeMatch(bytes32 matchId) internal {
        Match storage m = matches[matchId];
        m.status = MatchStatus.Revealed;

        if (m.move1 == m.move2) {
            m.winner = address(0); // Draw
        } else if (
            (m.move1 == Move.Rock && m.move2 == Move.Scissors) ||
            (m.move1 == Move.Paper && m.move2 == Move.Rock) ||
            (m.move1 == Move.Scissors && m.move2 == Move.Paper)
        ) {
            m.winner = m.player1;
            playerWins[m.player1]++;
            playerLosses[m.player2]++;
        } else {
            m.winner = m.player2;
            playerWins[m.player2]++;
            playerLosses[m.player1]++;
        }

        emit MatchRevealed(matchId, m.winner, m.move1, m.move2);
    }

    function getMatchResult(bytes32 matchId) external view returns (
        address player1,
        address player2,
        address winner,
        Move move1,
        Move move2,
        MatchStatus status
    ) {
        Match memory m = matches[matchId];
        return (m.player1, m.player2, m.winner, m.move1, m.move2, m.status);
    }
}
```

---

### 2. AchievementNFT.sol (ERC-1155 Achievement Badges)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AchievementNFT is ERC1155, Ownable {
    // Token IDs
    uint256 public constant FIRST_WIN = 1;
    uint256 public constant FIVE_WIN_STREAK = 2;
    uint256 public constant TEN_WINS = 3;
    uint256 public constant FIFTY_WINS = 4;
    uint256 public constant LEGENDARY_STREAK = 5; // 10+ win streak

    mapping(uint256 => string) private _uris;
    mapping(address => mapping(uint256 => bool)) public hasClaimed;

    event AchievementMinted(address indexed player, uint256 indexed achievementId);

    constructor() ERC1155("") {}

    function setURI(uint256 tokenId, string memory newuri) public onlyOwner {
        _uris[tokenId] = newuri;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _uris[tokenId];
    }

    function mintAchievement(address player, uint256 achievementId) external onlyOwner {
        require(!hasClaimed[player][achievementId], "Already claimed");
        hasClaimed[player][achievementId] = true;
        _mint(player, achievementId, 1, "");
        emit AchievementMinted(player, achievementId);
    }

    function mintBatch(address player, uint256[] memory ids) external onlyOwner {
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            require(!hasClaimed[player][ids[i]], "Already claimed");
            hasClaimed[player][ids[i]] = true;
            amounts[i] = 1;
        }
        _mintBatch(player, ids, amounts, "");
    }
}
```

---

### 3. ArenaToken.sol (ERC-20 Utility Token)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArenaToken is ERC20, Ownable {
    uint256 public constant MATCH_WIN_REWARD = 10 * 10**18; // 10 ARENA per win
    uint256 public constant DAILY_BONUS = 5 * 10**18;

    mapping(address => uint256) public lastClaimTimestamp;

    event TokensRewarded(address indexed player, uint256 amount, string reason);

    constructor() ERC20("Arena Token", "ARENA") {
        _mint(msg.sender, 1000000 * 10**18); // 1M initial supply
    }

    function rewardMatchWin(address player) external onlyOwner {
        _mint(player, MATCH_WIN_REWARD);
        emit TokensRewarded(player, MATCH_WIN_REWARD, "Match Win");
    }

    function claimDailyBonus() external {
        require(block.timestamp >= lastClaimTimestamp[msg.sender] + 1 days, "Already claimed today");
        lastClaimTimestamp[msg.sender] = block.timestamp;
        _mint(msg.sender, DAILY_BONUS);
        emit TokensRewarded(msg.sender, DAILY_BONUS, "Daily Bonus");
    }
}
```

---

### 4. PlayerProfile.sol (Soulbound Player Identity NFT)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlayerProfile is ERC721, Ownable {
    uint256 private _nextTokenId = 1;

    struct Profile {
        string username;
        uint256 wins;
        uint256 losses;
        uint256 longestStreak;
        uint256 registeredAt;
    }

    mapping(uint256 => Profile) public profiles;
    mapping(address => uint256) public playerToTokenId;

    event ProfileCreated(address indexed player, uint256 indexed tokenId, string username);
    event StatsUpdated(uint256 indexed tokenId, uint256 wins, uint256 losses, uint256 streak);

    constructor() ERC721("Arena Player Profile", "ARENA-PROFILE") {}

    function createProfile(address player, string calldata username) external onlyOwner {
        require(playerToTokenId[player] == 0, "Profile exists");

        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);

        profiles[tokenId] = Profile({
            username: username,
            wins: 0,
            losses: 0,
            longestStreak: 0,
            registeredAt: block.timestamp
        });

        playerToTokenId[player] = tokenId;
        emit ProfileCreated(player, tokenId, username);
    }

    function updateStats(address player, uint256 wins, uint256 losses, uint256 streak) external onlyOwner {
        uint256 tokenId = playerToTokenId[player];
        require(tokenId != 0, "No profile");

        Profile storage p = profiles[tokenId];
        p.wins = wins;
        p.losses = losses;
        if (streak > p.longestStreak) {
            p.longestStreak = streak;
        }

        emit StatsUpdated(tokenId, wins, losses, streak);
    }

    // Soulbound: prevent transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "Soulbound: cannot transfer");
        return super._update(to, tokenId, auth);
    }
}
```

---

## Backend Integration (NestJS)

### BlockchainModule Architecture

```
src/blockchain/
├── blockchain.module.ts
├── blockchain.service.ts       — ethers.js contract interaction
├── contracts/
│   ├── BattleArena.json        — ABI
│   ├── AchievementNFT.json
│   ├── ArenaToken.json
│   └── PlayerProfile.json
├── listeners/
│   ├── match-result.listener.ts — Listen to MatchRevealed event
│   └── achievement.listener.ts
└── dto/
    ├── commit-move.dto.ts
    ├── reveal-move.dto.ts
    └── mint-achievement.dto.ts
```

### Key Service Methods

```typescript
// blockchain.service.ts
import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import BattleArenaABI from './contracts/BattleArena.json';

@Injectable()
export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private battleArenaContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    this.battleArenaContract = new ethers.Contract(
      process.env.BATTLE_ARENA_ADDRESS,
      BattleArenaABI.abi,
      this.signer,
    );
  }

  // Create match on-chain
  async createMatch(matchId: string, player1: string, player2: string) {
    const matchIdBytes = ethers.id(matchId); // Convert to bytes32
    const tx = await this.battleArenaContract.createMatch(matchIdBytes, player1, player2);
    await tx.wait();
    return tx.hash;
  }

  // Player commits their move hash
  async commitMove(matchId: string, playerAddress: string, move: string, secret: string) {
    const commitment = ethers.solidityPackedKeccak256(
      ['uint8', 'string'],
      [this.moveToEnum(move), secret],
    );
    const matchIdBytes = ethers.id(matchId);
    
    // In production, have the player sign this transaction themselves
    const tx = await this.battleArenaContract.commitMove(matchIdBytes, commitment);
    await tx.wait();
    return { txHash: tx.hash, commitment };
  }

  // Player reveals their move
  async revealMove(matchId: string, move: string, secret: string) {
    const matchIdBytes = ethers.id(matchId);
    const tx = await this.battleArenaContract.revealMove(
      matchIdBytes,
      this.moveToEnum(move),
      secret,
    );
    const receipt = await tx.wait();
    
    // Parse MatchRevealed event
    const event = receipt.logs.find(
      log => log.topics[0] === ethers.id('MatchRevealed(bytes32,address,uint8,uint8)')
    );
    
    return { txHash: tx.hash, event };
  }

  // Get match result from chain
  async getMatchResult(matchId: string) {
    const matchIdBytes = ethers.id(matchId);
    const result = await this.battleArenaContract.getMatchResult(matchIdBytes);
    return {
      player1: result.player1,
      player2: result.player2,
      winner: result.winner,
      move1: this.enumToMove(result.move1),
      move2: this.enumToMove(result.move2),
      status: result.status,
    };
  }

  // Mint achievement NFT
  async mintAchievement(playerAddress: string, achievementId: number) {
    const achievementContract = new ethers.Contract(
      process.env.ACHIEVEMENT_NFT_ADDRESS,
      AchievementNFTABI.abi,
      this.signer,
    );
    const tx = await achievementContract.mintAchievement(playerAddress, achievementId);
    await tx.wait();
    return tx.hash;
  }

  // Reward ARENA tokens
  async rewardTokens(playerAddress: string) {
    const tokenContract = new ethers.Contract(
      process.env.ARENA_TOKEN_ADDRESS,
      ArenaTokenABI.abi,
      this.signer,
    );
    const tx = await tokenContract.rewardMatchWin(playerAddress);
    await tx.wait();
    return tx.hash;
  }

  private moveToEnum(move: string): number {
    const moves = { rock: 1, paper: 2, scissors: 3 };
    return moves[move.toLowerCase()];
  }

  private enumToMove(value: number): string {
    const moves = ['none', 'rock', 'paper', 'scissors'];
    return moves[value];
  }
}
```

---

## Frontend Web3 Integration

### Wallet Connection (RainbowKit or Dynamic.xyz)

Use **RainbowKit** for clean wallet UX:

```tsx
// app/providers.tsx
'use client';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base, polygon, arbitrum } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

const config = getDefaultConfig({
  appName: 'Web3 Battle Arena',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [base, polygon, arbitrum],
});

const queryClient = new QueryClient();

export function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Hook for Committing Moves

```tsx
// hooks/useCommitMove.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, encodePacked } from 'viem';
import BattleArenaABI from '@/contracts/BattleArena.json';

export function useCommitMove() {
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  const commitMove = async (matchId: string, move: 'rock' | 'paper' | 'scissors') => {
    const secret = crypto.randomUUID(); // Generate random secret
    const moveEnum = { rock: 1, paper: 2, scissors: 3 }[move];
    
    // Create commitment hash
    const commitment = keccak256(encodePacked(['uint8', 'string'], [moveEnum, secret]));
    
    // Store secret locally (needed for reveal phase)
    localStorage.setItem(`match_${matchId}_secret`, JSON.stringify({ move, secret }));
    
    // Submit commitment to contract
    writeContract({
      address: process.env.NEXT_PUBLIC_BATTLE_ARENA_ADDRESS,
      abi: BattleArenaABI.abi,
      functionName: 'commitMove',
      args: [matchId, commitment],
    });
  };

  return { commitMove, isLoading, isSuccess };
}
```

---

## Demo Flow for Judges

1. **Player Registration**
   - Connect wallet → Backend mints soulbound Player Profile NFT
   - Show NFT in MetaMask / OpenSea testnet

2. **Match Start**
   - Two players matched → Backend calls `createMatch()` on contract
   - Show Etherscan link: "Match created on-chain"

3. **Gameplay**
   - Player clicks Rock → Frontend calls `commitMove()` with hashed move
   - Both players commit → Frontend calls `revealMove()`
   - Contract emits `MatchRevealed` event with winner

4. **Rewards**
   - Backend listener catches event → Awards 10 ARENA tokens
   - Backend checks achievement criteria → Mints "First Win" NFT badge
   - Show NFT collection in player profile

5. **Leaderboard Verification**
   - Any visitor can call `playerWins(address)` on contract
   - Prove leaderboard data matches on-chain records

---

## What Judges Will See (That Others Won't Have)

| Feature | Why It Wins |
|---|---|
| **Etherscan links on every match** | Proves real blockchain use, not vapor |
| **Commit-reveal pattern** | Shows you understand game theory and cheating prevention |
| **NFT achievements in MetaMask** | Tangible digital ownership, not just a UI badge |
| **Token balance = real ERC-20** | Can be traded, used in future features |
| **Soulbound profile NFT** | Cutting-edge identity pattern (2024 trend) |
| **Event-driven architecture** | Backend reacts to on-chain events, not centralized DB |
| **Verifiable leaderboard** | Anyone can audit stats via contract calls |

---

## Tech Stack for Web3 Layer

### Smart Contracts
- **Framework:** Hardhat (compile, deploy, verify)
- **Language:** Solidity 0.8.20
- **Libraries:** OpenZeppelin Contracts
- **Chain:** Base Sepolia (testnet) or Polygon Mumbai

### Backend
- **Blockchain SDK:** Ethers.js v6
- **Event Listening:** Contract event listeners with WebSocket provider
- **Queue:** BullMQ for async NFT minting jobs

### Frontend
- **Wallet Kit:** RainbowKit + Wagmi
- **Chain Interaction:** Viem (lightweight ethers alternative)
- **State:** Wagmi hooks for contract reads/writes

---

## Deployment Checklist

- [ ] Deploy all 4 contracts to testnet
- [ ] Verify contracts on Etherscan
- [ ] Upload achievement badge metadata to IPFS
- [ ] Set contract addresses in `.env`
- [ ] Fund backend wallet with testnet ETH for gas
- [ ] Test full commit-reveal flow
- [ ] Add "View on Etherscan" links to all match results
- [ ] Prepare 2-minute demo: register → play → win → show NFT in wallet

---

## Budget Estimate (Testnet — Free)

- Sepolia/Mumbai ETH: Free from faucet
- Contract deployment: ~$0 (testnet)
- IPFS pinning (Pinata): Free tier
- RPC calls (Alchemy/Infura): Free tier

For mainnet (post-hackathon):
- Base L2 gas: ~$0.01 per transaction
- Polygon gas: ~$0.001 per transaction

---

## Final Pitch to Judges

> "Other teams show you a game with a 'Connect Wallet' button. We show you a game where **every match is cryptographically provable**, achievements are **real NFTs you own**, and the leaderboard is **verifiable on-chain**. Click any match result — you'll see the Etherscan transaction. Open MetaMask — you'll see your achievement badges. This isn't a Web3 demo. This is **actual decentralized gaming infrastructure**."

That's how you win.
