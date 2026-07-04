import { z } from 'zod'
import { searchBooks } from '~~/core/application/books'
import { bookCatalogLanguageFromAcceptLanguage, createBookCatalogProvider } from '~~/server/utils/book-catalog-provider'
import { getBookRepository } from '~~/server/utils/book-repository'

const querySchema = z.object({
  q: z.string().default(''),
  limit: z.coerce.number().int().min(1).max(30).default(12)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const query = querySchema.parse(getQuery(event))
  const config = useRuntimeConfig(event)
  const results = await searchBooks({
    query: query.q,
    limit: query.limit,
    provider: createBookCatalogProvider({
      googleBooksApiKey: config.googleBooksApiKey,
      language: bookCatalogLanguageFromAcceptLanguage(getHeader(event, 'accept-language'))
    }),
    repository: getBookRepository(event)
  })

  return { results }
})
