import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getBookRepository } from '~~/server/utils/book-repository'
import { bookStatusSchema, bookWorkSchema } from '~~/server/utils/book-schema'

const bodySchema = z.object({
  work: bookWorkSchema,
  status: bookStatusSchema.optional(),
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().positive().optional(),
  currentPercent: z.number().min(0).max(100).optional(),
  pagesRead: z.number().int().positive().optional(),
  minutesRead: z.number().int().positive().optional(),
  note: z.string().max(1000).optional(),
  recordedAt: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  const item = await getBookRepository(event).recordReadingProgress({
    userId: user.id,
    work: body.work,
    status: body.status,
    currentPage: body.currentPage,
    totalPages: body.totalPages,
    currentPercent: body.currentPercent,
    pagesRead: body.pagesRead,
    minutesRead: body.minutesRead,
    note: body.note,
    recordedAt: body.recordedAt ?? new Date().toISOString()
  })

  return { item }
})
