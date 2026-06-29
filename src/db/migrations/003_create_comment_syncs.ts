import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('comment_syncs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('post_id', 'uuid', (col) =>
      col.notNull().references('posts.id').onDelete('cascade'))
    .addColumn('synced_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`))
    .addColumn('status', 'text', (col) => col.notNull())
    .execute()

  await sql`CREATE INDEX ON comment_syncs(post_id, synced_at DESC)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('comment_syncs').execute()
}
