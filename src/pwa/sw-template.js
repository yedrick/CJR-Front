/* Service worker de CJN Campamentos.
 *
 * Este archivo es una PLANTILLA: el plugin `cjnServiceWorker` de vite.config.ts lo copia
 * al build como /sw.js reemplazando:
 *   self.__SW_VERSION__   → versión del build (hash de los archivos generados)
 *   self.__SW_PRECACHE__  → lista de archivos del "app shell" (index.html + assets con hash + public/)
 *   self.__SW_API_BASE__  → VITE_API_URL (nunca se cachea)
 * En desarrollo (vite dev) no se registra ningún service worker.
 */

const VERSION = self.__SW_VERSION__;
const PRECACHE_URLS = self.__SW_PRECACHE__;
const API_BASE = self.__SW_API_BASE__;

const PREFIX = 'cjn-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const RUNTIME_CACHE = `${PREFIX}runtime-${VERSION}`;
// Las imágenes y fuentes externas sobreviven entre versiones (no dependen del build)
const IMAGE_CACHE = `${PREFIX}images-v1`;
const FONT_CACHE = `${PREFIX}fonts-v1`;
const KEEP = [SHELL_CACHE, RUNTIME_CACHE, IMAGE_CACHE, FONT_CACHE];

const IMAGE_MAX_ENTRIES = 80;
const FONT_MAX_ENTRIES = 30;
const NAVIGATION_TIMEOUT_MS = 5000;
const INDEX_URL = '/index.html';

const apiBaseUrl = (() => {
  try {
    return API_BASE ? new URL(API_BASE, self.location.origin).href.replace(/\/$/, '') : '';
  } catch (e) {
    return '';
  }
})();

// ───────────────────────────── install / activate ─────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const critical = PRECACHE_URLS.filter((u) => u === INDEX_URL || /\.(js|css)$/.test(u));
      const optional = PRECACHE_URLS.filter((u) => !critical.includes(u));
      // index.html + JS/CSS son obligatorios: si fallan, la instalación falla y se reintenta luego
      await cache.addAll(critical.map((u) => new Request(u, { cache: 'reload' })));
      // el resto (íconos, imágenes locales, fuentes…) es de mejor esfuerzo
      await Promise.allSettled(optional.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    })()
  );
  // No se llama a skipWaiting aquí: la app muestra "Nueva versión disponible" y el usuario decide.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !KEEP.includes(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (e) {
          /* no soportado */
        }
      }
      await self.clients.claim();
    })()
  );
});

// ───────────────────────────── mensajes desde la app ─────────────────────────────
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    const reply = { type: 'VERSION', version: VERSION };
    if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
    else if (event.source) event.source.postMessage(reply);
  }
});

// ───────────────────────────── fetch ─────────────────────────────
const isApiRequest = (url) =>
  (apiBaseUrl && url.href.startsWith(apiBaseUrl)) || (url.origin === self.location.origin && url.pathname.startsWith('/api/'));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // nunca se cachea POST/PUT/PATCH/DELETE

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isApiRequest(url)) return; // la API siempre va a la red

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js') return;
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.hostname === 'images.unsplash.com') {
    event.respondWith(staleWhileRevalidate(event, IMAGE_CACHE, IMAGE_MAX_ENTRIES));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE, FONT_MAX_ENTRIES));
  }
});

/** Navegación (rutas de la SPA como /admin/pagos): red primero, si falla → index.html guardado. */
async function handleNavigation(event) {
  const cachedShell = () => caches.match(INDEX_URL, { cacheName: SHELL_CACHE }).then((r) => r || caches.match(INDEX_URL));
  try {
    const network = (async () => {
      const preload = await event.preloadResponse;
      if (preload) return preload;
      return fetch(event.request);
    })();
    const response = await withTimeout(network, NAVIGATION_TIMEOUT_MS, cachedShell);
    if (response) return response;
    throw new Error('sin respuesta');
  } catch (e) {
    const shell = await cachedShell();
    if (shell) return shell;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>' +
        '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#F8FAFC;color:#0f172a;text-align:center">' +
        '<div><h1 style="color:#0284C7">Sin conexión</h1><p>Conéctate a internet y vuelve a intentarlo.</p></div></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Si la red tarda demasiado y hay una copia guardada, responde con la copia. */
function withTimeout(promise, ms, fallback) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(async () => {
      const cached = await fallback();
      if (cached && !settled) {
        settled = true;
        resolve(cached);
      }
    }, ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(res);
        }
      },
      (err) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    );
  });
}

/** Archivos estáticos del mismo origen: caché primero (los assets llevan hash en el nombre). */
async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy)).catch(() => undefined);
  }
  return response;
}

/** Imágenes / fuentes externas: responde con la copia y la actualiza en segundo plano. */
async function staleWhileRevalidate(event, cacheName, maxEntries) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then(async (response) => {
      // las imágenes cross-origin sin CORS llegan "opaque" (status 0): también se guardan
      if (response && (response.ok || response.type === 'opaque')) {
        await cache.put(request, response.clone());
        await trimCache(cache, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  const fresh = await update;
  return fresh || Response.error();
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // las claves vienen en orden de inserción: se borran las más antiguas
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

// ───────────────────────────── Web Push ─────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'CJN Campamentos';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    lang: 'es',
    data: { link: payload.link || '/' },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // avisa a las pestañas abiertas para que actualicen la campana de inmediato
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', payload }));
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin);
  const path = target.origin === self.location.origin ? target.pathname + target.search + target.hash : '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = clients.find((c) => new URL(c.url).origin === self.location.origin);
      if (client) {
        try {
          await client.focus();
        } catch (e) {
          /* algunos navegadores no permiten enfocar */
        }
        client.postMessage({ type: 'NAVIGATE', url: path });
        return;
      }
      if (self.clients.openWindow) await self.clients.openWindow(target.origin === self.location.origin ? target.href : '/');
    })()
  );
});
