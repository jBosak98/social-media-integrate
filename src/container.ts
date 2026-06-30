import type { Kysely } from 'kysely'
import type { Database } from './db/types'
import { PgCommentRepository } from './engagement/infrastructure/db/pg-comment.repository'
import { PgPostRepository } from './posts/infrastructure/db/pg-post.repository'
import { PgPostPlatformRepository } from './posts/infrastructure/db/pg-post-platform.repository'
import { stubAdapter } from './engagement/infrastructure/platform/stub/stub.adapter'
import { buildTwitterAdapter } from './engagement/infrastructure/platform/twitter/twitter.adapter'
import type { AdapterRegistry } from './engagement/infrastructure/platform/adapter-registry'
import { config } from './config'

export type Container = {
  commentRepo: PgCommentRepository
  postRepo: PgPostRepository
  postPlatformRepo: PgPostPlatformRepository
  adapters: AdapterRegistry
}

export function buildContainer(db: Kysely<Database>): Container {
  const commentRepo = new PgCommentRepository(db)
  const postRepo = new PgPostRepository(db)
  const postPlatformRepo = new PgPostPlatformRepository(db)

  const adapters: AdapterRegistry = new Map()
  adapters.set('stub', stubAdapter)
  const twitterVars = ['TWITTER_BEARER_TOKEN', 'TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET']
  if (twitterVars.every((v) => process.env[v])) {
    adapters.set('twitter', buildTwitterAdapter({
      bearerToken: config.twitter.bearerToken,
      apiKey: config.twitter.apiKey,
      apiSecret: config.twitter.apiSecret,
      accessToken: config.twitter.accessToken,
      accessTokenSecret: config.twitter.accessTokenSecret,
      baseUrl: config.twitter.baseUrl,
    }))
  }

  return { commentRepo, postRepo, postPlatformRepo, adapters }
}
