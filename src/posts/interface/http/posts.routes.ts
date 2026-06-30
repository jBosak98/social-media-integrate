import type { FastifyInstance } from 'fastify'
import type { PostRepository } from '../../domain/post.repository'
import type { PostPlatformRepository } from '../../domain/post-platform.repository'
import type { AdapterRegistry } from '../../../engagement/infrastructure/platform/adapter-registry'
import { buildPostsController } from './posts.controller'

type RouteDeps = {
  postRepo: PostRepository
  postPlatformRepo: PostPlatformRepository
  adapters: AdapterRegistry
}

export async function postsRoutes(fastify: FastifyInstance, deps: RouteDeps): Promise<void> {
  const ctrl = buildPostsController(deps)
  fastify.post('/posts', ctrl.createPost)
  fastify.post('/posts/:postId/publish', ctrl.publishPost)
}
