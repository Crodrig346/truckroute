// TruckRoute "service worker": a helper that runs in the background of the browser.
// Its job here is to keep a copy of the app itself (the page, icons and map library) on the phone,
// so the app opens instantly and even opens with no signal.
// It does NOT store routes, stops or map pictures - those always come live from the internet.

const CACHE = 'truckroute-v33';   // change this number whenever the app files change, to force an update
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
const APP_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/badge-96.png',
  // the map library and its little pictures (pins, buttons), saved up front so the app can start with no signal
  LEAFLET + 'leaflet.min.css', LEAFLET + 'leaflet.min.js',
  LEAFLET + 'images/marker-icon.png', LEAFLET + 'images/marker-icon-2x.png', LEAFLET + 'images/marker-shadow.png', LEAFLET + 'images/layers.png',
  // the library that draws the clean street map (MapLibre) and its Leaflet connector
  'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css', 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  // Throw away copies from older versions.
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // The app's own files: try the internet first (so updates show up), fall back to the saved copy offline.
  if (url.origin === location.origin) {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then(saved => saved || caches.match('index.html'))));
    return;
  }

  // The map library (Leaflet) from cdnjs: use the saved copy right away, refresh it quietly in the background.
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(request).then(saved => {
        const refresh = fetch(request).then(response => { cache.put(request, response.clone()); return response; }).catch(() => saved);
        return saved || refresh;
      })));
  }
  // Everything else (routing, stop search, address search, map pictures) goes straight to the internet.
});

// Tapping the "still navigating" reminder in the notification panel: go back to the open app, or open it if the phone closed it
// (it then picks the trip back up by itself).
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const w of windows) if ('focus' in w) return w.focus();
    return self.clients.openWindow((event.notification.data && event.notification.data.url) || './');
  }));
});
