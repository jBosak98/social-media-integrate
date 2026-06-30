import got from 'got'

type TwitterClientConfig = {
  bearerToken: string
  baseUrl: string
}

type TweetData = {
  id: string
  text: string
  author_id: string
  created_at: string
  referenced_tweets?: Array<{ type: string; id: string }> | null
}

type UserData = {
  id: string
  name: string
}

type SearchResponse = {
  data?: TweetData[]
  includes?: { users?: UserData[] }
  meta: { result_count: number }
}

type SingleTweetResponse = {
  data: TweetData
  includes?: { users?: UserData[] }
}

type PostTweetResponse = {
  data: { id: string; text: string }
}

export function buildTwitterClient(config: TwitterClientConfig) {
  const client = got.extend({
    prefixUrl: config.baseUrl,
    headers: { Authorization: `Bearer ${config.bearerToken}` },
    responseType: 'json',
  })

  return {
    async searchConversation(conversationId: string): Promise<SearchResponse> {
      const res = await client.get('2/tweets/search/recent', {
        searchParams: {
          query: `conversation_id:${conversationId}`,
          'tweet.fields': 'author_id,created_at,referenced_tweets',
          expansions: 'author_id',
          'user.fields': 'name',
          max_results: 100,
        },
      })
      return res.body as unknown as SearchResponse
    },

    async getTweet(tweetId: string): Promise<SingleTweetResponse> {
      const res = await client.get(`2/tweets/${tweetId}`, {
        searchParams: {
          'tweet.fields': 'author_id,created_at,referenced_tweets',
          expansions: 'author_id',
          'user.fields': 'name',
        },
      })
      return res.body as unknown as SingleTweetResponse
    },

    async postTweet(text: string, inReplyToTweetId: string): Promise<PostTweetResponse> {
      const res = await client.post('2/tweets', {
        json: { text, reply: { in_reply_to_tweet_id: inReplyToTweetId } },
      })
      return res.body as unknown as PostTweetResponse
    },

    async createTweet(text: string): Promise<PostTweetResponse> {
      const res = await client.post('2/tweets', {
        json: { text },
      })
      return res.body as unknown as PostTweetResponse
    },
  }
}
