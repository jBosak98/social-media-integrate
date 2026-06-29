import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comments')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('post_id', 'uuid', (col) =>
      col.notNull().references('posts.id').onDelete('cascade'))
    .addColumn('platform', 'text', (col) => col.notNull())
    .addColumn('platform_comment_id', 'text', (col) => col.notNull())
    .addColumn('parent_id', 'uuid', (col) =>
      col.references('comments.id').onDelete('cascade'))
    .addColumn('author_name', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('comments_platform_comment_id_unique', [
      'platform',
      'platform_comment_id',
    ])
    .execute()

  await sql`CREATE INDEX ON comments(post_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comments').execute()
}
