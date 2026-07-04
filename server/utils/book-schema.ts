import { z } from 'zod'

export const bookWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  authors: z.array(z.object({
    id: z.string(),
    name: z.string().min(1)
  })).default([]),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  firstPublishYear: z.number().int().optional(),
  subjects: z.array(z.string()).default([]),
  sourcePayload: z.unknown().optional(),
  fetchedAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const bookStatusSchema = z.enum(['want_to_read', 'reading', 'read', 'paused', 'dnf'])
