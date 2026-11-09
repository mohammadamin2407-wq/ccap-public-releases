/* CCAP PWA updater — increment CACHE_NAME for every published release. */
const CACHE_NAME = 'ccap-shell-v0933';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-180.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ccap-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {
    try { payload = {body: event.data ? event.data.text() : ''}; } catch (_) {}
  }
  const title = payload.title || 'CCAP · هشدار بازار';
  const options = {
    body: payload.body || 'تغییر مهمی در وضعیت بازار شناسایی شد.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-180.png',
    tag: payload.tag || 'ccap-market-update',
    renotify: true,
    data: { url: payload.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL((event.notification.data && event.notification.data.url) || './', self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        client.navigate(destination);
        return client.focus();
      }
    }
    return clients.openWindow(destination);
  }));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || ['/proxy', '/health', '/diagnostics', '/version'].includes(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, {cache:'no-store'}).then(response => {
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(() => caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
      return response;
    })));
  }
});
