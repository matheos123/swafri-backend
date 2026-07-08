# Deploy Backend on Render

This NestJS API is ready for [Render](https://render.com).

## What was configured

| Item | Value |
|------|--------|
| Bind address | `0.0.0.0` (required on Render) |
| Port | `process.env.PORT` (Render sets this) |
| Build | `npm ci --include=dev && npm run build` (`prisma generate` + `nest build`) |
| Start | `prisma migrate deploy && node dist/main.js` |
| Health | `GET /api/v1/health` |
| Blueprint | [`render.yaml`](../render.yaml) |

---

## Option A — Blueprint (recommended)

1. Push this repo to GitHub (`swafri-backend`).
2. Render Dashboard → **New** → **Blueprint**.
3. Select the repo → apply `render.yaml`.
4. Fill secrets when prompted:
   - `PRIVATE_KEY` — backend owner wallet (contract owner)
   - `CORS_ORIGIN` — your frontend URL (e.g. `https://your-app.vercel.app`)
   - `SOCKET_CORS_ORIGIN` — same as frontend URL
5. Deploy.

Render creates:
- Web service `swafri-backend`
- Postgres `swafri-postgres` (wires `DATABASE_URL`)

---

## Option B — Manual Web Service

1. **New** → **Web Service** → connect GitHub repo.
2. Settings:

| Field | Value |
|-------|--------|
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run render:start` |
| Health Check Path | `/api/v1/health` |

3. Add a **PostgreSQL** database and copy its **Internal Database URL** into `DATABASE_URL`.
4. Set environment variables (see below).
5. Deploy.

---

## Environment variables

### Required

| Key | Example / notes |
|-----|-----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Render Postgres Internal URL **or** Neon URL with `?sslmode=require` |
| `JWT_SECRET` | Long random string |
| `JWT_REFRESH_SECRET` | Different long random string |
| `CORS_ORIGIN` | Frontend origin, e.g. `https://app.example.com` |
| `SOCKET_CORS_ORIGIN` | Same as frontend (Socket.IO CORS) |

### Neon database notes

If you use Neon instead of Render Postgres:

1. Copy the connection string from Neon (prefer **pooled** for the app).
2. Ensure it ends with `?sslmode=require` (Neon usually includes this).
3. Do **not** use a URL without SSL — migrate will fail.
4. Example shape:
   `postgresql://user:pass@ep-xxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`

### Recommended (blockchain)

| Key | Value |
|-----|--------|
| `BLOCKCHAIN_RPC_URL` | `https://rpc-amoy.polygon.technology` |
| `CHAIN_ID` | `80002` |
| `GAME_REWARD_ADDRESS` | `0xc6B4Edae0666e59f6475079A58d97483A1fd0d42` |
| `PRIVATE_KEY` | Contract owner private key (has Amoy POL for gas) |

### Optional

| Key | Default |
|-----|---------|
| `API_PREFIX` | `api/v1` |
| `REDIS_HOST` | `localhost` (not required for core demo) |
| `REDIS_PORT` | `6379` |

`PORT` is set automatically by Render — do not hardcode it.

---

## After deploy — verify

Replace `YOUR_SERVICE` with your Render URL:

```text
https://YOUR_SERVICE.onrender.com/api/v1/health
https://YOUR_SERVICE.onrender.com/api/v1/docs
https://YOUR_SERVICE.onrender.com/api/v1/blockchain/health
```

Swagger should open. Blockchain health should be `healthy` if RPC + contract env vars are set.

---

## Frontend notes

1. Point API base URL to `https://YOUR_SERVICE.onrender.com/api/v1`.
2. Point Socket.IO to `https://YOUR_SERVICE.onrender.com`.
3. Set backend `CORS_ORIGIN` and `SOCKET_CORS_ORIGIN` to your frontend origin.
4. Free Render web services **spin down** after idle ~15 minutes — first request can be slow (cold start).

---

## Common failures

| Problem | Fix |
|---------|-----|
| Build fails on `nest` | Use `npm ci --include=dev` so `@nestjs/cli` installs even when `NODE_ENV=production` |
| Start fails on migrate / `Could not parse schema engine response` | Usually Alpine OpenSSL + Prisma — use the Debian Dockerfile (already fixed). For Neon, ensure `DATABASE_URL` has `?sslmode=require` |
| Start fails on migrate | Check `DATABASE_URL` Internal URL from Render Postgres or Neon SSL URL |
| CORS / Socket blocked | Set `CORS_ORIGIN` and `SOCKET_CORS_ORIGIN` to exact frontend URL |
| Blockchain `unavailable` | Set `BLOCKCHAIN_RPC_URL`, `GAME_REWARD_ADDRESS`, `PRIVATE_KEY` |
| 502 on health | App failed to boot — check Render logs |

---

## Local production smoke test

```bash
npm run build
$env:NODE_ENV="production"
$env:PORT="3001"
# set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ...
npm run render:start
```
