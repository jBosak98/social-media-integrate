import type { Kysely } from 'kysely'
import type { Database } from '../../../db/types'
import type { PostPlatformRepository } from '../../domain/post-platform.repository'
import type { Platform } from '../../../engagement/domain/comment.entity'

export class PgPostPlatformRepository implements PostPlatformRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async upsert(
    postId: string,
    platform: Platform,
    data: { status: 'published'; platformPostId: string } | { status: 'failed'; error: string },
  ): Promise<void> {
    await this.db
      .insertInto('post_platforms')
      .values({
        post_id: postId,
        platform,
        status: data.status,
        platform_post_id: data.status === 'published' ? data.platformPostId : null,
        error: data.status === 'failed' ? data.error : null,
        published_at: data.status === 'published' ? new Date() : null,
      })
      .onConflict((oc) =>
        oc.columns(['post_id', 'platform']).doUpdateSet((eb) => ({
          status: eb.ref('excluded.status'),
          platform_post_id: eb.ref('excluded.platform_post_id'),
          error: eb.ref('excluded.error'),
          published_at: eb.ref('excluded.published_at'),
        })),
      )
      .execute()
  }

  async findByPostAndPlatform(
    postId: string,
    platform: Platform,
  ): Promise<{ platformPostId: string } | undefined> {
    const row = await this.db
      .selectFrom('post_platforms')
      .where('post_id', '=', postId)
      .where('platform', '=', platform)
      .where('status', '=', 'published')
      .select('platform_post_id')
      .executeTakeFirst()

    if (!row?.platform_post_id) return undefined
    return { platformPostId: row.platform_post_id }
  }
}
