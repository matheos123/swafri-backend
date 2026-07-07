# Web3 Battle Arena — Rock Paper Scissors
### Team Build Plan · Hackathon Edition

> **Deadline: Friday, July 11, 2026**
> **Stack:** Next.js (App Router) · NestJS · Socket.IO · PostgreSQL (via Prisma ORM) · Ethers.js · Redis · BullMQ

---

## What We Are Building

A real-time Rock Paper Scissors multiplayer arena with:
- Live matchmaking and socket-based gameplay
- Blockchain-based player identity and on-chain match result recording
- Transparent leaderboard and achievement badge system
- Spectator mode, match replay, in-game chat, and friend invitations
- Full SEO-optimized frontend with Next.js App Router metadata API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router) |
| Backend | NestJS 11 |
| Real-time | Socket.IO 4 |
| Database | PostgreSQL (accessed via Prisma ORM) |
| Cache / Queues | Redis + BullMQ |
| Blockchain | Ethers.js 6 |
| Auth | JWT (access + refresh tokens) |
| API Docs | Swagger (@nestjs/swagger) |


---

## Database Models (Prisma Schema)

Add these models to `prisma/schema.prisma` on top of the existing `User` model:

```prisma
model Match {
  id          String      @id @default(uuid())
  roomId      String      @unique
  player1Id   String
  player2Id   String
  winnerId    String?
  status      MatchStatus @default(WAITING)
  onChainHash String?
  rounds      MatchMove[]
  createdAt   DateTime    @default(now())
  endedAt     DateTime?
}

model MatchMove {
  id            String  @id @default(uuid())
  matchId       String
  match         Match   @relation(fields: [matchId], references: [id])
  roundNumber   Int
  player1Move   String?
  player2Move   String?
  roundWinnerId String?
}

model Achievement {
  id          String            @id @default(uuid())
  name        String            @unique
  description String
  iconUrl     String
  criteria    String
  users       UserAchievement[]
}

model UserAchievement {
  id            String      @id @default(uuid())
  userId        String
  achievementId String
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  earnedAt      DateTime    @default(now())
}

model Friendship {
  id          String           @id @default(uuid())
  requesterId String
  addresseeId String
  status      FriendshipStatus @default(PENDING)
  createdAt   DateTime         @default(now())
}

model ChatMessage {
  id        String   @id @default(uuid())
  roomId    String
  userId    String
  content   String
  createdAt DateTime @default(now())
}

enum MatchStatus {
  WAITING
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}
```

---

## Backend Modules (NestJS)

| Module | Owner | Status |
|---|---|---|
| `PrismaModule` | — | ✅ Scaffolded |
| `AuthModule` | — | ✅ Scaffolded |
| `UsersModule` | — | ✅ Scaffolded |
| `WalletModule` | — | ✅ Scaffolded |
| `HealthModule` | — | ✅ Scaffolded |
| `SocketModule` | Assign | 🔲 Build |
| `MatchmakingModule` | Assign | 🔲 Build |
| `GameModule` | Assign | 🔲 Build |
| `LeaderboardModule` | Assign | 🔲 Build |
| `ChatModule` | Assign | 🔲 Build |
| `FriendsModule` | Assign | 🔲 Build |
| `NotificationsModule` | Assign | 🔲 Build |
| `AchievementModule` | Assign | 🔲 Build |
| `BlockchainModule` | Assign | 🔲 Build |
| `ReplayModule` | Assign | 🔲 Build |

### Socket Events Contract

Everyone must use these exact event names to avoid integration headaches.

**Client → Server**

| Event | Payload |
|---|---|
| `matchmaking:join` | `{ userId }` |
| `matchmaking:cancel` | `{ userId }` |
| `game:move` | `{ roomId, move: 'rock' \| 'paper' \| 'scissors' }` |
| `game:rematch` | `{ roomId }` |
| `spectate:join` | `{ roomId }` |
| `chat:message` | `{ roomId, content }` |

**Server → Client**

| Event | Payload |
|---|---|
| `matchmaking:matched` | `{ roomId, opponent: UserDto }` |
| `game:state` | `{ round, status, yourMove?, opponentMoved }` |
| `game:result` | `{ roundWinner, matchWinner?, onChainHash }` |
| `game:countdown` | `{ secondsLeft }` |
| `chat:message` | `{ userId, username, content, timestamp }` |
| `notification:live` | `{ type, message, data }` |

