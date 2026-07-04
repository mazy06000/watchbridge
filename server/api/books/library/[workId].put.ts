import { z } from 'zod'
import { requireUser } from '~~/server/utils/auth'
import { getBookRepository } from '~~/server/utils/book-repository'
import { bookStatusSchema, bookWorkSchema } from '~~/server/utils/book-schema'

const bodySchema = z.object({
  work: bookWorkSchema,
  status: bookStatusSchema,
  favorite: z.boolean().optional(),
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().positive().optional(),
  currentPercent: z.number().min(0).max(100).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await requireUser(event)
  const body = bodySchema.parse(await readBody(event))
  const item = await getBookRepository(event).upsertBookLibraryItem({
    userId: user.id,
    work: body.work,
    status: body.status,
    favorite: body.favorite,
    currentPage: body.currentPage,
    totalPages: body.totalPages,
    currentPercent: body.currentPercent,
    startedAt: body.startedAt,
    finishedAt: body.finishedAt
  })

  return { item }
})
