import Fastify from 'fastify'
import type { Container } from './container'
import { commentsRoutes } from './engagement/interface/http/comments.routes'
import { postsRoutes } from './posts/interface/http/posts.routes'
import { config } from './config'

export function buildApp(container: Container) {
  const app = Fastify({ logger: true })

  app.register(postsRoutes, {
    postRepo: container.postRepo,
    postPlatformRepo: container.postPlatformRepo,
    adapters: container.adapters,
  })

  app.register(commentsRoutes, {
    commentRepo: container.commentRepo,
    postPlatformRepo: container.postPlatformRepo,
    adapters: container.adapters,
    ttlMs: config.commentSyncTtlMs,
  })

  return app
}
