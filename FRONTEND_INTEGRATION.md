# Web3 Battle Arena — Frontend Integration Guide

## Base URLs

| Environment | REST API | WebSocket |
|-------------|----------|-----------|
| Local | `http://localhost:3001/api/v1` | `http://localhost:3001` |
| Production | `https://rps-arena-2q2f.onrender.com/api/v1` | `https://rps-arena-2q2f.onrender.com`
> The WebSocket server runs on the **same URL** as the REST API

---

## Authentication

All tokens are stored in **httpOnly cookies** — the frontend never touches them directly.

## REST API

### Auth

---

#### `POST /auth/register`
Register a new user with email and password.

**Body:**
```json
{
  "email": "player@arena.com",
  "username": "player1",
  "password": "P@ssw0rd1"
}
```

**Password rules:** min 8 chars, must contain letters and numbers.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "player@arena.com",
      "username": "player1",
      "role": "USER",
      "blockchainProfileId": "0xabc123...",
      "walletAddress": null,
      "walletVerifiedAt": null,
      "wins": 0,
      "losses": 0,
      "points": 0
    }
  }
}
```

> JWT cookies are set automatically. Redirect to dashboard.

---

#### `POST /auth/login`
Login with email and password.

**Body:**
```json
{
  "email": "player@arena.com",
  "password": "P@ssw0rd1"
}
```

**Response:** same as register.

---

#### `POST /auth/logout`
Logout the current user. Clears auth cookies.

**Auth:** Required  
**Body:** none

---

#### `GET /auth/profile`
Get the current authenticated user's profile.

**Auth:** Required  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "player@arena.com",
    "username": "player1",
    "role": "USER",
    "blockchainProfileId": "0xabc...",
    "walletAddress": "0x1234...",
    "walletVerifiedAt": "2026-07-09T10:00:00.000Z",
    "wins": 5,
    "losses": 2,
    "totalMatches": 7,
    "points": 50,
    "currentStreak": 3,
    "longestStreak": 5
  }
}
```

---

#### `POST /auth/change-password`
Change password for logged-in user.

**Auth:** Required  
**Body:**
```json
{
  "currentPassword": "OldP@ssw0rd1",
  "newPassword": "NewP@ssw0rd1"
}
```

---

#### Password Reset Flow (3 steps)

**Step 1 — Request OTP**

`POST /auth/request-otp`
```json
{ "email": "player@arena.com" }
```
Sends a 6-digit OTP to the email. Sets a `resetToken` cookie.

**Step 2 — Verify OTP**

`POST /auth/verify-otp`
```json
{ "otp": "123456" }
```
Upgrades the `resetToken` cookie with `otpVerified: true`.

**Step 3 — Reset Password**

`POST /auth/reset-password`
```json
{ "newPassword": "NewP@ssw0rd1" }
```
Clears the reset cookie. User can now login with the new password.

---

### SIWE — Sign-In With Ethereum

This is the Web3 login flow. No email or password needed. The wallet is the identity.

---

#### Step 1 — Get Challenge

`GET /auth/wallet/challenge?address=0xYOUR_WALLET_ADDRESS`

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Web3 Battle Arena wants you to sign in.\n\nWallet: 0xABC...\nNonce: A3F9B2C1\nIssued At: 2026-07-09T10:00:00.000Z\nChain ID: 84532 (Base Sepolia)",
    "nonce": "A3F9B2C1"
  }
}
```

#### Step 2 — Sign with MetaMask

```ts
import { BrowserProvider } from 'ethers'

