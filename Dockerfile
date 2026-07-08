# Production Docker image for Render / container hosts
# Use Debian (not Alpine) so Prisma engines + OpenSSL work with Neon/Postgres SSL
FROM node:20-bookworm-slim AS builder

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY nest-cli.json tsconfig.json tsconfig.build.json ./

RUN npm ci && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build \
  && npm prune --omit=dev

# Production stage
FROM node:20-bookworm-slim AS production

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
