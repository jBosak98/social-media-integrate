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
    get bearerToken() {
      return required('TWITTER_BEARER_TOKEN')
    },
    baseUrl: process.env.TWITTER_API_BASE_URL ?? 'https://api.twitter.com',
  },
}
