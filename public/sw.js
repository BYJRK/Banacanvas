// Minimal service worker — no offline caching.
// Its only purpose is to satisfy the installability criteria of Chromium
// browsers (a registered SW with a fetch handler). All requests are passed
// straight through to the network, so the app is always up to date.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
