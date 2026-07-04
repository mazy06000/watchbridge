import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-06-25',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@vite-pwa/nuxt'],
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
    authSecret: '',
    resendApiKey: '',
    emailFrom: 'SagaLog <noreply@watchbridge.org>',
    tmdbAccessToken: '',
    tmdbApiKey: '',
    googleBooksApiKey: '',
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
      title: 'SagaLog',
      meta: [
        {
          name: 'description',
          content: 'A private tracker for your shows, movies, books, and imported media history.'
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1'
        }
      ]
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'SagaLog',
      short_name: 'SagaLog',
      description: 'Track shows, movies, books, and bring your media history with you.',
      theme_color: '#050505',
      background_color: '#050505',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/images/logo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,webp}'],
      navigateFallbackDenylist: [/^\/api\//],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkOnly',
          options: {
            cacheName: 'sagalog-api-network-only'
          }
        }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: true
  }
})