const provider = new BrowserProvider(window.ethereum)
const signer = await provider.getSigner()
const signature = await signer.signMessage(message) // message from step 1
```

#### Step 3 — Verify Signature

`POST /auth/wallet/verify`
```json
{
  "address": "0xYOUR_WALLET_ADDRESS",
  "signature": "0xSIGNATURE_FROM_METAMASK"
}
```

**Response:** same as register/login — JWT cookies set, user object returned.

> If this is the first time this wallet is seen, an account is auto-created with a generated username (`Player_ABCDEF`). The user can update their username later via `PATCH /users/me`.

---

### Wallet — Connect to Existing Email Account

For users who registered with email and want to link their wallet.

---

#### Step 1 — Get Challenge

`GET /wallet/challenge`  
**Auth:** Required  
**Body:**
```json
{ "address": "0xYOUR_WALLET_ADDRESS" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Web3 Battle Arena — Connect Wallet\n\nUser ID: ...\nWallet: 0xABC...\nNonce: XYZ123\n...",
    "nonce": "XYZ123"
  }
}
```

#### Step 2 — Sign with MetaMask (same as SIWE step 2)

#### Step 3 — Connect

`POST /wallet/connect`  
**Auth:** Required  
```json
{
  "walletAddress": "0xYOUR_WALLET_ADDRESS",
  "signature": "0xSIGNATURE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "walletAddress": "0xABC...",
    "blockchainProfileId": "0xhash...",
    "verifiedAt": "2026-07-09T10:00:00.000Z"
  }
}
```

> After connecting a wallet, the user becomes **ranked**. Their stats will be saved in future matches and they'll appear on the leaderboard.

---

#### `POST /wallet/disconnect`
**Auth:** Required  
Unlinks the wallet. User goes back to unranked.

---

#### `GET /wallet/status`
**Auth:** Required  
```json
{
  "success": true,
  "data": {
    "connected": true,
    "walletAddress": "0xABC...",
    "walletVerifiedAt": "2026-07-09T10:00:00.000Z",
    "blockchainProfileId": "0xhash..."
  }
}
```

---

### Users

---

#### `GET /users/:id`
Public profile. No auth required.

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "player1",
    "avatar": null,
    "walletAddress": "0xABC...",
    "blockchainProfileId": "0xhash...",
    "wins": 10,
    "losses": 3,
    "totalMatches": 13,
    "points": 100,
    "currentStreak": 2,
    "longestStreak": 7
  }
}
```

---

#### `PATCH /users/me`
Update your own profile.  
**Auth:** Required  
```json
{
  "username": "newusername",
  "avatar": "https://..."
}
```

---

### Leaderboard

---

#### `GET /leaderboard?limit=50&offset=0`
Public. Returns ranked players only (wallet verified).

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "player1",
      "walletAddress": "0xABC...",
      "blockchainProfileId": "0xhash...",
      "wins": 50,
      "losses": 10,
      "totalMatches": 60,
      "points": 500,
      "currentStreak": 5,
      "longestStreak": 12,
      "winRate": 83
    }
  ]
}
```

---

#### `GET /leaderboard/me`
**Auth:** Required. Returns your rank.

```json
{
  "success": true,
  "data": {
    "rank": 5,
    "points": 80,
    "totalRankedPlayers": 24
  }
}
```

> Returns `rank: -1` if you have no verified wallet.

---

#### `GET /leaderboard/rank/:userId`
Public. Returns a specific player's rank.

---

### Achievements

---

#### `GET /achievements`
Public. All available badges.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "First Victory",
      "description": "Win your very first match.",
      "iconUrl": "https://web3arena.com/badges/first-victory.png",
      "criteria": "wins >= 1"
    }
  ]
}
```

---

#### `GET /achievements/me`
**Auth:** Required. Your earned badges.

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "earnedAt": "2026-07-09T10:00:00.000Z",
      "achievement": {
        "name": "First Victory",
        "description": "Win your very first match.",
        "iconUrl": "https://..."
      }
    }
  ]
}
```

---

#### `GET /achievements/user/:userId`
Public. Another player's earned badges.

---

### Friends

All friends endpoints require authentication.

---

#### `POST /friends/request`
Send a friend request.
```json
{ "addresseeId": "target-user-uuid" }
```

#### `PATCH /friends/respond`
Accept or block a request.
```json
{
  "friendshipId": "friendship-uuid",
  "action": "ACCEPTED"
}
```
`action` can be `"ACCEPTED"` or `"BLOCKED"`.

#### `GET /friends`
List all accepted friends.

#### `GET /friends/requests`
List incoming pending requests.

#### `DELETE /friends/:friendId`
Remove a friend.

---

#### `POST /friends/:friendId/invite`
**Auth:** Required. Invite a friend to a game.

- Friend must be online (connected to the socket server)
- Friend receives a `notification:live` event with `type: 'game_invite'`
- Friend can then emit `matchmaking:join` to enter the queue

```json
// Response
{
  "success": true,
  "data": { "invited": true, "message": "Game invite sent to friend" }
}
```

---

### Notifications

#### `GET /notifications?limit=50&offset=0`
**Auth:** Required. Get all notifications for the current user.
Unread notifications appear first. Supports pagination.

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "FRIEND_REQUEST",
        "message": "Abenezer sent you a friend request",
        "data": { "friendshipId": "uuid", "username": "Abenezer" },
        "read": false,
        "createdAt": "2026-07-09T10:00:00.000Z"
      }
    ],
    "unreadCount": 3,
    "limit": 50,
    "offset": 0
  }
}
```

