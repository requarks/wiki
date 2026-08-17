/* global WIKI */

const PWA_THEME_COLOR = '#1976d2'
const PWA_DEFAULT_APP_NAME = 'Sunni Noor'

const PWA_SERVICE_WORKER_SOURCE = `
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
`.trim()

function getWebAppManifest () {
  const appName = WIKI.config.title || PWA_DEFAULT_APP_NAME

  return {
    name: appName,
    short_name: appName,
    id: '/',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: '/_assets/favicons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/_assets/favicons/android-chrome-256x256.png',
        sizes: '256x256',
        type: 'image/png'
      }
    ],
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_THEME_COLOR,
    display: 'standalone'
  }
}

function sendWebAppManifest (req, res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store'
  })
  res.type('application/manifest+json').send(getWebAppManifest())
}

function sendServiceWorker (req, res) {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store'
  })
  res.type('application/javascript').set('Service-Worker-Allowed', '/').send(PWA_SERVICE_WORKER_SOURCE)
}

module.exports = {
  PWA_THEME_COLOR,
  PWA_DEFAULT_APP_NAME,
  getWebAppManifest,
  sendWebAppManifest,
  sendServiceWorker
}
