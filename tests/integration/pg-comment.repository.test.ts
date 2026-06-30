import { testDb } from '../helpers/db'
import { PgCommentRepository } from '../../src/engagement/infrastructure/db/pg-comment.repository'

async function insertPost() {
  return testDb
    .insertInto('posts')
    .values({ content: 'Test post content' })
    .returning('id')
    .executeTakeFirstOrThrow()
}

describe('PgCommentRepository', () => {
  let repo: PgCommentRepository

  beforeEach(() => {
    repo = new PgCommentRepository(testDb)
  })

  describe('upsertMany + findByPostId', () => {
    it('inserts top-level comments and returns them', async () => {
      const { id: postId } = await insertPost()

      await repo.upsertMany(postId, 'stub', [
        {
          platformCommentId: 'c1',
          platformParentCommentId: null,
          authorName: 'Alice',
          body: 'Hello',
          publishedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ])

      const comments = await repo.findByPostId(postId)

      expect(comments).toHaveLength(1)
      expect(comments[0]).toMatchObject({
        platformCommentId: 'c1',
        authorName: 'Alice',
        body: 'Hello',
        replies: [],
      })
    })

    it('nests replies under their parent', async () => {
      const { id: postId } = await insertPost()

      await repo.upsertMany(postId, 'stub', [
        {
          platformCommentId: 'c1',
          platformParentCommentId: null,
          authorName: 'Alice',
          body: 'Top-level',
          publishedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          platformCommentId: 'c2',
          platformParentCommentId: 'c1',
          authorName: 'Bob',
          body: 'Reply',
          publishedAt: new Date('2024-01-01T10:01:00Z'),
        },
      ])

      const comments = await repo.findByPostId(postId)

      expect(comments).toHaveLength(1)
      expect(comments[0].replies).toHaveLength(1)
      expect(comments[0].replies[0]).toMatchObject({ platformCommentId: 'c2' })
    })

    it('deduplicates on platform + platform_comment_id', async () => {
      const { id: postId } = await insertPost()

      const raw = {
        platformCommentId: 'c1',
        platformParentCommentId: null,
        authorName: 'Alice',
        body: 'Original',
        publishedAt: new Date('2024-01-01T10:00:00Z'),
      }

      await repo.upsertMany(postId, 'stub', [raw])
      await repo.upsertMany(postId, 'stub', [{ ...raw, body: 'Updated' }])

      const comments = await repo.findByPostId(postId)

      expect(comments).toHaveLength(1)
      expect(comments[0].body).toBe('Updated')
    })
  })

  describe('save', () => {
    it('inserts a single comment and returns it with local id', async () => {
      const { id: postId } = await insertPost()

      const comment = await repo.save(postId, 'stub', {
        platformCommentId: 'reply-1',
        platformParentCommentId: null,
        authorName: 'Carol',
        body: 'My reply',
        publishedAt: new Date('2024-01-01T11:00:00Z'),
      })

      expect(comment.id).toBeDefined()
      expect(comment.body).toBe('My reply')
    })

    it('resolves parent_id from platform parent comment id', async () => {
      const { id: postId } = await insertPost()

      await repo.upsertMany(postId, 'stub', [
        {
          platformCommentId: 'parent-1',
          platformParentCommentId: null,
          authorName: 'Alice',
          body: 'Parent',
          publishedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ])

      const reply = await repo.save(postId, 'stub', {
        platformCommentId: 'child-1',
        platformParentCommentId: 'parent-1',
        authorName: 'Bob',
        body: 'Child',
        publishedAt: new Date('2024-01-01T10:05:00Z'),
      })

      expect(reply.parentId).not.toBeNull()
    })
  })

  describe('getLastSyncedAt + recordSync', () => {
    it('returns null when no sync has been recorded', async () => {
      const { id: postId } = await insertPost()
      const result = await repo.getLastSyncedAt(postId)
      expect(result).toBeNull()
    })

    it('returns the latest sync timestamp after recording', async () => {
      const { id: postId } = await insertPost()

      await repo.recordSync(postId, 'ok')
      const result = await repo.getLastSyncedAt(postId)

      expect(result).toBeInstanceOf(Date)
    })

    it('returns null when only failed syncs exist (only successful syncs count)', async () => {
      const { id: postId } = await insertPost()
      await repo.recordSync(postId, 'failed')
      const result = await repo.getLastSyncedAt(postId)
      expect(result).toBeNull()
    })
  })
})
