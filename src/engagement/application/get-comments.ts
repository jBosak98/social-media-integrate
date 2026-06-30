import type { CommentRepository } from '../domain/comment.repository'
import type { AdapterRegistry } from '../infrastructure/platform/adapter-registry'
import { getAdapter, PlatformNotSupportedError } from '../infrastructure/platform/adapter-registry'
import type { Comment, Platform, SyncStatus } from '../domain/comment.entity'

type GetCommentsDeps = {
  repo: CommentRepository
  adapters: AdapterRegistry
  ttlMs: number
}

type GetCommentsResult = {
  comments: Comment[]
  syncStatus: SyncStatus
  syncedAt: Date | null
}

export async function getComments(
  deps: GetCommentsDeps,
  postId: string,
  platformPostId: string,
  platform: Platform,
): Promise<GetCommentsResult> {
  const lastSyncedAt = await deps.repo.getLastSyncedAt(postId)
  const lastAttemptedAt = await deps.repo.getLastAttemptedAt(postId)
  const isStale = lastAttemptedAt === null || Date.now() - lastAttemptedAt.getTime() > deps.ttlMs

  let syncStatus: SyncStatus = lastSyncedAt !== null ? 'ok' : lastAttemptedAt !== null ? 'failed' : 'never'
  let freshSyncedAt = lastSyncedAt

  if (isStale) {
    try {
      const adapter = getAdapter(deps.adapters, platform)
      const rawComments = await adapter.fetchComments(platformPostId)
      await deps.repo.upsertMany(postId, platform, rawComments)
      await deps.repo.recordSync(postId, 'ok')
      freshSyncedAt = new Date()
      syncStatus = 'ok'
    } catch (err) {
      if (err instanceof PlatformNotSupportedError) throw err
      console.error('[sync] platform sync failed for post %s:', postId, err)
      await deps.repo.recordSync(postId, 'failed').catch((dbErr) => {
        console.error('[sync] failed to record sync failure for post %s:', postId, dbErr)
      })
      syncStatus = 'failed'
      // keep freshSyncedAt = lastSyncedAt — don't lie about data freshness on failure
    }
  }

  const comments = await deps.repo.findByPostId(postId)

  return { comments, syncStatus, syncedAt: freshSyncedAt }
}