#### `PATCH /notifications/:id/read`
**Auth:** Required. Mark a single notification as read.

#### `PATCH /notifications/read-all`
**Auth:** Required. Mark all notifications as read.

---

### Replay & Match History

#### `GET /replay/history/me?limit=20&offset=0`
**Auth:** Required. Your ranked match history with results.

```json
{
  "success": true,
  "data": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "matches": [
      {
        "matchId": "uuid",
        "isRanked": true,
        "opponent": { "id": "uuid", "username": "Player1", "walletAddress": "0x..." },
        "result": "win",
        "onChainHash": "0xhash...",
        "rounds": [
          { "roundNumber": 1, "player1Move": "rock", "player2Move": "scissors", "roundWinnerId": "uuid" }
        ],
        "playedAt": "2026-07-09T10:00:00.000Z",
        "endedAt": "2026-07-09T10:05:00.000Z"
      }
    ]
  }
}
```

#### `GET /replay/history/:userId?limit=20&offset=0`
Public. Any player's ranked match history.

#### `GET /replay/:matchId`
Public. Full round-by-round replay of any match.

```json
{
  "success": true,
  "data": {
    "matchId": "uuid",
    "isRanked": true,
    "status": "COMPLETED",
    "player1": { "id": "uuid", "username": "Player1", "walletAddress": "0x...", "blockchainProfileId": "0x..." },
    "player2": { "id": "uuid", "username": "Player2", "walletAddress": "0x...", "blockchainProfileId": "0x..." },
    "winner":  { "id": "uuid", "username": "Player1" },
    "onChainHash": "0xhash...",
    "rounds": [
      { "roundNumber": 1, "player1Move": "rock", "player2Move": "scissors", "roundWinnerId": "uuid" },
      { "roundNumber": 2, "player1Move": "paper", "player2Move": "rock", "roundWinnerId": "uuid" }
    ],
    "createdAt": "2026-07-09T10:00:00.000Z",
    "endedAt":   "2026-07-09T10:05:00.000Z"
  }
}
```

---

### Verify (Public — no auth needed)

These are the Web3 proof endpoints. Judges and auditors use these to independently verify any match or player identity.

#### `GET /verify/match/:matchId`
Returns match result with on-chain hash and block explorer link.

```json
{
  "success": true,
  "data": {
    "matchId": "uuid",
    "isRanked": true,
    "player1": { "username": "Player1", "walletAddress": "0x...", "blockchainProfileId": "0x..." },
    "player2": { "username": "Player2", "walletAddress": "0x...", "blockchainProfileId": "0x..." },
    "winner":  { "username": "Player1", "walletAddress": "0x..." },
    "result":  "decisive",
    "onChainHash": "0xabc123...",
    "blockExplorerUrl": "https://sepolia.basescan.org/search?q=0xabc123...",
    "rounds": [...],
    "verifyInstructions": [
      "1. The onChainHash is a keccak256 hash of the match result.",
      "2. You can search the hash on the block explorer link above.",
      "3. To independently verify: compute keccak256(matchId + player addresses + winner + moves + timestamp).",
      "4. If the hash matches, the result is cryptographically proven and tamper-proof."
    ]
  }
}
```

#### `GET /verify/player/:profileId`
Returns player identity card by blockchain profile ID.

