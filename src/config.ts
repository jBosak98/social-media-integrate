function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/social-media-integrator',
  commentSyncTtlMs: parseInt(process.env.COMMENT_SYNC_TTL_MS ?? '300000', 10),
  twitter: {
    get bearerToken() { return required('TWITTER_BEARER_TOKEN') },
    get apiKey() { return required('TWITTER_API_KEY') },
    get apiSecret() { return required('TWITTER_API_SECRET') },
    get accessToken() { return required('TWITTER_ACCESS_TOKEN') },
    get accessTokenSecret() { return required('TWITTER_ACCESS_TOKEN_SECRET') },
    baseUrl: (process.env.TWITTER_API_BASE_URL ?? 'https://api.twitter.com').replace(/\/$/, ''),
  },
}
