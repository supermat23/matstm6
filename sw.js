// TM6 Service Worker — Cache-first strategy
const CACHE_NAME = 'tm6-v1';

// Fichiers à mettre en cache lors de l'installation
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=Sora:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Installation : mise en cache des assets principaux
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        // On cache les assets locaux — les externes peuvent échouer sans bloquer
        return cache.addAll(['./index.html', './manifest.json', './icon.svg'])
          .then(function() {
            // Tenter de cacher les assets externes séparément
            return Promise.allSettled(
              ['https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=Sora:wght@300;400;600;700&display=swap',
               'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'].map(function(url) {
                return cache.add(url).catch(function() {
                  console.warn('[SW] Impossible de cacher:', url);
                });
              })
            );
          });
      })
      .then(function() { return self.skipWaiting(); })
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch : cache-first, fallback réseau
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes non-http (chrome-extension, etc.)
  var url = event.request.url;
  if (!url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) {
        // Servir depuis le cache, mettre à jour en arrière-plan
        var fetchUpdate = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() {});
        return cached;
      }

      // Pas en cache : récupérer depuis le réseau
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // Hors ligne et pas en cache
        return new Response(
          '<html><body style="background:#070b12;color:#94a3b8;font-family:sans-serif;text-align:center;padding-top:40px">'
          + '<h2>TM6 — Hors ligne</h2>'
          + '<p>Ouvrez l\'application en étant connecté une première fois pour activer le mode hors ligne.</p>'
          + '</body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      });
    })
  );
});
