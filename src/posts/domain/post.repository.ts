import type { Post } from './post.entity'

export interface PostRepository {
  create(content: string): Promise<Post>
  findById(id: string): Promise<Post | undefined>
}
