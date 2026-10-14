// Cambia este número cada vez que subas una versión nueva de la app.
const VERSION = 'bixolon-v5';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const FUENTES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const abs = p => new URL(p, self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith('bixolon-') && k !== VERSION).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Fotos enviadas desde "Compartir" de Android
  if (e.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    e.respondWith((async () => {
      const datos = await e.request.formData();
      const c = await caches.open('compartidas');
      for (const k of await c.keys()) await c.delete(k);
      let i = 0;
      for (const f of datos.getAll('imagenes')) {
        await c.put(abs('compartida/' + i++), new Response(f, {
          headers: { 'content-type': f.type, 'x-name': encodeURIComponent(f.name || 'imagen') }
        }));
      }
      return Response.redirect(abs('./?share=1'), 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;

  // Letra Raleway: se guarda la primera vez para que funcione sin internet
  if (FUENTES.includes(url.origin)) {
    e.respondWith((async () => {
      const c = await caches.open(VERSION);
      const guardada = await c.match(e.request);
      if (guardada) return guardada;
      try { const r = await fetch(e.request); c.put(e.request, r.clone()); return r; }
      catch (err) { return new Response('', { status: 504 }); }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // Primero la copia guardada (funciona sin internet); se actualiza en segundo plano.
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const guardada = await c.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    return guardada || (await red) || (await c.match('./index.html'));
  })());
});
