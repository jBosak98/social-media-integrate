import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('post_platforms')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('post_id', 'uuid', (col) =>
      col.notNull().references('posts.id').onDelete('cascade'))
    .addColumn('platform', 'text', (col) => col.notNull())
    .addColumn('platform_post_id', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('error', 'text')
    .addColumn('published_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .execute()

  await db.schema
    .createIndex('post_platforms_post_id_platform_unique')
    .on('post_platforms')
    .columns(['post_id', 'platform'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('post_platforms').execute()
}
