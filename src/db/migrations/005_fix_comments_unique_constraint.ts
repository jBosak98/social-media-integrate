import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE comments DROP CONSTRAINT comments_platform_comment_id_unique`.execute(db)
  await sql`ALTER TABLE comments ADD CONSTRAINT comments_post_platform_comment_unique UNIQUE (post_id, platform, platform_comment_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE comments DROP CONSTRAINT comments_post_platform_comment_unique`.execute(db)
  await sql`ALTER TABLE comments ADD CONSTRAINT comments_platform_comment_id_unique UNIQUE (platform, platform_comment_id)`.execute(db)
}
