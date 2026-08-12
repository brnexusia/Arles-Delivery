const CACHE_NAME = 'arles-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Apenas faz o pass-through, não armazena em cache para não gerar dor de cabeça
  // com atualizações de layout. Apenas atende ao requisito de PWA instalável.
  event.respondWith(fetch(event.request));
});
