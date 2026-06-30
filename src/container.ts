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
  if (process.env.TWITTER_BEARER_TOKEN) {
    adapters.set('twitter', buildTwitterAdapter({
      bearerToken: config.twitter.bearerToken,
      baseUrl: config.twitter.baseUrl,
    }))
  }

  return { commentRepo, postRepo, postPlatformRepo, adapters }
}
