# Web3 Battle Arena - Backend

Real-time multiplayer Rock Paper Scissors arena with blockchain-based identity and rewards.

## Tech Stack

- **Framework:** NestJS 11
- **Database:** PostgreSQL 16 (via Prisma ORM)
- **Cache/Queue:** Redis 7 + BullMQ
- **Real-time:** Socket.IO 4
- **Blockchain:** Ethers.js 6 (Polygon Amoy)
- **Auth:** JWT (access + refresh tokens)
- **API Docs:** Swagger/OpenAPI

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

## Quick Start

### 1. Clone and Install

```bash
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure (Docker)

```bash
# Start PostgreSQL and Redis
npm run docker:dev
```

### 4. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (optional)
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

The API will be available at:
- REST API: http://localhost:3001/api/v1
- WebSocket (Socket.IO): http://localhost:3001
- Swagger UI: http://localhost:3001/api/v1/docs
- Full written API docs: [`docs/API.md`](docs/API.md)
- Health Check: http://localhost:3001/health

## API Documentation

| Resource | Location |
|----------|----------|
| **Swagger / OpenAPI (interactive)** | http://localhost:3001/api/v1/docs |
| **OpenAPI JSON** | http://localhost:3001/api/v1/docs-json |
| **Full written docs (FE handoff)** | [`docs/API.md`](docs/API.md) |

`docs/API.md` covers Auth, Wallet connect, Blockchain reads, Socket.IO match play, and E2E flow for the frontend team.

## Deploy on Render

See **[`docs/RENDER.md`](docs/RENDER.md)** and [`render.yaml`](render.yaml).

Quick settings:

| Field | Value |
|-------|--------|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run render:start` |
| Health Check | `/health` |

## Docker Deployment

### Development

```bash
# Start all services (DB + Redis + App)
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
npm run docker:dev:down
```

### Production

```bash
# Build and start production containers
npm run docker:build
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all
docker-compose down
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start production server |
| `npm run start:dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run lint` | Lint code with ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:seed` | Seed database with test data |

## Project Structure

```
src/
├── achievement/         # Achievement badge logic
├── auth/               # JWT authentication
│   ├── dto/           # Data transfer objects
│   ├── guards/        # Auth guards
│   ├── strategies/    # Passport strategies
│   └── repository/    # Data access layer
├── blockchain/         # Smart contract integration
├── chat/              # In-game chat
├── common/            # Shared utilities
│   ├── config/       # Configuration files
│   └── logger/       # Custom logger
├── friends/           # Friend system
├── game/             # Core RPS game logic
├── health/           # Health check endpoints
├── leaderboard/      # Rankings & stats
├── matchmaking/      # Queue & pairing logic
├── notifications/    # Real-time notifications
├── prisma/          # Database client
├── replay/          # Match replay system
├── socket/          # Socket.IO gateway
├── users/           # User management
└── wallet/          # Wallet connection & verification

prisma/
├── schema.prisma    # Database schema
├── migrations/      # Migration history
└── seed.ts         # Database seeder

```

## Environment Variables

See `.env.example` for all required environment variables.

### Critical Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/web3_arena
JWT_SECRET=your-secret-here
BLOCKCHAIN_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
GAME_REWARD_ADDRESS=0xc6B4Edae0666e59f6475079A58d97483A1fd0d42
PRIVATE_KEY=
REDIS_HOST=localhost
```

## Database Schema

Key models:
- `User` - Player profiles with stats
- `Match` - Game records with on-chain hashes
- `MatchMove` - Round-by-round move history
- `Achievement` - Badge definitions
- `UserAchievement` - Player badge inventory
- `Friendship` - Friend connections
- `ChatMessage` - In-game chat logs

## WebSocket Events

### Client → Server
- `matchmaking:join` - Join matchmaking queue
- `game:move` - Submit game move
- `chat:message` - Send chat message

### Server → Client
- `matchmaking:matched` - Match found
- `game:state` - Game state update
- `game:result` - Round/match result
- `notification:live` - Real-time notification

See `WEB3_STRATEGY.md` for the complete event contract.

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Code Quality

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npx tsc --noEmit
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3001
npx kill-port 3001
```

### Prisma Client Out of Sync
```bash
npm run prisma:generate
```

### Docker Issues
```bash
# Clean everything and restart
docker-compose down -v
npm run docker:dev
```

## License

MIT
