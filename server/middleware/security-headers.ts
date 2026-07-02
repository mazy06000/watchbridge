import { securityHeaders } from '~~/server/utils/security-headers'

export default defineEventHandler((event) => {
  for (const [name, value] of Object.entries(securityHeaders())) {
    setHeader(event, name, value)
  }
})
