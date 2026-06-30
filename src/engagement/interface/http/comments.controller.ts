import type { FastifyRequest, FastifyReply } from 'fastify'
import type { CommentRepository } from '../../domain/comment.repository'
import type { PostPlatformRepository } from '../../../posts/domain/post-platform.repository'
import type { AdapterRegistry } from '../../infrastructure/platform/adapter-registry'
import { PlatformNotSupportedError } from '../../infrastructure/platform/adapter-registry'
import { getComments } from '../../application/get-comments'
import { syncComments } from '../../application/sync-comments'
import { replyToComment, CommentNotFoundError, PlatformError } from '../../application/reply-to-comment'
import { ReplyBodySchema } from './dtos/reply.dto'
import type { Platform } from '../../domain/comment.entity'

type Deps = {
  commentRepo: CommentRepository
  postPlatformRepo: PostPlatformRepository
  adapters: AdapterRegistry
  ttlMs: number
}

type PlatformParams = { postId: string; platform: string }

export function buildCommentsController(deps: Deps) {
  async function resolvePostPlatform(postId: string, platform: string) {
    return deps.postPlatformRepo.findByPostAndPlatform(postId, platform as Platform)
  }

  return {
    async listComments(
      req: FastifyRequest<{ Params: PlatformParams }>,
      reply: FastifyReply,
    ) {
      const { postId, platform } = req.params
      const postPlatform = await resolvePostPlatform(postId, platform)
      if (!postPlatform) return reply.status(404).send({ error: 'Post or platform not found' })

      try {
        const result = await getComments(
          { repo: deps.commentRepo, adapters: deps.adapters, ttlMs: deps.ttlMs },
          postId,
          postPlatform.platformPostId,
          platform as Platform,
        )

        reply.header('X-Sync-Status', result.syncStatus)
        if (result.syncedAt) reply.header('X-Synced-At', result.syncedAt.toISOString())

        return reply.status(200).send(result.comments)
      } catch (err) {
        if (err instanceof PlatformNotSupportedError) {
          return reply.status(422).send({ error: err.message })
        }
        throw err
      }
    },

    async createSync(
      req: FastifyRequest<{ Params: PlatformParams }>,
      reply: FastifyReply,
    ) {
      const { postId, platform } = req.params
      const postPlatform = await resolvePostPlatform(postId, platform)
      if (!postPlatform) return reply.status(404).send({ error: 'Post or platform not found' })

      try {
        const result = await syncComments(
          { repo: deps.commentRepo, adapters: deps.adapters },
          postId,
          postPlatform.platformPostId,
          platform as Platform,
        )
        return reply.status(200).send({
          status: result.syncStatus,
          syncedAt: result.syncedAt?.toISOString() ?? null,
        })
      } catch (err) {
        if (err instanceof PlatformNotSupportedError) {
          return reply.status(422).send({ error: err.message })
        }
        throw err
      }
    },

    async createReply(
      req: FastifyRequest<{ Params: PlatformParams & { commentId: string }; Body: unknown }>,
      reply: FastifyReply,
    ) {
      const parsed = ReplyBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() })
      }

      try {
        const comment = await replyToComment(
          { repo: deps.commentRepo, adapters: deps.adapters },
          req.params.postId,
          req.params.commentId,
          parsed.data.body,
        )
        return reply.status(201).send(comment)
      } catch (err) {
        if (err instanceof CommentNotFoundError) {
          return reply.status(404).send({ error: err.message })
        }
        if (err instanceof PlatformNotSupportedError) {
          return reply.status(422).send({ error: err.message })
        }
        if (err instanceof PlatformError) {
          return reply.status(502).send({ error: err.message })
        }
        throw err
      }
    },
  }
}
