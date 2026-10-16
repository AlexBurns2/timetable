/* ══════════════════════════════════════════════════════════════════════════
   Service worker: the site opens without a network.

   Deliberately conservative, because a bad service worker can wedge a site for
   good:

   • Pages are **network-first**. A fresh deploy always wins, and the cache is
     only reached for when the network does not answer. A stale shell can never
     stick around.
   • Static files (scripts, styles, fonts) are served from the cache and
     refreshed in the background, so a second visit is instant but never more
     than one visit behind.
   • **Nothing under /api is ever cached.** Timetables, marks and settings are
     personal and some are per-account; they stay in localStorage, which the
     pages already manage and which a shared cache must not hold.
   • The cache name carries a version. Bump CACHE_VERSION on a release and the
     old cache is deleted on activate.
   • /sw-off is an escape hatch: visiting it unregisters the worker and clears
     every cache, so a broken release can always be undone from the browser.
   ══════════════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'v1';
const CACHE = 'msc-' + CACHE_VERSION;

/* The shell: enough to open the timetable and the revision page with no
   network at all. The heavy Year 12 files are not pre-cached — they are picked
   up by the stale-while-revalidate path the first time they are used, so a
   first visit on a slow connection is not held up by 400 KB of question banks. */
const SHELL = [
  '/', '/index.html', '/home.html', '/revision.html', '/games.html',
  '/calendar.html', '/notes.html', '/resources.html',
  '/site.css', '/games.css', '/theme.css', '/settings.css',
  '/theme.js', '/tour.js', '/settings.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* One miss must not fail the whole install, so they are added one by one. */
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

const isApi = url => url.pathname.startsWith('/api/');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never touch writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // leave other hosts alone
  if (isApi(url)) return;                                 // personal data: always the network

  /* the escape hatch */
  if (url.pathname === '/sw-off'){
    e.respondWith((async () => {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
      await self.registration.unregister();
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline cache cleared</title>' +
        '<body style="font:16px/1.6 system-ui;margin:3rem auto;max-width:34rem;padding:0 1rem">' +
        '<h1>Offline cache cleared</h1><p>The service worker has been removed and every cached file deleted. ' +
        'Close this tab and open the site again.</p>',
        { headers:{ 'Content-Type':'text/html; charset=utf-8' } });
    })());
    return;
  }

  /* Pages: network first, cache only as a fallback. */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')){
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok){
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(req))
            || (await cache.match('/index.html'))
            || new Response('Offline, and this page has not been opened before.',
                 { status:503, headers:{ 'Content-Type':'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  /* Everything else: serve the cached copy at once, refresh it behind the scenes. */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await network) || new Response('', { status:504 });
  })());
});
