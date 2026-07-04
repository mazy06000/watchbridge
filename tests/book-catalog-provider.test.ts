import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextBookStatus } from '~~/core/application/books'
import { createBookCatalogProvider } from '~~/server/utils/book-catalog-provider'

describe('book catalog provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes Open Library search results into book works', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      docs: [
        {
          key: '/works/OL82563W',
          title: 'Dune',
          author_key: ['OL79034A'],
          author_name: ['Frank Herbert'],
          first_publish_year: 1965,
          cover_i: 12345,
          subject: ['Science fiction', 'Arrakis']
        }
      ]
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const results = await createBookCatalogProvider().search({ query: 'dune', limit: 5 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'ol-work-OL82563W',
      title: 'Dune',
      authors: [{ id: 'ol-author-OL79034A', name: 'Frank Herbert' }],
      coverUrl: 'https://covers.openlibrary.org/b/id/12345-L.jpg',
      firstPublishYear: 1965,
      subjects: ['Science fiction', 'Arrakis']
    })
  })

  it('falls back to Google Books when Open Library has no results', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('openlibrary.org')) {
        return new Response(JSON.stringify({ docs: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        items: [
          {
            id: 'abc123',
            volumeInfo: {
              title: 'Project Hail Mary',
              authors: ['Andy Weir'],
              publishedDate: '2021-05-04',
              pageCount: 496,
              categories: ['Science fiction'],
              imageLinks: {
                thumbnail: 'http://books.google.com/cover.jpg'
              }
            }
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await createBookCatalogProvider().search({ query: 'project hail mary', limit: 5 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: 'google-volume-abc123',
      title: 'Project Hail Mary',
      authors: [{ id: 'google-author-andy-weir', name: 'Andy Weir' }],
      coverUrl: 'https://books.google.com/cover.jpg',
      firstPublishYear: 2021
    })
  })

  it('keeps book descriptions in the requested language', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('openlibrary.org')) {
        return new Response(JSON.stringify({ docs: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        items: [
          {
            id: 'alchemy-1',
            volumeInfo: {
              title: 'Alchemised',
              authors: ['SenLinYu'],
              description: '« In English: What is it you think you are protecting? En Français: Que croyez-vous protéger ? »',
              publishedDate: '2025',
              categories: ['Fantasy']
            }
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await createBookCatalogProvider({ language: 'en-US' }).search({ query: 'alchemised', limit: 5 })

    expect(results[0]?.description).toBe('What is it you think you are protecting?')
    const googleUrl = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes('googleapis.com'))
    expect(googleUrl).toContain('langRestrict=en')
    expect(googleUrl).toContain('hl=en')
  })

  it('recovers an Open Library detail cover from the matching search result', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      if (target.includes('/works/OL42543873W.json')) {
        return new Response(JSON.stringify({
          key: '/works/OL42543873W',
          title: 'Alchemised',
          authors: [{ author: { key: '/authors/OL1A' } }]
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (target.includes('/authors/OL1A.json')) {
        return new Response(JSON.stringify({ name: 'SenLinYu' }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (target.includes('/search.json')) {
        return new Response(JSON.stringify({
          docs: [
            {
              key: '/works/OL42543873W',
              title: 'Alchemised',
              author_key: ['OL1A'],
              author_name: ['SenLinYu'],
              cover_i: 15162548
            }
          ]
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const book = await createBookCatalogProvider({ language: 'en-US' }).getBook('ol-work-OL42543873W')

    expect(book?.coverUrl).toBe('https://covers.openlibrary.org/b/id/15162548-L.jpg')
    expect(book?.authors).toEqual([{ id: 'ol-author-OL1A', name: 'SenLinYu' }])
  })

  it('finds related volumes by title and author', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url)
      expect(target).toContain('Outlander')
      expect(target).toContain('Diana')
      return new Response(JSON.stringify({
        docs: [
          {
            key: '/works/OL1W',
            title: 'Outlander',
            author_key: ['OL1A'],
            author_name: ['Diana Gabaldon'],
            first_publish_year: 1991
          },
          {
            key: '/works/OL2W',
            title: 'Dragonfly in Amber',
            author_key: ['OL1A'],
            author_name: ['Diana Gabaldon'],
            first_publish_year: 1992
          },
          {
            key: '/works/OL3W',
            title: 'Voyager',
            author_key: ['OL1A'],
            author_name: ['Diana Gabaldon'],
            first_publish_year: 1994
          },
          {
            key: '/works/OL5W',
            title: 'Outlander A Novel',
            author_key: ['OL1A'],
            author_name: ['Diana Gabaldon'],
            first_publish_year: 2011
          },
          {
            key: '/works/OL6W',
            title: 'Outlander Series By Diana Gabaldon 8 Books Collection Set',
            author_key: ['OL1A'],
            author_name: ['Diana Gabaldon'],
            first_publish_year: 2019
          },
          {
            key: '/works/OL4W',
            title: 'Unrelated Outlander Guide',
            author_key: ['OL2A'],
            author_name: ['Another Author'],
            first_publish_year: 2001
          }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const volumes = await createBookCatalogProvider().getRelatedBooks({
      book: {
        id: 'ol-work-OL1W',
        title: 'Outlander',
        authors: [{ id: 'ol-author-OL1A', name: 'Diana Gabaldon' }],
        subjects: [],
        firstPublishYear: 1991
      },
      limit: 3
    })

    expect(volumes.map((volume) => volume.title)).toEqual([
      'Outlander',
      'Dragonfly in Amber',
      'Voyager'
    ])
  })
})

describe('book progress status', () => {
  it('derives reading status from page progress', () => {
    expect(nextBookStatus({ currentPage: 42, totalPages: 300 })).toBe('reading')
    expect(nextBookStatus({ currentPage: 300, totalPages: 300 })).toBe('read')
    expect(nextBookStatus({ currentPercent: 100 })).toBe('read')
    expect(nextBookStatus({ explicitStatus: 'dnf', currentPage: 300, totalPages: 300 })).toBe('dnf')
  })
})
