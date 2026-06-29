export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/blotato',
  commentSyncTtlMs: parseInt(process.env.COMMENT_SYNC_TTL_MS ?? '300000', 10),
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN ?? '',
    baseUrl: 'https://api.twitter.com',
  },
}
