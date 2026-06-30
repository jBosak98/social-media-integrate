import type { PlatformAdapter, RawComment } from '../../../domain/platform-adapter.port'

const FIXTURE_COMMENTS: RawComment[] = [
  {
    platformCommentId: 'stub-c1',
    platformParentCommentId: null,
    authorName: 'Alice Stub',
    body: 'Great post!',
    publishedAt: new Date('2024-01-01T10:00:00Z'),
  },
  {
    platformCommentId: 'stub-c2',
    platformParentCommentId: 'stub-c1',
    authorName: 'Bob Stub',
    body: 'Totally agree.',
    publishedAt: new Date('2024-01-01T10:05:00Z'),
  },
]

export const stubAdapter: PlatformAdapter = {
  platform: 'stub',

  async fetchComments(_platformPostId: string): Promise<RawComment[]> {
    return FIXTURE_COMMENTS
  },

  async postReply(platformCommentId: string, body: string): Promise<RawComment> {
    return {
      platformCommentId: `stub-reply-${Date.now()}`,
      platformParentCommentId: platformCommentId,
      authorName: 'You',
      body,
      publishedAt: new Date(),
    }
  },

  async publishPost(_content: string): Promise<{ platformPostId: string }> {
    return { platformPostId: `stub-post-${Date.now()}` }
  },
}
