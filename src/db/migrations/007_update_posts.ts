import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('posts')
    .addColumn('content', 'text', (col) => col.notNull().defaultTo(sql`''`))
    .execute()

  await db.schema.alterTable('posts').dropColumn('platform').execute()
  await db.schema.alterTable('posts').dropColumn('platform_post_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('posts').dropColumn('content').execute()

  await db.schema
    .alterTable('posts')
    .addColumn('platform', 'text', (col) => col.notNull().defaultTo(sql`''`))
    .execute()

  await db.schema
    .alterTable('posts')
    .addColumn('platform_post_id', 'text', (col) => col.notNull().defaultTo(sql`''`))
    .execute()
}
