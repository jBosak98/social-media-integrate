import type { CommentRepository } from '../domain/comment.repository'
import type { AdapterRegistry } from '../infrastructure/platform/adapter-registry'
import { getAdapter, PlatformNotSupportedError } from '../infrastructure/platform/adapter-registry'
import type { Platform, SyncStatus } from '../domain/comment.entity'

type SyncCommentsDeps = {
  repo: CommentRepository
  adapters: AdapterRegistry
}

type SyncCommentsResult = {
  syncStatus: SyncStatus
  syncedAt: Date | null
}

export async function syncComments(
  deps: SyncCommentsDeps,
  postId: string,
  platformPostId: string,
  platform: Platform,
): Promise<SyncCommentsResult> {
  try {
    const adapter = getAdapter(deps.adapters, platform)
    const rawComments = await adapter.fetchComments(platformPostId)
    await deps.repo.upsertMany(postId, platform, rawComments)
    await deps.repo.recordSync(postId, 'ok')
    return { syncStatus: 'ok', syncedAt: new Date() }
  } catch (err) {
    if (err instanceof PlatformNotSupportedError) throw err
    console.error('[sync] platform sync failed for post %s:', postId, err)
    await deps.repo.recordSync(postId, 'failed').catch((dbErr) => {
      console.error('[sync] failed to record sync failure for post %s:', postId, dbErr)
    })
    return { syncStatus: 'failed', syncedAt: null }
  }
}
