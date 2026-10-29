// =============================================================================
// PDRRMO MLS SERVICE WORKER (Background Push Notifications & Native Alerts)
// =============================================================================

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim active clients immediately
  event.waitUntil(self.clients.claim());
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
