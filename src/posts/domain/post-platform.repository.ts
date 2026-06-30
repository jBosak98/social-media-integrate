import type { Platform } from '../../engagement/domain/comment.entity'

type UpsertPublished = { status: 'published'; platformPostId: string }
type UpsertFailed = { status: 'failed'; error: string }

export interface PostPlatformRepository {
  upsert(postId: string, platform: Platform, data: UpsertPublished | UpsertFailed): Promise<void>
  findByPostAndPlatform(
    postId: string,
    platform: Platform,
  ): Promise<{ platformPostId: string } | undefined>
}
