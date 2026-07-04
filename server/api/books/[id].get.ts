import { getBook } from '~~/core/application/books'
import { bookCatalogLanguageFromAcceptLanguage, createBookCatalogProvider } from '~~/server/utils/book-catalog-provider'
import { getBookRepository } from '~~/server/utils/book-repository'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const id = getRouterParam(event, 'id') ?? ''
  const config = useRuntimeConfig(event)
  const book = await getBook({
    id,
    provider: createBookCatalogProvider({
      googleBooksApiKey: config.googleBooksApiKey,
      language: bookCatalogLanguageFromAcceptLanguage(getHeader(event, 'accept-language'))
    }),
    repository: getBookRepository(event)
  })

  if (!book) {
    throw jsonError(404, 'Book not found.')
  }

  return { book }
})
