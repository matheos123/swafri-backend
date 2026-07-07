export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3001', 10),
    prefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    env: process.env.NODE_ENV ?? 'development',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  socket: {
    corsOrigin: process.env.SOCKET_CORS_ORIGIN ?? 'http://localhost:3000',
  },
  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
    privateKey: process.env.PRIVATE_KEY,
    chainId: parseInt(process.env.BLOCKCHAIN_CHAIN_ID ?? '84532', 10),
    contracts: {
      battleArena: process.env.BATTLE_ARENA_ADDRESS,
      achievementNft: process.env.ACHIEVEMENT_NFT_ADDRESS,
      arenaToken: process.env.ARENA_TOKEN_ADDRESS,
      playerProfile: process.env.PLAYER_PROFILE_ADDRESS,
    },
  },
});
