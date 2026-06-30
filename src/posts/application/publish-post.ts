import type { PostRepository } from '../domain/post.repository'
import type { PostPlatformRepository } from '../domain/post-platform.repository'
import type { AdapterRegistry } from '../../engagement/infrastructure/platform/adapter-registry'
import { getAdapter } from '../../engagement/infrastructure/platform/adapter-registry'
import type { Platform } from '../../engagement/domain/comment.entity'

export class PostNotFoundError extends Error {
  constructor(postId: string) {
    super(`Post not found: ${postId}`)
    this.name = 'PostNotFoundError'
  }
}

type PublishResult = {
  platform: Platform
  status: 'published' | 'failed'
  platformPostId?: string
  error?: string
}

type PublishPostDeps = {
  postRepo: PostRepository
  postPlatformRepo: PostPlatformRepository
  adapters: AdapterRegistry
}

export async function publishPost(
  deps: PublishPostDeps,
  postId: string,
  platforms: Platform[],
): Promise<PublishResult[]> {
  const post = await deps.postRepo.findById(postId)
  if (!post) throw new PostNotFoundError(postId)

  const settled = await Promise.allSettled(
    platforms.map(async (platform): Promise<PublishResult> => {
      const adapter = getAdapter(deps.adapters, platform)
      const { platformPostId } = await adapter.publishPost(post.content)
      await deps.postPlatformRepo.upsert(postId, platform, { status: 'published', platformPostId })
      return { platform, status: 'published', platformPostId }
    }),
  )

  return Promise.all(
    settled.map(async (result, i): Promise<PublishResult> => {
      if (result.status === 'fulfilled') return result.value
      const err = result.reason
      const errMsg = err instanceof Error ? err.message : String(err)
      await deps.postPlatformRepo
        .upsert(postId, platforms[i], { status: 'failed', error: errMsg })
        .catch((dbErr) => {
          console.error('[publish] failed to record publish failure for post %s platform %s:', postId, platforms[i], dbErr)
        })
      return { platform: platforms[i], status: 'failed', error: errMsg }
    }),
  )
}
