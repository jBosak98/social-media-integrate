import type { Kysely, Selectable } from 'kysely'
import type { Database, PostsTable } from '../../../db/types'
import type { PostRepository } from '../../domain/post.repository'
import type { Post } from '../../domain/post.entity'

export class PgPostRepository implements PostRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(content: string): Promise<Post> {
    const row = await this.db
      .insertInto('posts')
      .values({ content })
      .returningAll()
      .executeTakeFirstOrThrow()

    return toPost(row)
  }

  async findById(id: string): Promise<Post | undefined> {
    const row = await this.db
      .selectFrom('posts')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return row ? toPost(row) : undefined
  }
}

function toPost(row: Selectable<PostsTable>): Post {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
  }
}
