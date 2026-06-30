import nock from 'nock'
import { buildTwitterAdapter } from '../../src/engagement/infrastructure/platform/twitter/twitter.adapter'

const BEARER = 'test-bearer-token'
const BASE_URL = 'https://api.twitter.com'

describe('TwitterAdapter', () => {
  afterEach(() => nock.cleanAll())

  describe('fetchComments', () => {
    it('returns normalized RawComment list from Twitter search response', async () => {
      nock(BASE_URL)
        .get('/2/tweets/search/recent')
        .query((q) => (q.query as string)?.includes('conversation_id:tweet-123'))
        .reply(200, {
          data: [
            {
              id: 'tweet-456',
              text: 'Hello from Twitter',
              author_id: 'user-1',
              created_at: '2024-01-01T10:00:00Z',
              referenced_tweets: null,
            },
          ],
          includes: {
            users: [{ id: 'user-1', name: 'Alice Twitter' }],
          },
          meta: { newest_id: 'tweet-456', oldest_id: 'tweet-456', result_count: 1 },
        })

      const adapter = buildTwitterAdapter({ bearerToken: BEARER, apiKey: 'key', apiSecret: 'secret', accessToken: 'token', accessTokenSecret: 'token_secret', baseUrl: BASE_URL })
      const comments = await adapter.fetchComments('tweet-123')

      expect(comments).toHaveLength(1)
      expect(comments[0]).toMatchObject({
        platformCommentId: 'tweet-456',
        platformParentCommentId: null,
        authorName: 'Alice Twitter',
        body: 'Hello from Twitter',
      })
      expect(comments[0].publishedAt).toBeInstanceOf(Date)
    })

    it('maps referenced_tweets[replied_to] to platformParentCommentId', async () => {
      nock(BASE_URL)
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(200, {
          data: [
            {
              id: 'tweet-789',
              text: 'A reply',
              author_id: 'user-2',
              created_at: '2024-01-01T10:05:00Z',
              referenced_tweets: [{ type: 'replied_to', id: 'tweet-456' }],
            },
          ],
          includes: {
            users: [{ id: 'user-2', name: 'Bob Twitter' }],
          },
          meta: { result_count: 1 },
        })

      const adapter = buildTwitterAdapter({ bearerToken: BEARER, apiKey: 'key', apiSecret: 'secret', accessToken: 'token', accessTokenSecret: 'token_secret', baseUrl: BASE_URL })
      const comments = await adapter.fetchComments('tweet-123')

      expect(comments[0].platformParentCommentId).toBe('tweet-456')
    })

    it('returns empty array when Twitter returns no data', async () => {
      nock(BASE_URL)
        .get('/2/tweets/search/recent')
        .query(true)
        .reply(200, { meta: { result_count: 0 } })

      const adapter = buildTwitterAdapter({ bearerToken: BEARER, apiKey: 'key', apiSecret: 'secret', accessToken: 'token', accessTokenSecret: 'token_secret', baseUrl: BASE_URL })
      const comments = await adapter.fetchComments('tweet-123')

      expect(comments).toHaveLength(0)
    })
  })

  describe('postReply', () => {
    it('posts a reply and returns a normalized RawComment', async () => {
      nock(BASE_URL)
        .post('/2/tweets', (body) => body.reply?.in_reply_to_tweet_id === 'tweet-456')
        .matchHeader('Authorization', /OAuth oauth_consumer_key/)
        .reply(201, {
          data: {
            id: 'tweet-999',
            text: 'My reply',
          },
        })

      nock(BASE_URL)
        .get('/2/users/me')
        .reply(200, { data: { id: 'me-1', name: 'Me' } })

      const adapter = buildTwitterAdapter({ bearerToken: BEARER, apiKey: 'key', apiSecret: 'secret', accessToken: 'token', accessTokenSecret: 'token_secret', baseUrl: BASE_URL })
      const reply = await adapter.postReply('tweet-456', 'My reply')

      expect(reply).toMatchObject({
        platformCommentId: 'tweet-999',
        platformParentCommentId: 'tweet-456',
        body: 'My reply',
      })
    })
  })

  describe('publishPost', () => {
    it('creates a tweet and returns platformPostId', async () => {
      nock(BASE_URL)
        .post('/2/tweets', (body) => body.text === 'Hello Twitter' && !body.reply)
        .matchHeader('Authorization', /OAuth oauth_consumer_key/)
        .reply(201, {
          data: { id: 'tweet-new-1', text: 'Hello Twitter' },
        })

      const adapter = buildTwitterAdapter({ bearerToken: BEARER, apiKey: 'key', apiSecret: 'secret', accessToken: 'token', accessTokenSecret: 'token_secret', baseUrl: BASE_URL })
      const result = await adapter.publishPost('Hello Twitter')

      expect(result.platformPostId).toBe('tweet-new-1')
    })
  })
})
