import { createDb } from '../../src/db/database'
import { FileMigrationProvider, Migrator } from 'kysely'
import path from 'path'
import { promises as fs } from 'fs'

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/social-media-integrator-test'

export const testDb = createDb(TEST_DB_URL)

beforeAll(async () => {
  const migrator = new Migrator({
    db: testDb,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, '../../src/db/migrations'),
    }),
  })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
})

beforeEach(async () => {
  await testDb.deleteFrom('comment_syncs').execute()
  await testDb.deleteFrom('comments').execute()
  await testDb.deleteFrom('post_platforms').execute()
  await testDb.deleteFrom('posts').execute()
})

afterAll(async () => {
  await testDb.destroy()
})
