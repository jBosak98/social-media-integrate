import type { PlatformAdapter, RawComment } from '../../../domain/platform-adapter.port'
import { buildTwitterClient } from './twitter-api.client'

type TwitterAdapterConfig = {
  bearerToken: string
  baseUrl: string
}

export function buildTwitterAdapter(config: TwitterAdapterConfig): PlatformAdapter {
  const client = buildTwitterClient(config)

  return {
    platform: 'twitter',

    async fetchComments(platformPostId: string): Promise<RawComment[]> {
      const res = await client.searchConversation(platformPostId)
      if (!res.data || res.meta.result_count === 0) return []

      const userMap = new Map(
        (res.includes?.users ?? []).map((u) => [u.id, u.name]),
      )

      return res.data.map((tweet) => {
        const parentRef = tweet.referenced_tweets?.find((r) => r.type === 'replied_to')
        return {
          platformCommentId: tweet.id,
          platformParentCommentId: parentRef?.id ?? null,
          authorName: userMap.get(tweet.author_id) ?? tweet.author_id,
          body: tweet.text,
          publishedAt: new Date(tweet.created_at),
        }
      })
    },

    async postReply(platformCommentId: string, body: string): Promise<RawComment> {
      const posted = await client.postTweet(body, platformCommentId)
      return {
        platformCommentId: posted.data.id,
        platformParentCommentId: platformCommentId,
        authorName: 'me',
        body: posted.data.text,
        publishedAt: new Date(),
      }
    },

    async publishPost(content: string): Promise<{ platformPostId: string }> {
      const posted = await client.createTweet(content)
      return { platformPostId: posted.data.id }
    },
  }
}
