import type { Generated } from 'kysely'

export interface PostsTable {
  id: Generated<string>
  platform: string
  platform_post_id: string
  created_at: Generated<Date>
}

export interface CommentsTable {
  id: Generated<string>
  post_id: string
  platform: string
  platform_comment_id: string
  parent_id: string | null
  author_name: string
  body: string
  published_at: Date
  created_at: Generated<Date>
}

export interface CommentSyncsTable {
  id: Generated<string>
  post_id: string
  synced_at: Generated<Date>
  status: 'ok' | 'failed'
}

export interface Database {
  posts: PostsTable
  comments: CommentsTable
  comment_syncs: CommentSyncsTable
}
