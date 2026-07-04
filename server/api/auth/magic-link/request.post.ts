import { z } from 'zod'
import { requestMagicLink } from '~~/server/utils/auth'
import { sendMagicLinkEmail } from '~~/server/utils/email'

const requestSchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  const body = requestSchema.parse(await readBody(event))
  const { magicLink, expiresAt } = await requestMagicLink(event, body.email)
  const delivery = await sendMagicLinkEmail(event, {
    to: body.email,
    magicLink,
    expiresAt
  })

  return {
    ok: true,
    delivered: delivery.delivered,
    devMagicLink: delivery.devMagicLink
  }
})
