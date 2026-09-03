const CACHE = 'pockettrack-v42-json-backup-polish';
const SHELL = [
  './',
  './index.html',
  './app.html',
  './styles.css',
  './icons.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './firebase.js',
  './offline.js',
  './app.js',
  './wallets.js',
  './transactions.js',
  './insights.js',
  './auth.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Never intercept or cache cross-origin traffic
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (err) { return; }
  // Network-first, then cache fallback
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./app.html')))
  );
});