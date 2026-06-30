import { z } from 'zod'

export const PublishPostBodySchema = z.object({
  platforms: z.array(z.string()).min(1),
})