```json
{
  "success": true,
  "data": {
    "profileId": "0xhash...",
    "username": "Player1",
    "walletAddress": "0xABC...",
    "walletVerified": true,
    "walletVerifiedAt": "2026-07-09T10:00:00.000Z",
    "blockExplorerUrl": "https://sepolia.basescan.org/address/0xABC...",
    "stats": {
      "wins": 25, "losses": 10, "totalMatches": 35,
      "points": 250, "currentStreak": 3, "longestStreak": 8, "winRate": 71
    },
    "achievements": [...],
    "achievementCount": 4,
    "memberSince": "2026-07-09T08:00:00.000Z"
  }
}
```

#### `GET /verify/wallet/:walletAddress`
Same as above but looked up by wallet address instead of profile ID.

---

## WebSocket (Socket.IO)

### Setup

Install the Socket.IO client:
```bash
npm install socket.io-client
```

Connect:
```ts
import { io } from 'socket.io-client'

const socket = io('https://rps-arena-2q2f.onrender.com', {
  withCredentials: true,  // sends cookies for auth
  transports: ['websocket'],
})

socket.on('connect', () => {
  console.log('Connected:', socket.id)
})
```

> One connection handles all events — matchmaking, game, chat, notifications, leaderboard.

---

### Matchmaking

#### Emit: `matchmaking:join`
Join the matchmaking queue.
```ts
socket.emit('matchmaking:join', {
  userId: 'your-user-uuid',
  username: 'YourUsername',
})
```

#### Listen: `matchmaking:queued`
Confirmation you're in the queue.
```ts
socket.on('matchmaking:queued', (data) => {
  console.log(`Queue position: ${data.position}`)
  // Show "Looking for opponent..." UI
})
```

#### Listen: `matchmaking:matched`
A match was found. Received by both players.
```ts
socket.on('matchmaking:matched', (data) => {
  console.log(data)
  // {
  //   roomId: "room-uuid",
  //   matchId: "uuid",
  //   isRanked: false,
  //   opponent: { userId: "uuid", username: "Opponent" }
  // }
  // Store roomId — you need it for all game events
  // Navigate to game screen
})
```

#### Emit: `matchmaking:cancel`
Leave the queue.
```ts
socket.emit('matchmaking:cancel', { userId: 'your-user-uuid' })
```

---

### Gameplay

#### Emit: `game:move`
Submit your move for the current round.
```ts
socket.emit('game:move', {
  roomId: 'room-uuid',   // from matchmaking:matched
  userId: 'your-user-uuid',
  move: 'rock',          // 'rock' | 'paper' | 'scissors'
})
```

#### Listen: `game:move_received`
Your move was accepted. Waiting for opponent.
```ts
socket.on('game:move_received', (data) => {
  // { roomId, round }
  // Show "Waiting for opponent..." UI
})
```

