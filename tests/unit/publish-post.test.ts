import { describe, it, expect, vi } from 'vitest'
import { publishPost, PostNotFoundError } from '../../src/posts/application/publish-post'
import type { PostRepository } from '../../src/posts/domain/post.repository'
import type { PostPlatformRepository } from '../../src/posts/domain/post-platform.repository'
import type { AdapterRegistry } from '../../src/engagement/infrastructure/platform/adapter-registry'

function makePost(id = 'post-1') {
  return { id, content: 'Hello world', createdAt: new Date() }
}

function makeAdapter(platformPostId = 'plat-123', platform: 'stub' | 'twitter' = 'stub') {
  return {
    platform,
    fetchComments: vi.fn(),
    postReply: vi.fn(),
    publishPost: vi.fn().mockResolvedValue({ platformPostId }),
  }
}

function makeDeps(overrides: {
  post?: ReturnType<typeof makePost> | null
  adapters?: AdapterRegistry
  upsertFn?: ReturnType<typeof vi.fn>
}) {
  const postRepo: PostRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(
      'post' in overrides ? overrides.post ?? undefined : makePost(),
    ),
  }
  const postPlatformRepo: PostPlatformRepository = {
    upsert: (overrides.upsertFn ?? vi.fn().mockResolvedValue(undefined)) as PostPlatformRepository['upsert'],
    findByPostAndPlatform: vi.fn(),
  }
  const adapters: AdapterRegistry = overrides.adapters ?? new Map([['stub', makeAdapter()]])
  return { postRepo, postPlatformRepo, adapters }
}

describe('publishPost', () => {
  it('throws PostNotFoundError when post does not exist', async () => {
    const deps = makeDeps({ post: null })
    await expect(publishPost(deps, 'missing', ['stub'])).rejects.toThrow(PostNotFoundError)
  })

  it('returns published result when adapter succeeds', async () => {
    const deps = makeDeps({})
    const results = await publishPost(deps, 'post-1', ['stub'])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ platform: 'stub', status: 'published', platformPostId: 'plat-123' })
  })

  it('returns failed result (without throwing) when adapter throws', async () => {
    const failAdapter = { ...makeAdapter(), publishPost: vi.fn().mockRejectedValue(new Error('rate limited')) }
    const deps = makeDeps({ adapters: new Map([['stub', failAdapter]]) })
    const results = await publishPost(deps, 'post-1', ['stub'])
    expect(results[0]).toMatchObject({ platform: 'stub', status: 'failed' })
    expect(results[0].error).toBeDefined()
  })

  it('handles partial failure — success and failure across platforms', async () => {
    const failAdapter = { ...makeAdapter('x', 'twitter'), publishPost: vi.fn().mockRejectedValue(new Error('API down')) }
    const deps = makeDeps({
      adapters: new Map([['stub', makeAdapter()], ['twitter', failAdapter]]),
    })
    const results = await publishPost(deps, 'post-1', ['stub', 'twitter'])
    expect(results).toHaveLength(2)
    expect(results.find((r) => r.platform === 'stub')?.status).toBe('published')
    expect(results.find((r) => r.platform === 'twitter')?.status).toBe('failed')
  })

  it('calls upsert with failed status when adapter throws', async () => {
    const upsertFn = vi.fn().mockResolvedValue(undefined)
    const failAdapter = { ...makeAdapter(), publishPost: vi.fn().mockRejectedValue(new Error('oops')) }
    const deps = makeDeps({ adapters: new Map([['stub', failAdapter]]), upsertFn })
    await publishPost(deps, 'post-1', ['stub'])
    expect(upsertFn).toHaveBeenCalledWith('post-1', 'stub', expect.objectContaining({ status: 'failed' }))
  })
})
