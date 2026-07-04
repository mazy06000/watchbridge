import { getOptionalUser } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const user = await getOptionalUser(event)
  return { user }
})