---

## Frontend Pages (Next.js App Router)

| Route | Page | SEO Title |
|---|---|---|
| `/` | Landing page | "Web3 Battle Arena — Play Rock Paper Scissors & Earn Rewards" |
| `/auth/login` | Login | "Login — Web3 Battle Arena" |
| `/auth/register` | Register | "Create Account — Web3 Battle Arena" |
| `/dashboard` | Player hub | "Dashboard — Web3 Battle Arena" |
| `/matchmaking` | Queue lobby | "Find a Match — Web3 Battle Arena" |
| `/game/[roomId]` | Live game room | "Live Match — Web3 Battle Arena" |
| `/spectate/[roomId]` | Spectator view | "Spectating Match — Web3 Battle Arena" |
| `/replay/[matchId]` | Match replay | "Match Replay — Web3 Battle Arena" |
| `/leaderboard` | Rankings | "Global Leaderboard — Web3 Battle Arena" |
| `/profile/[userId]` | Public profile | "[Username]'s Profile — Web3 Battle Arena" |
| `/profile/me` | Own profile | "My Profile — Web3 Battle Arena" |
| `/friends` | Friends list | "Friends — Web3 Battle Arena" |

### SEO Setup (Next.js App Router)

Each page folder needs a `metadata` export. Example for `/leaderboard/page.tsx`:

```tsx
export const metadata = {
  title: "Global Leaderboard — Web3 Battle Arena",
  description: "See the top Rock Paper Scissors players ranked by wins, points, and on-chain verified match results.",
  openGraph: {
    title: "Global Leaderboard — Web3 Battle Arena",
    description: "Top players ranked by wins and blockchain-verified results.",
    url: "https://yourdomain.com/leaderboard",
    siteName: "Web3 Battle Arena",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Global Leaderboard — Web3 Battle Arena",
  },
};
```

For dynamic routes like `/profile/[userId]`, use `generateMetadata`:

