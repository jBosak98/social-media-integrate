import type { Kysely, Selectable } from 'kysely'
import type { Database, CommentsTable } from '../../../db/types'
import type { CommentRepository } from '../../domain/comment.repository'
import type { Comment, Platform, SyncStatus } from '../../domain/comment.entity'
import type { RawComment } from '../../domain/platform-adapter.port'

export class PgCommentRepository implements CommentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findByPostId(postId: string): Promise<Comment[]> {
    const rows = await this.db
      .selectFrom('comments')
      .where('post_id', '=', postId)
      .orderBy('published_at', 'asc')
      .selectAll()
      .execute()

    const byId = new Map(rows.map((r) => [r.id, toComment(r)]))
    const topLevel: Comment[] = []

    for (const row of rows) {
      const comment = byId.get(row.id)!
      if (row.parent_id === null) {
        topLevel.push(comment)
      } else {
        byId.get(row.parent_id)?.replies.push(comment)
      }
    }

    return topLevel
  }

  async findById(commentId: string): Promise<Comment | undefined> {
    const row = await this.db
      .selectFrom('comments')
      .where('id', '=', commentId)
      .selectAll()
      .executeTakeFirst()

    return row ? { ...toComment(row), replies: [] } : undefined
  }

  async upsertMany(postId: string, platform: Platform, raws: RawComment[]): Promise<void> {
    if (raws.length === 0) return

    const existing = await this.db
      .selectFrom('comments')
      .where('post_id', '=', postId)
      .where('platform', '=', platform)
      .select(['id', 'platform_comment_id'])
      .execute()

    const platformIdToLocalId = new Map(existing.map((r) => [r.platform_comment_id, r.id]))

    const topLevel = raws.filter((c) => c.platformParentCommentId === null)
    const replies = raws.filter((c) => c.platformParentCommentId !== null)

    if (topLevel.length > 0) {
      const inserted = await this.db
        .insertInto('comments')
        .values(
          topLevel.map((c) => ({
            post_id: postId,
            platform,
            platform_comment_id: c.platformCommentId,
            parent_id: null,
            author_name: c.authorName,
            body: c.body,
            published_at: c.publishedAt,
          })),
        )
        .onConflict((oc) =>
          oc.columns(['post_id', 'platform', 'platform_comment_id']).doUpdateSet((eb) => ({
            author_name: eb.ref('excluded.author_name'),
            body: eb.ref('excluded.body'),
          })),
        )
        .returning(['id', 'platform_comment_id'])
        .execute()

      inserted.forEach((r) => platformIdToLocalId.set(r.platform_comment_id, r.id))
    }

    if (replies.length > 0) {
      await this.db
        .insertInto('comments')
        .values(
          replies.map((c) => ({
            post_id: postId,
            platform,
            platform_comment_id: c.platformCommentId,
            parent_id: platformIdToLocalId.get(c.platformParentCommentId!) ?? null,
            author_name: c.authorName,
            body: c.body,
            published_at: c.publishedAt,
          })),
        )
        .onConflict((oc) =>
          oc.columns(['post_id', 'platform', 'platform_comment_id']).doUpdateSet((eb) => ({
            author_name: eb.ref('excluded.author_name'),
            body: eb.ref('excluded.body'),
          })),
        )
        .execute()
    }
  }

  async save(postId: string, platform: Platform, raw: RawComment): Promise<Comment> {
    let parentId: string | null = null

    if (raw.platformParentCommentId !== null) {
      const parent = await this.db
        .selectFrom('comments')
        .where('post_id', '=', postId)
        .where('platform', '=', platform)
        .where('platform_comment_id', '=', raw.platformParentCommentId)
        .select('id')
        .executeTakeFirst()

      parentId = parent?.id ?? null
    }

    const row = await this.db
      .insertInto('comments')
      .values({
        post_id: postId,
        platform,
        platform_comment_id: raw.platformCommentId,
        parent_id: parentId,
        author_name: raw.authorName,
        body: raw.body,
        published_at: raw.publishedAt,
      })
      .onConflict((oc) =>
        oc.columns(['post_id', 'platform', 'platform_comment_id']).doUpdateSet((eb) => ({
          body: eb.ref('excluded.body'),
          parent_id: eb.ref('excluded.parent_id'),
        })),
      )
      .returningAll()
      .executeTakeFirstOrThrow()

    return { ...toComment(row), replies: [] }
  }

  async getLastSyncedAt(postId: string): Promise<Date | null> {
    const row = await this.db
      .selectFrom('comment_syncs')
      .where('post_id', '=', postId)
      .where('status', '=', 'ok')
      .orderBy('synced_at', 'desc')
      .select('synced_at')
      .executeTakeFirst()

    return row?.synced_at ?? null
  }

  async getLastAttemptedAt(postId: string): Promise<Date | null> {
    const row = await this.db
      .selectFrom('comment_syncs')
      .where('post_id', '=', postId)
      .orderBy('synced_at', 'desc')
      .select('synced_at')
      .executeTakeFirst()

    return row?.synced_at ?? null
  }

  async recordSync(postId: string, status: Exclude<SyncStatus, 'never'>): Promise<void> {
    await this.db
      .insertInto('comment_syncs')
      .values({ post_id: postId, status })
      .execute()
  }
}

function toComment(row: Selectable<CommentsTable>): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    platform: row.platform as Platform,
    platformCommentId: row.platform_comment_id,
    parentId: row.parent_id,
    authorName: row.author_name,
    body: row.body,
    publishedAt: row.published_at,
    replies: [],
  }
}
