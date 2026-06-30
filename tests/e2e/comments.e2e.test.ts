import { buildApp } from '../../src/app'
import { buildContainer } from '../../src/container'
import { testDb } from '../helpers/db'

function buildTestApp() {
  const container = buildContainer(testDb)
  return buildApp(container)
}

async function insertPostWithPlatform(platform = 'stub', platformPostId = 'ext-post-1') {
  const post = await testDb
    .insertInto('posts')
    .values({ content: 'Test post content' })
    .returning('id')
    .executeTakeFirstOrThrow()

  await testDb
    .insertInto('post_platforms')
    .values({
      post_id: post.id,
      platform,
      platform_post_id: platformPostId,
      status: 'published',
      published_at: new Date(),
    })
    .execute()

  return post
}

describe('GET /posts/:postId/platforms/:platform/comments', () => {
  it('returns 404 when post/platform not found', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'GET',
      url: '/posts/00000000-0000-0000-0000-000000000000/platforms/stub/comments',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns comments with X-Sync-Status: ok on first fetch (stub adapter syncs)', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    const res = await app.inject({
      method: 'GET',
      url: `/posts/${postId}/platforms/stub/comments`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['x-sync-status']).toBe('ok')
    expect(res.headers['x-synced-at']).toBeDefined()

    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0]).toMatchObject({ authorName: 'Alice Stub', replies: expect.any(Array) })
  })

  it('does not re-sync when cache is fresh (within TTL)', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    await app.inject({ method: 'GET', url: `/posts/${postId}/platforms/stub/comments` })

    const syncsBefore = await testDb
      .selectFrom('comment_syncs')
      .where('post_id', '=', postId)
      .selectAll()
      .execute()

    await app.inject({ method: 'GET', url: `/posts/${postId}/platforms/stub/comments` })

    const syncsAfter = await testDb
      .selectFrom('comment_syncs')
      .where('post_id', '=', postId)
      .selectAll()
      .execute()

    expect(syncsAfter).toHaveLength(syncsBefore.length)
  })
})

describe('POST /posts/:postId/platforms/:platform/comments/syncs', () => {
  it('returns 404 when post/platform not found', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/posts/00000000-0000-0000-0000-000000000000/platforms/stub/comments/syncs',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 and status ok on successful sync', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/platforms/stub/comments/syncs`,
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.syncedAt).toBeDefined()
  })
})

describe('POST /posts/:postId/platforms/:platform/comments/:commentId/replies', () => {
  it('returns 404 when comment does not exist', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/platforms/stub/comments/00000000-0000-0000-0000-000000000001/replies`,
      payload: { body: 'hello' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('creates a reply and returns 201 with the new comment', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/platforms/stub/comments/syncs`,
    })

    const topLevelComment = await testDb
      .selectFrom('comments')
      .where('post_id', '=', postId)
      .where('parent_id', 'is', null)
      .select('id')
      .executeTakeFirstOrThrow()

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/platforms/stub/comments/${topLevelComment.id}/replies`,
      payload: { body: 'My reply!' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.body).toBe('My reply!')
    expect(body.parentId).toBe(topLevelComment.id)
  })

  it('returns 400 on empty body', async () => {
    const { id: postId } = await insertPostWithPlatform()
    const app = buildTestApp()

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/platforms/stub/comments/some-id/replies`,
      payload: { body: '' },
    })

    expect(res.statusCode).toBe(400)
  })
})
