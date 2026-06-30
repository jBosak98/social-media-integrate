import { buildApp } from '../../src/app'
import { buildContainer } from '../../src/container'
import { testDb } from '../helpers/db'

function buildTestApp() {
  const container = buildContainer(testDb)
  return buildApp(container)
}

describe('POST /posts', () => {
  it('creates a post and returns 201 with id and content', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'Hello world' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.id).toBeDefined()
    expect(body.content).toBe('Hello world')
    expect(body.createdAt).toBeDefined()
  })

  it('returns 400 when content is missing', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when content is empty string', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: '' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /posts/:id/publish', () => {
  it('returns 404 when post does not exist', async () => {
    const app = buildTestApp()
    const res = await app.inject({
      method: 'POST',
      url: '/posts/00000000-0000-0000-0000-000000000000/publish',
      payload: { platforms: ['stub'] },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when platforms array is missing', async () => {
    const app = buildTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'Hello' },
    })
    const { id } = JSON.parse(createRes.body)

    const res = await app.inject({
      method: 'POST',
      url: `/posts/${id}/publish`,
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('publishes to stub platform and returns results with platformPostId', async () => {
    const app = buildTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'Hello from the API' },
    })
    const { id } = JSON.parse(createRes.body)

    const publishRes = await app.inject({
      method: 'POST',
      url: `/posts/${id}/publish`,
      payload: { platforms: ['stub'] },
    })

    expect(publishRes.statusCode).toBe(200)
    const body = JSON.parse(publishRes.body)
    expect(body.results).toHaveLength(1)
    expect(body.results[0]).toMatchObject({ platform: 'stub', status: 'published' })
    expect(body.results[0].platformPostId).toBeDefined()
  })

  it('full flow: create → publish → fetch comments', async () => {
    const app = buildTestApp()

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'My first post' },
    })
    const { id } = JSON.parse(createRes.body)

    await app.inject({
      method: 'POST',
      url: `/posts/${id}/publish`,
      payload: { platforms: ['stub'] },
    })

    const commentsRes = await app.inject({
      method: 'GET',
      url: `/posts/${id}/platforms/stub/comments`,
    })

    expect(commentsRes.statusCode).toBe(200)
    const comments = JSON.parse(commentsRes.body)
    expect(Array.isArray(comments)).toBe(true)
    expect(comments.length).toBeGreaterThan(0)
  })
})