#### Listen: `game:opponent_moved`
Opponent submitted their move (you don't see what it is yet).
```ts
socket.on('game:opponent_moved', (data) => {
  // { roomId }
  // Show "Opponent has moved!" indicator
})
```

#### Listen: `game:round_result`
Both players moved. Round resolved. Received by both players + spectators.
```ts
socket.on('game:round_result', (data) => {
  // {
  //   roundNumber: 1,
  //   player1Move: 'rock',
  //   player2Move: 'scissors',
  //   roundWinnerId: 'uuid',   // null on draw
  //   player1Wins: 1,
  //   player2Wins: 0
  // }
  // Reveal both moves, show who won the round
})
```

#### Listen: `game:next_round`
Advance to the next round.
```ts
socket.on('game:next_round', (data) => {
  // { roundNumber: 2 }
  // Reset move selection UI for next round
})
```

#### Listen: `game:match_result`
Match is over. Received by both players + spectators.
```ts
socket.on('game:match_result', (data) => {
  // {
  //   winnerId: 'uuid',        // null on draw
  //   player1Wins: 2,
  //   player2Wins: 1,
  //   matchId: 'uuid',
  //   onChainHash: '0xhash...',  // blockchain proof
  //   isRanked: true
  // }
  // Show match result screen
  // If isRanked: show stats updated message
  // If !isRanked: show "Connect wallet to save progress" prompt
})
```

#### Emit: `game:rematch`
Request a rematch.
```ts
socket.emit('game:rematch', { roomId: 'room-uuid' })
```

#### Listen: `game:rematch_requested`
Opponent wants a rematch.
```ts
socket.on('game:rematch_requested', (data) => {
  // Show "Opponent wants a rematch" prompt
})
```

---

### Spectator Mode

#### Emit: `game:list_rooms`
Get all active game rooms (for spectator lobby).
```ts
socket.emit('game:list_rooms')
```

#### Listen: `game:rooms`
```ts
socket.on('game:rooms', (rooms) => {
  // [
  //   { roomId, player1, player2, round, isRanked }
  // ]
})
```

#### Emit: `spectate:join`
Join a room as a spectator.
```ts
socket.emit('spectate:join', { roomId: 'room-uuid' })
```

#### Listen: `spectate:joined`
Current game state snapshot.
```ts
socket.on('spectate:joined', (data) => {
  // {
  //   roomId, player1, player2,
  //   currentRound, player1Wins, player2Wins,
  //   status, isRanked
  // }
  // Render current game state
})
```

> After joining as spectator, listen to `game:round_result`, `game:match_result`, and `game:next_round` — they are broadcast to the whole room including spectators.

---

### Chat

Every client auto-joins the `lobby` room on connection.

#### Emit: `chat:join`
Join a specific room channel (usually the game room after matching).
```ts
socket.emit('chat:join', { roomId: 'room-uuid' })
// or for lobby:
socket.emit('chat:join', { roomId: 'lobby' })
```

#### Listen: `chat:joined`
History of last 50 messages.
```ts
socket.on('chat:joined', (data) => {
  // { roomId, history: [ { id, userId, username, content, createdAt } ] }
})
```

#### Emit: `chat:message`
Send a message.
```ts
socket.emit('chat:message', {
  roomId: 'room-uuid',      // or 'lobby'
  userId: 'your-user-uuid',
  username: 'YourUsername',
  content: 'Good game!',
})
```

#### Listen: `chat:message`
Incoming message broadcast to the room.
```ts
socket.on('chat:message', (data) => {
  // {
  //   id, roomId, userId, username,
  //   content, timestamp
  // }
})
```

#### Emit: `chat:history`
Fetch history manually.
```ts
socket.emit('chat:history', { roomId: 'lobby' })
```

#### Listen: `chat:history`
```ts
socket.on('chat:history', (data) => {
  // { roomId, messages: [...] }
})
```

---

### Notifications

Real-time notifications pushed from the server. Always listen to this.

#### Listen: `notification:live`
```ts
socket.on('notification:live', (data) => {
  // {
  //   type: 'friend_request' | 'friend_accepted' | 'game_invite'
  //        | 'achievement_earned' | 'match_found' | 'info',
  //   message: 'You earned the First Victory badge!',
  //   data: { ... }   // optional extra context
  // }
  // Show toast or notification banner
})
```

---

### Leaderboard Real-Time

#### Listen: `leaderboard:update`
Fired automatically after every ranked match. Received by ALL connected clients.
```ts
socket.on('leaderboard:update', (leaderboard) => {
  // Same shape as GET /leaderboard response
  // Update leaderboard UI in real time
})
```

---

## Ranked vs Unranked

| Condition | Result |
|-----------|--------|
| Both players have verified wallets | `isRanked: true` |
| Either player has no wallet | `isRanked: false` |

**Unranked match:**
- Game plays normally
- Result shown via socket
- Stats NOT saved
- Leaderboard NOT updated
- Achievements NOT awarded
- `notification:live` fires with wallet connect prompt

**Ranked match:**
- Everything saved
- Stats updated
- Achievements checked
- `onChainHash` generated
- Leaderboard updated for all clients

---

## User Flow Summary

```
New User
  │
  ├── Register with email → play unranked → prompt to connect wallet
  │
  └── Sign in with MetaMask (SIWE) → wallet auto-connected → play ranked immediately

After wallet connected:
  → Matches are ranked
  → Stats saved
  → Achievements earned
  → Appears on leaderboard
  → Match results recorded on-chain (onChainHash)
```

---

## Error Response Format

All errors follow this shape:
```json
{
  "success": false,
  "statusCode": 400,
  "timestamp": "2026-07-09T10:00:00.000Z",
  "path": "/api/v1/auth/login",
  "method": "POST",
  "message": { "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }
}
```

Common status codes:
| Code | Meaning |
|------|---------|
| 400 | Bad request — validation failed |
| 401 | Unauthorized — not logged in or token expired |
| 403 | Forbidden — logged in but insufficient role |
| 404 | Not found |
| 409 | Conflict — email/username already taken |
| 500 | Server error |

---

## Quick Reference

### REST Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register with email |
| POST | `/auth/login` | No | Login with email |
| POST | `/auth/logout` | Yes | Logout |
| GET | `/auth/profile` | Yes | Get own profile |
| POST | `/auth/change-password` | Yes | Change password |
| POST | `/auth/request-otp` | No | Request OTP |
| POST | `/auth/verify-otp` | No | Verify OTP |
| POST | `/auth/reset-password` | No | Reset password |
| GET | `/auth/wallet/challenge` | No | Get SIWE challenge |
| POST | `/auth/wallet/verify` | No | SIWE login/register |
| GET | `/wallet/challenge` | Yes | Wallet connect challenge |
| POST | `/wallet/connect` | Yes | Connect wallet |
| POST | `/wallet/disconnect` | Yes | Disconnect wallet |
| GET | `/wallet/status` | Yes | Wallet status |
| GET | `/users/:id` | No | Public profile |
| PATCH | `/users/me` | Yes | Update own profile |
| GET | `/leaderboard` | No | Full leaderboard |
| GET | `/leaderboard/me` | Yes | Your rank |
| GET | `/leaderboard/rank/:userId` | No | Player rank |
| GET | `/achievements` | No | All badges |
| GET | `/achievements/me` | Yes | Your badges |
| GET | `/achievements/user/:userId` | No | Player badges |
| POST | `/friends/request` | Yes | Send request |
| PATCH | `/friends/respond` | Yes | Accept/block |
| GET | `/friends` | Yes | Friend list |
| GET | `/friends/requests` | Yes | Pending requests |
| DELETE | `/friends/:friendId` | Yes | Remove friend |
| POST | `/friends/:friendId/invite` | Yes | Invite friend to game |
| GET | `/notifications` | Yes | Get all notifications |
| PATCH | `/notifications/:id/read` | Yes | Mark one as read |
| PATCH | `/notifications/read-all` | Yes | Mark all as read |
| GET | `/replay/history/me` | Yes | Your match history |
| GET | `/replay/history/:userId` | No | Player match history |
| GET | `/replay/:matchId` | No | Match replay |
| GET | `/verify/match/:matchId` | No | Verify match on-chain |
| GET | `/verify/player/:profileId` | No | Verify player identity |
| GET | `/verify/wallet/:walletAddress` | No | Verify by wallet |

### Socket Events

| Direction | Event | Description |
|-----------|-------|-------------|
| Emit | `matchmaking:join` | Join queue |
| Emit | `matchmaking:cancel` | Leave queue |
| Listen | `matchmaking:queued` | Queue position |
| Listen | `matchmaking:matched` | Match found |
| Emit | `game:move` | Submit move |
| Listen | `game:move_received` | Move acknowledged |
| Listen | `game:opponent_moved` | Opponent moved |
| Listen | `game:round_result` | Round resolved |
| Listen | `game:next_round` | Next round |
| Listen | `game:match_result` | Match over |
| Emit | `game:rematch` | Request rematch |
| Listen | `game:rematch_requested` | Opponent wants rematch |
| Emit | `game:list_rooms` | Get active rooms |
| Listen | `game:rooms` | Active rooms list |
| Emit | `spectate:join` | Join as spectator |
| Listen | `spectate:joined` | Game state snapshot |
| Emit | `chat:join` | Join chat room |
| Listen | `chat:joined` | Room history |
| Emit | `chat:message` | Send message |
| Listen | `chat:message` | Receive message |
| Emit | `chat:history` | Request history |
| Listen | `chat:history` | Message history |
| Listen | `notification:live` | Live notifications |
| Listen | `leaderboard:update` | Leaderboard refresh |
