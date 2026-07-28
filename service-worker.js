const CACHE_VERSION = '2025-01-27-v1';
const CACHE_NAME = 'ritmo-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './icon-192.svg',
  './icon-512.svg',
  './js/main.js',
  './js/state.js',
  './js/dateUtils.js',
  './js/taskStats.js',
  './js/semesterUtils.js',
  './js/components/progressBar.js',
  './js/components/heatmap.js',
  './js/components/semesterPanel.js',
  './js/components/taskCard.js',
  './js/views/tableView.js',
  './js/views/todayView.js',
  './js/views/taskGridView.js',
  './js/modals.js',
  './js/ui.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('ritmo-')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
