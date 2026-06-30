import type { Platform } from './comment.entity'

export interface RawComment {
  platformCommentId: string
  platformParentCommentId: string | null
  authorName: string
  body: string
  publishedAt: Date
}

export interface PlatformAdapter {
  readonly platform: Platform
  fetchComments(platformPostId: string): Promise<RawComment[]>
  postReply(platformCommentId: string, body: string): Promise<RawComment>
  publishPost(content: string): Promise<{ platformPostId: string }>
}
