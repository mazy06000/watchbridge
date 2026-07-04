import { z } from 'zod'
import { getRelatedBooks } from '~~/core/application/books'
import { bookCatalogLanguageFromAcceptLanguage, createBookCatalogProvider } from '~~/server/utils/book-catalog-provider'
import { getBookRepository } from '~~/server/utils/book-repository'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const id = getRouterParam(event, 'id') ?? ''
  const query = querySchema.parse(getQuery(event))
  const config = useRuntimeConfig(event)
  const volumes = await getRelatedBooks({
    id,
    limit: query.limit,
    provider: createBookCatalogProvider({
      googleBooksApiKey: config.googleBooksApiKey,
      language: bookCatalogLanguageFromAcceptLanguage(getHeader(event, 'accept-language'))
    }),
    repository: getBookRepository(event)
  })

  return { volumes }
})
