/* ═══════════════════════════════════════════════════════
   Luminary Home Academy — Service Worker
   Provides offline support & makes the app installable
   ═══════════════════════════════════════════════════════ */

const CACHE_NAME = 'luminary-v1';

// Files to pre-cache on install (shell of the app)
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Google Fonts are cached on first use via network-first below
];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())        // activate immediately
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())       // take control of all pages
  );
});

// ── Fetch strategy ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extension requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Firebase / Firestore — always network (don't cache API calls)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    return; // let browser handle normally
  }

  // Google Fonts — cache-first with network fallback
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // App shell & local assets — cache-first, fall back to network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // Only cache successful same-origin responses
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // If offline and nothing cached, return the cached index for navigation
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ── Background sync hint (optional future use) ──
self.addEventListener('sync', event => {
  if (event.tag === 'luminary-sync') {
    // Firebase handles its own sync; this is a no-op placeholder
    console.log('[SW] background sync triggered');
  }
});
