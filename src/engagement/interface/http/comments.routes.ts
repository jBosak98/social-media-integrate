import type { FastifyInstance } from 'fastify'
import type { CommentRepository } from '../../domain/comment.repository'
import type { PostPlatformRepository } from '../../../posts/domain/post-platform.repository'
import type { AdapterRegistry } from '../../infrastructure/platform/adapter-registry'
import { buildCommentsController } from './comments.controller'

type RouteDeps = {
  commentRepo: CommentRepository
  postPlatformRepo: PostPlatformRepository
  adapters: AdapterRegistry
  ttlMs: number
}

export async function commentsRoutes(fastify: FastifyInstance, deps: RouteDeps): Promise<void> {
  const ctrl = buildCommentsController(deps)

  fastify.get('/posts/:postId/platforms/:platform/comments', ctrl.listComments)
  fastify.post('/posts/:postId/platforms/:platform/comments/syncs', ctrl.createSync)
  fastify.post('/posts/:postId/platforms/:platform/comments/:commentId/replies', ctrl.createReply)
}
