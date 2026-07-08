# Web3 Battle Arena — API Documentation

Base URL (local): `http://localhost:3001/api/v1`  
Swagger UI: `http://localhost:3001/api/v1/docs`  
WebSocket (Socket.IO): same host/port as HTTP (`http://localhost:3001`)

All successful REST responses are wrapped:

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

---

## Quick E2E flow

1. `POST /auth/register` or `POST /auth/login` → save `accessToken` + `user.id`
2. `POST /wallet/connect` (JWT + MetaMask signature) → save `walletAddress`
3. Socket: `matchmaking:join` → `game:move` until `game:match_result`
4. Backend auto-writes to `GameReward` on Polygon Amoy if winner has a wallet
5. Verify: `GET /blockchain/player/:wallet` and `GET /blockchain/match/:id`

Network: **Polygon Amoy** (`chainId` `80002`)  
Contract: `0xc6B4Edae0666e59f6475079A58d97483A1fd0d42`

---

## Auth

### Register

`POST /auth/register`

```json
{
  "email": "player1@test.com",
  "username": "player1",
  "password": "Password123!"
}
```

Password: 8–128 chars, must include letters and numbers.

**Response `data`:**

```json
{
  "user": { "id": "uuid", "email": "...", "username": "...", "...": "..." },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Login

`POST /auth/login`

```json
{
  "email": "player1@test.com",
  "password": "Password123!"
}
```

Same response shape as register.

### Refresh

`POST /auth/refresh`

```json
{
  "refreshToken": "eyJ..."
}
```

### Logout (JWT)

`POST /auth/logout`  
Header: `Authorization: Bearer <accessToken>`

### Profile (JWT)

`GET /auth/profile`  
Header: `Authorization: Bearer <accessToken>`

---

## Wallet (all require JWT)

Wallet connect is **not** login. Login first, then link MetaMask.

**Recommended message (sign this exact string in MetaMask):**

```text
Connect wallet to Web3 Battle Arena
```

### Connect

`POST /wallet/connect`  
Header: `Authorization: Bearer <accessToken>`

```json
{
  "walletAddress": "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
  "message": "Connect wallet to Web3 Battle Arena",
  "signature": "0x..."
}
```

| Field | Rules |
|-------|--------|
| `walletAddress` | `0x` + 40 hex characters |
| `message` | Must match the exact MetaMask-signed text |
| `signature` | From `personal_sign` / ethers `signer.signMessage(message)` |

**Success `data`:**

```json
{
  "connected": true,
  "walletAddress": "0x1be31a94361a391bbafb2a4ccd704f57dc04d4bb"
}
```

Address is stored lowercase.

**Errors:** `401` invalid JWT · `400` invalid signature · `400` wallet already linked to another user

### Status

`GET /wallet/status`  
Header: `Authorization: Bearer <accessToken>`

```json
{
  "connected": true,
  "walletAddress": "0x..."
}
```

### Disconnect

`POST /wallet/disconnect`  
Header: `Authorization: Bearer <accessToken>`

```json
{
  "connected": false,
  "walletAddress": null
}
```

### Frontend example (ethers v6)

```ts
import { BrowserProvider } from "ethers";

const API = "http://localhost:3001/api/v1";
const WALLET_MESSAGE = "Connect wallet to Web3 Battle Arena";

