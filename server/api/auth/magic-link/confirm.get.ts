import { confirmMagicLink } from '~~/server/utils/auth'
import { getRequestOrigin } from '~~/server/utils/http'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''
  await confirmMagicLink(event, token)
  await sendRedirect(event, `${getRequestOrigin(event)}/?signedIn=1`, 302)
})
