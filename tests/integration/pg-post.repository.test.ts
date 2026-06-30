import { testDb } from '../helpers/db'
import { PgPostRepository } from '../../src/posts/infrastructure/db/pg-post.repository'

describe('PgPostRepository', () => {
  let repo: PgPostRepository

  beforeEach(() => {
    repo = new PgPostRepository(testDb)
  })

  describe('create', () => {
    it('inserts a post and returns it with generated id and createdAt', async () => {
      const post = await repo.create('Hello world')

      expect(post.id).toBeDefined()
      expect(post.content).toBe('Hello world')
      expect(post.createdAt).toBeInstanceOf(Date)
    })
  })

  describe('findById', () => {
    it('returns the post when it exists', async () => {
      const created = await repo.create('Test post')
      const found = await repo.findById(created.id)

      expect(found).toMatchObject({ id: created.id, content: 'Test post' })
    })

    it('returns undefined when post does not exist', async () => {
      const result = await repo.findById('00000000-0000-0000-0000-000000000000')
      expect(result).toBeUndefined()
    })
  })
})
