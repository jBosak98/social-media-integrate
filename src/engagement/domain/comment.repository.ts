import type { Comment, Platform, SyncStatus } from './comment.entity'
import type { RawComment } from './platform-adapter.port'

export interface CommentRepository {
  findByPostId(postId: string): Promise<Comment[]>
  findById(commentId: string): Promise<Comment | undefined>
  upsertMany(postId: string, platform: Platform, comments: RawComment[]): Promise<void>
  save(postId: string, platform: Platform, raw: RawComment): Promise<Comment>
  getLastSyncedAt(postId: string): Promise<Date | null>
  getLastAttemptedAt(postId: string): Promise<Date | null>
  recordSync(postId: string, status: Exclude<SyncStatus, 'never'>): Promise<void>
}
