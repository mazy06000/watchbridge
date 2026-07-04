import type { H3Event } from 'h3'

export async function sendMagicLinkEmail(event: H3Event, input: {
  to: string
  magicLink: string
  expiresAt: string
}): Promise<{ delivered: boolean, devMagicLink?: string }> {
  const config = useRuntimeConfig(event)
  const apiKey = String(config.resendApiKey || '')

  if (!apiKey) {
    console.info(`[SagaLog] Magic link for ${input.to}: ${input.magicLink}`)
    return {
      delivered: false,
      devMagicLink: process.env.NODE_ENV === 'production' ? undefined : input.magicLink
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: String(config.emailFrom || 'SagaLog <noreply@watchbridge.org>'),
      to: [input.to],
      subject: 'Sign in to SagaLog',
      html: [
        '<p>Use this secure link to sign in to SagaLog.</p>',
        `<p><a href="${escapeHtml(input.magicLink)}">Sign in to SagaLog</a></p>`,
        `<p>This link expires at ${escapeHtml(input.expiresAt)}.</p>`
      ].join('')
    })
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Email delivery failed.',
      message: await response.text().catch(() => 'Email delivery failed.')
    })
  }

  return { delivered: true }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
