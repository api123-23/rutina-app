// Archivos de la app: primero la red (así cada deploy, incluido el index.html que iOS lee al
// instalar, se ve en la próxima apertura); si la red tarda más de 1,5 s o no hay señal, la copia guardada.
// Tipografías de Google: desde caché (no cambian). Los datos de Supabase no pasan por acá.
const CACHE = 'rutina-v3';
const BASE = ['/', '/app.js', '/logica.js', '/config.js', '/style.css', '/manifest.webmanifest', '/icon-180.png'];
const ESPERA_RED = 1500;

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
  const propio = url.origin === location.origin;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const guardada = await c.match(e.request, { ignoreSearch: propio });
      const red = fetch(e.request).then((r) => {
        if (r.ok) c.put(e.request, r.clone());
        return r;
      });
      if (!guardada) return red;
      e.waitUntil(red.catch(() => {}));
      if (!propio) return guardada;
      const lenta = new Promise((ok) => setTimeout(() => ok(guardada), ESPERA_RED));
      return Promise.race([red.catch(() => guardada), lenta]);
    }),
  );
});
