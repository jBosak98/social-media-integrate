import { z } from 'zod'

export const ReplyBodySchema = z.object({
  body: z.string().min(1).max(2000),
})

export type ReplyBody = z.infer<typeof ReplyBodySchema>