```tsx
export async function generateMetadata({ params }) {
  const user = await fetchUser(params.userId);
  return {
    title: `${user.username}'s Profile — Web3 Battle Arena`,
    description: `${user.wins} wins · ${user.totalMatches} matches played`,
  };
}
```

Add a root `layout.tsx` with global defaults:

```tsx
export const metadata = {
  metadataBase: new URL("https://yourdomain.com"),
  title: { default: "Web3 Battle Arena", template: "%s — Web3 Battle Arena" },
  description: "Real-time Rock Paper Scissors with blockchain identity and rewards.",
  keywords: ["rock paper scissors", "web3 gaming", "blockchain", "multiplayer", "NFT rewards"],
};
```

### Shared Components

| Component | Used In |
|---|---|
| `<Navbar />` | All pages |
| `<GameBoard />` | `/game/[roomId]`, `/spectate/[roomId]` |
| `<ChatPanel />` | `/game/[roomId]`, `/spectate/[roomId]` |
| `<MatchCard />` | `/dashboard`, `/profile/[userId]`, `/replay/[matchId]` |
| `<AchievementBadge />` | `/profile/*`, `/dashboard` |
| `<LeaderboardTable />` | `/leaderboard`, `/` (preview) |
| `<WalletConnect />` | `/`, `/profile/me` |
| `<CountdownTimer />` | `/game/[roomId]` |
| `<NotificationToast />` | All pages (global) |

---

## 4-Day Sprint Timeline

### Day 1 — Tuesday July 8: Foundation

**Backend**
- [ ] Finalize and migrate the full Prisma schema (run `prisma migrate dev`)
- [ ] Complete `SocketModule` — shared gateway, connection/auth handshake
- [ ] Complete `MatchmakingModule` — queue logic, room creation, Redis-backed queue
- [ ] Seed DB with test users

**Frontend**
- [ ] Initialize Next.js project, set up Tailwind, folder structure
- [ ] Build root `layout.tsx` with global metadata and `<Navbar />`
- [ ] Build `/auth/login` and `/auth/register` pages, wire to backend API
- [ ] Set up socket client utility (`lib/socket.ts`)

---

### Day 2 — Wednesday July 9: Core Gameplay

**Backend**
- [ ] Complete `GameModule` — RPS state machine, move validation, round/match winner logic
- [ ] Connect `GameModule` to socket events (`game:move`, `game:state`, `game:result`)
- [ ] Add move timer with countdown (10 seconds per move)
- [ ] Start `LeaderboardModule` — score update on match end

**Frontend**
- [ ] Build `/matchmaking` page — join queue, waiting animation, `matchmaking:matched` redirect
- [ ] Build `/game/[roomId]` page — `<GameBoard />`, move buttons, round results, `<ChatPanel />`
- [ ] Build `<CountdownTimer />` component
- [ ] Handle game result display (winner/loser screen, rematch button)

---

### Day 3 — Thursday July 10: Social + Web3 + Leaderboard

**Backend**
- [ ] Complete `BlockchainModule` — write match result hash on-chain (or simulate with ethers.js)
- [ ] Complete `AchievementModule` — badge rules (first win, 5-win streak, etc.), award on match end
- [ ] Complete `FriendsModule` — send/accept/decline requests, invite to game
- [ ] Complete `NotificationsModule` — push live events via socket
- [ ] Complete `ReplayModule` — store and serve move history

**Frontend**
- [ ] Build `/leaderboard` page with `<LeaderboardTable />`
- [ ] Build `/profile/[userId]` and `/profile/me` pages with stats + badges
- [ ] Build `/friends` page
- [ ] Build `/spectate/[roomId]` page (read-only game state)
- [ ] Build `/replay/[matchId]` page
- [ ] Add `<WalletConnect />` button, display wallet address on profile
- [ ] Add `<NotificationToast />` for live events

---

### Day 4 — Friday July 11: Polish + SEO + Deploy

**Backend**
- [ ] Add `generateMetadata` equivalents — ensure all API responses include the data frontend needs for SEO
- [ ] Swagger docs — finalize all endpoints at `/api/docs`
- [ ] Error handling audit — all modules return consistent error responses
- [ ] Load test matchmaking queue

**Frontend**
- [ ] Add `metadata` export to every page
- [ ] Add `generateMetadata` to all dynamic routes
- [ ] Add `sitemap.ts` for static routes
- [ ] Add `robots.ts`
- [ ] Accessibility pass — keyboard navigation, ARIA labels on game buttons
- [ ] Mobile responsiveness check on all pages
- [ ] Fix all console errors and broken socket reconnect flows
- [ ] Final end-to-end test: register → queue → play → leaderboard → profile

---

## Environment Variables

Copy `.env.example` and fill in:

```
DATABASE_URL=postgresql://user:password@localhost:5432/web3_arena
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
REDIS_URL=redis://localhost:6379
BLOCKCHAIN_RPC_URL=https://your-rpc-url
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

---

## Team Suggested Split

| Person | Focus Area |
|---|---|
| Person A | Backend: SocketModule, MatchmakingModule, GameModule |
| Person B | Backend: BlockchainModule, AchievementModule, LeaderboardModule, ReplayModule |
| Person C | Frontend: Auth, Dashboard, Game Room, Matchmaking |
| Person D | Frontend: Leaderboard, Profile, Friends, Spectate, SEO |

Adjust based on your actual team size. The key constraint is that **Person A's GameModule must be ready by end of Day 2** — all frontend game work blocks on it.

---

## Git Workflow

- `main` — production-ready only
- `dev` — integration branch, merge here first
- Feature branches: `feat/game-module`, `feat/leaderboard-page`, etc.
- Do NOT commit `.env` files
- Run `prisma generate` after any schema change

---

## Definition of Done (by Friday)

- [ ] A player can register, log in, and connect a wallet
- [ ] Two players can queue and be matched into a live RPS game
- [ ] Both players submit moves and see results in real time
- [ ] Match result is recorded on-chain (or simulated hash)
- [ ] Leaderboard updates after each match
- [ ] Achievements are awarded for milestones
- [ ] Spectators can watch live matches
- [ ] Match replays are accessible
- [ ] All frontend pages have proper SEO metadata
- [ ] Sitemap and robots.txt are present
