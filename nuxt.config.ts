import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-25',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss()
    ]
  },
  nitro: {
    preset: 'cloudflare_pages',
    routeRules: {
      '/api/**': {
        headers: {
          'cache-control': 'no-store, max-age=0'
        }
      }
    }
  },
  runtimeConfig: {
    betaseriesApiKey: '',
    betaseriesClientSecret: '',
    oauthStateSecret: '',
    public: {
      appBaseUrl: '',
      betaSeriesApiVersion: '3.0'
    }
  },
  app: {
    head: {
      title: 'WatchBridge',
      meta: [
        {
          name: 'description',
          content: 'Private TV Time GDPR export migration to BetaSeries and other media providers.'
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: true
  }
})
