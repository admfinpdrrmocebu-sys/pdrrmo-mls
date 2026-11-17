// =============================================================================
// PDRRMO MLS SERVICE WORKER (Background Push Notifications & Native Alerts)
// =============================================================================

const BASEMAP_CACHE_NAME = 'pdrrmo-basemap-tiles-v1';

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim active clients immediately
  event.waitUntil(self.clients.claim());
});

// Cache-first handler for MapLibre background tiles so basemap tiles persist across browser restarts
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  try {
    const url = new URL(req.url);
    const isBasemapTile =
      url.hostname === 'server.arcgisonline.com' ||
      url.hostname === 'tile.openstreetmap.org';

    if (!isBasemapTile) return;

    event.respondWith(
      caches.open(BASEMAP_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const response = await fetch(req);
          if (response && response.status === 200) {
            cache.put(req, response.clone()).catch(() => {});
          }
          return response;
        } catch (err) {
          if (cached) return cached;
          throw err;
        }
      })
    );
  } catch {
    // Ignore invalid URLs
  }
});

// 1. Push Event Listener: Receives background notifications even when app/browser is closed
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PDRRMO Announcement', description: event.data.text() };
    }
  }

  const title = data.title || 'New Official Announcement';
  const options = {
    body: data.description || 'A new official operational bulletin has been published.',
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: data.id ? `pdrrmo-announcement-${data.id}` : 'pdrrmo-announcement',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/announcements',
      announcementId: data.id,
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'view',
        title: 'View Bulletin',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 2. Notification Click Handler: Focuses or opens the announcements screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/announcements';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if an existing tab is open
      for (const client of clientList) {
        if (client.url && client.url.includes('/announcements') && 'focus' in client) {
          // Inform client of clicked announcement
          client.postMessage({
            type: 'ANNOUNCEMENT_NOTIFICATION_CLICK',
            announcementId: event.notification.data?.announcementId,
          });
          return client.focus();
        }
      }

      // If no tab open, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
