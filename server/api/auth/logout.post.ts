import { logout } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  setNoStoreHeaders(event)
  await logout(event)
  return { ok: true }
})
