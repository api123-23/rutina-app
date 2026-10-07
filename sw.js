// Abre la app al instante desde la pantalla de inicio: sirve los archivos desde caché
// y los actualiza en segundo plano (un deploy nuevo se ve en la apertura siguiente).
// Los datos de Supabase no pasan por acá.
const CACHE = 'rutina-v1';
const BASE = ['/', '/app.js', '/logica.js', '/config.js', '/style.css', '/manifest.webmanifest', '/icon-180.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const guardada = await c.match(e.request, { ignoreSearch: url.origin === location.origin });
      const red = fetch(e.request).then((r) => {
        if (r.ok) c.put(e.request, r.clone());
        return r;
      });
      if (guardada) {
        e.waitUntil(red.catch(() => {}));
        return guardada;
      }
      return red;
    }),
  );
});
