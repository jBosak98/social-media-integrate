import { z } from 'zod'

export const CreatePostBodySchema = z.object({
  content: z.string().min(1).max(10000),
})
