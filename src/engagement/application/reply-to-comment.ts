import type { CommentRepository } from '../domain/comment.repository'
import type { AdapterRegistry } from '../infrastructure/platform/adapter-registry'
import { getAdapter } from '../infrastructure/platform/adapter-registry'
import type { Comment } from '../domain/comment.entity'

type ReplyDeps = {
  repo: CommentRepository
  adapters: AdapterRegistry
}

export class CommentNotFoundError extends Error {
  constructor(commentId: string) {
    super(`Comment not found: ${commentId}`)
    this.name = 'CommentNotFoundError'
  }
}

export class PlatformError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'PlatformError'
  }
}

export async function replyToComment(
  deps: ReplyDeps,
  postId: string,
  commentId: string,
  body: string,
): Promise<Comment> {
  const comment = await deps.repo.findById(commentId)
  if (!comment || comment.postId !== postId) throw new CommentNotFoundError(commentId)

  const adapter = getAdapter(deps.adapters, comment.platform)

  let rawReply
  try {
    rawReply = await adapter.postReply(comment.platformCommentId, body)
  } catch (err) {
    throw new PlatformError(`Failed to post reply on ${comment.platform}`, err)
  }

  return deps.repo.save(comment.postId, comment.platform, rawReply)
}
