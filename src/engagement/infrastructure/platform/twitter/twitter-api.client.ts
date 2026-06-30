import got from 'got'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'

type TwitterClientConfig = {
  bearerToken: string
  apiKey: string
  apiSecret: string
  accessToken: string
  accessTokenSecret: string
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

type MeResponse = {
  data: { id: string; name: string }
}

function buildOAuth(config: TwitterClientConfig) {
  const oauth = new OAuth({
    consumer: { key: config.apiKey, secret: config.apiSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64')
    },
  })
  return (method: string, url: string) =>
    oauth.toHeader(
      oauth.authorize({ url, method }, { key: config.accessToken, secret: config.accessTokenSecret }),
    ).Authorization
}

export function buildTwitterClient(config: TwitterClientConfig) {
  const readClient = got.extend({
    prefixUrl: config.baseUrl,
    headers: { Authorization: `Bearer ${config.bearerToken}` },
    responseType: 'json',
    timeout: { request: 10_000 },
  })

  const getOAuthHeader = buildOAuth(config)
  const tweetsUrl = `${config.baseUrl}/2/tweets`

  async function postToTwitter(body: Record<string, unknown>): Promise<PostTweetResponse> {
    const res = await got.post(tweetsUrl, {
      headers: { Authorization: getOAuthHeader('POST', tweetsUrl) },
      json: body,
      responseType: 'json',
      throwHttpErrors: false,
      timeout: { request: 10_000 },
    })
    if (res.statusCode !== 201) {
      throw new Error(`Twitter API error ${res.statusCode}: ${JSON.stringify(res.body)}`)
    }
    return res.body as unknown as PostTweetResponse
  }

  return {
    async searchConversation(conversationId: string): Promise<SearchResponse> {
      const res = await readClient.get('2/tweets/search/recent', {
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
      const res = await readClient.get(`2/tweets/${tweetId}`, {
        searchParams: {
          'tweet.fields': 'author_id,created_at,referenced_tweets',
          expansions: 'author_id',
          'user.fields': 'name',
        },
      })
      return res.body as unknown as SingleTweetResponse
    },

    async postTweet(text: string, inReplyToTweetId: string): Promise<PostTweetResponse> {
      return postToTwitter({ text, reply: { in_reply_to_tweet_id: inReplyToTweetId } })
    },

    async createTweet(text: string): Promise<PostTweetResponse> {
      return postToTwitter({ text })
    },

    async getMe(): Promise<MeResponse> {
      const url = `${config.baseUrl}/2/users/me`
      const res = await got.get(url, {
        headers: { Authorization: getOAuthHeader('GET', url) },
        responseType: 'json',
        throwHttpErrors: false,
        timeout: { request: 10_000 },
      })
      if (res.statusCode !== 200) {
        throw new Error(`Twitter API error ${res.statusCode}: ${JSON.stringify(res.body)}`)
      }
      return res.body as unknown as MeResponse
    },
  }
}
