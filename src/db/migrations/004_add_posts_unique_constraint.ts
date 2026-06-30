import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE posts ADD CONSTRAINT posts_platform_post_unique UNIQUE (platform, platform_post_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE posts DROP CONSTRAINT posts_platform_post_unique`.execute(db)
}
