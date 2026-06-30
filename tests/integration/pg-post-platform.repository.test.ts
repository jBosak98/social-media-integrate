import { testDb } from '../helpers/db'
import { PgPostRepository } from '../../src/posts/infrastructure/db/pg-post.repository'
import { PgPostPlatformRepository } from '../../src/posts/infrastructure/db/pg-post-platform.repository'

async function insertPost() {
  const repo = new PgPostRepository(testDb)
  return repo.create('Test post content')
}

describe('PgPostPlatformRepository', () => {
  let repo: PgPostPlatformRepository

  beforeEach(() => {
    repo = new PgPostPlatformRepository(testDb)
  })

  describe('upsert + findByPostAndPlatform', () => {
    it('stores a published result and retrieves platformPostId', async () => {
      const post = await insertPost()

      await repo.upsert(post.id, 'stub', { status: 'published', platformPostId: 'ext-123' })
      const found = await repo.findByPostAndPlatform(post.id, 'stub')

      expect(found).toEqual({ platformPostId: 'ext-123' })
    })

    it('returns undefined for failed status (no platformPostId)', async () => {
      const post = await insertPost()

      await repo.upsert(post.id, 'stub', { status: 'failed', error: 'API error' })
      const found = await repo.findByPostAndPlatform(post.id, 'stub')

      expect(found).toBeUndefined()
    })

    it('returns undefined when no record exists', async () => {
      const post = await insertPost()
      const found = await repo.findByPostAndPlatform(post.id, 'stub')
      expect(found).toBeUndefined()
    })

    it('upserts on (post_id, platform) conflict — updates status to published', async () => {
      const post = await insertPost()

      await repo.upsert(post.id, 'stub', { status: 'failed', error: 'first attempt' })
      await repo.upsert(post.id, 'stub', { status: 'published', platformPostId: 'ext-456' })

      const found = await repo.findByPostAndPlatform(post.id, 'stub')
      expect(found).toEqual({ platformPostId: 'ext-456' })
    })
  })
})
