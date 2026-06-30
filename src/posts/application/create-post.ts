import type { PostRepository } from '../domain/post.repository'
import type { Post } from '../domain/post.entity'

export async function createPost(
  deps: { postRepo: PostRepository },
  content: string,
): Promise<Post> {
  return deps.postRepo.create(content)
}
