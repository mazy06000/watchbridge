import { z } from 'zod'
import { matchWithBetaSeries } from '~~/server/utils/betaseries-provider'

const schema = z.object({
  shows: z.array(z.object({
    sourceShowId: z.string().min(1),
    title: z.string().min(1),
    episodes: z.array(z.object({
      sourceEpisodeId: z.string().min(1),
      seasonNumber: z.number().int().nonnegative(),
      episodeNumber: z.number().int().positive()
    })).max(400)
  })).max(30),
  movies: z.array(z.object({
    sourceMovieId: z.string().min(1),
    title: z.string().min(1),
    releaseDate: z.string().optional()
  })).max(50)
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)

  const body = schema.parse(await readBody(event))
  return matchWithBetaSeries(event, body)
})
