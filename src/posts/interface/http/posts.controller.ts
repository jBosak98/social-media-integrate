import type { FastifyRequest, FastifyReply } from 'fastify'
import type { PostRepository } from '../../domain/post.repository'
import type { PostPlatformRepository } from '../../domain/post-platform.repository'
import type { AdapterRegistry } from '../../../engagement/infrastructure/platform/adapter-registry'
import { createPost } from '../../application/create-post'
import { publishPost, PostNotFoundError } from '../../application/publish-post'
import { CreatePostBodySchema } from './dtos/create-post.dto'
import { PublishPostBodySchema } from './dtos/publish-post.dto'
import type { Platform } from '../../../engagement/domain/comment.entity'

type Deps = {
  postRepo: PostRepository
  postPlatformRepo: PostPlatformRepository
  adapters: AdapterRegistry
}

export function buildPostsController(deps: Deps) {
  return {
    async createPost(req: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) {
      const parsed = CreatePostBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() })
      }
      const post = await createPost({ postRepo: deps.postRepo }, parsed.data.content)
      return reply.status(201).send(post)
    },

    async publishPost(
      req: FastifyRequest<{ Params: { postId: string }; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const parsed = PublishPostBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() })
      }

      try {
        const results = await publishPost(
          { postRepo: deps.postRepo, postPlatformRepo: deps.postPlatformRepo, adapters: deps.adapters },
          req.params.postId,
          parsed.data.platforms as Platform[],
        )

        const allFailed = results.every((r) => r.status === 'failed')
        return reply.status(allFailed ? 502 : 200).send({ results })
      } catch (err) {
        if (err instanceof PostNotFoundError) {
          return reply.status(404).send({ error: err.message })
        }
        throw err
      }
    },
  }
}