export async function connectWallet(accessToken: string) {
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const walletAddress = await signer.getAddress();
  const signature = await signer.signMessage(WALLET_MESSAGE);

  const res = await fetch(`${API}/wallet/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ walletAddress, message: WALLET_MESSAGE, signature }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.data;
}
```

---

## Blockchain (public GETs — no JWT)

Read-only. Writes happen automatically after a wallet-linked player wins a match.

### Health

`GET /blockchain/health`

```json
{
  "status": "healthy",
  "network": "matic-amoy",
  "contractAddress": "0xc6B4Edae0666e59f6475079A58d97483A1fd0d42",
  "chainId": 80002,
  "owner": "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
  "rpcConnected": true,
  "contractDeployed": true
}
```

`status`: `healthy` | `degraded` | `unavailable`

### Player on-chain

`GET /blockchain/player/:wallet`

Example: `GET /blockchain/player/0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb`

```json
{
  "wallet": "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
  "points": "10",
  "badges": [1]
}
```

Badge IDs: `1` Water · `2` Fire · `3` Gold · `4` Diamond · `5` Platinum (streak milestones 3/5/7/10/15)

### Match on-chain

`GET /blockchain/match/:id`  
`:id` can be the backend match UUID (converted to on-chain id) or a numeric on-chain id.

```json
{
  "matchId": "123...",
  "winner": "0x...",
  "timestamp": "1720435200",
  "gameType": "rps",
  "resultHash": "0x...",
  "pointsAwarded": "10",
  "badgeEarned": 0
}
```

`404` if the match was never recorded on-chain (or winner had no wallet).

---

## Game (REST — read only)

Play is via WebSocket, not REST.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/game/rooms/count` | Active room count |
| `GET` | `/game/rooms/:roomId` | Room snapshot |

---

## WebSocket (Socket.IO)

Connect to: `http://localhost:3001` (Socket.IO default path `/socket.io`)

### Matchmaking

**Emit** `matchmaking:join`

```json
{ "userId": "<user-uuid>", "username": "player1" }
```

**Listen**

| Event | Meaning |
|-------|---------|
| `matchmaking:queued` | Waiting in queue |
| `matchmaking:matched` | Match found → `{ roomId, matchId, opponent }` |
| `matchmaking:cancelled` | Left queue |

**Emit** `matchmaking:cancel` → `{ "userId": "..." }`

### Play (best of 3 — first to 2 wins)

**Emit** `game:move`

```json
{
  "roomId": "room-...",
  "userId": "<user-uuid>",
  "move": "rock"
}
```

`move`: `rock` | `paper` | `scissors`

**Listen**

| Event | Meaning |
|-------|---------|
| `game:move_received` | Your move accepted |
| `game:opponent_moved` | Opponent moved |
| `game:round_result` | Round finished |
| `game:next_round` | Next round number |
| `game:match_result` | Match finished → `{ winnerId, player1Wins, player2Wins, matchId, onChainHash }` |
| `game:error` | Error message |

### After match ends (automatic — no frontend call)

1. DB: `Match.status = COMPLETED`, winner `points += 10`
2. If winner has `walletAddress` and blockchain is ready:
   - `recordMatch` → `awardPoints(10)` → optional `mintBadge`
3. DB: `onChainStatus = CONFIRMED`, `onChainTxHash` set
4. Else: `onChainStatus` stays `PENDING`

---

## Other REST modules

| Tag | Paths | Auth |
|-----|-------|------|
| Users | `GET /users`, `GET /users/:id`, `PATCH /users/:id` | PATCH needs JWT |
| Leaderboard | `GET /leaderboard`, `GET /leaderboard/rank/:userId` | Public |
| Achievements | `GET /achievements`, `GET /achievements/user/:userId` | Public |
| Replay | `GET /replay/:matchId`, `GET /replay/history/:userId` | Public |
| Friends | `POST /friends/request`, `PATCH /friends/respond`, `GET /friends`, `GET /friends/requests`, `DELETE /friends/:friendId` | JWT |
| Health | `GET /health` | Public |

---

## Points: DB vs on-chain

| Field | Where | When |
|-------|-------|------|
| `User.points` | PostgreSQL | Every win (+10) |
| `User.onChainPoints` | PostgreSQL | After on-chain confirm |
| Contract `_playerPoints` | Polygon Amoy | After win + linked wallet |

---

## Frontend checklist

- [ ] Login/register → store JWT
- [ ] Connect MetaMask with exact message above
- [ ] `POST /wallet/connect`
- [ ] `GET /wallet/status` to show linked address
- [ ] Socket matchmaking + moves
- [ ] On win, optionally poll `GET /blockchain/player/:wallet`
- [ ] Swagger: authorize with JWT for protected routes

Contracts repo: https://github.com/matheos123/swafri-blockchain  
Backend Swagger: http://localhost:3001/api/v1/docs
