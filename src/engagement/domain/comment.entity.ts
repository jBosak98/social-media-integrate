export type Platform = 'twitter' | 'stub'

export type SyncStatus = 'ok' | 'failed' | 'never'

export interface Comment {
  id: string
  postId: string
  platform: Platform
  platformCommentId: string
  parentId: string | null
  authorName: string
  body: string
  publishedAt: Date
  replies: Comment[]
}
