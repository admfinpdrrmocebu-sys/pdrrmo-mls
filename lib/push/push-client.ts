// =============================================================================
// CLIENT-SIDE WEB PUSH & NATIVE MOBILE NOTIFICATION HELPER
// =============================================================================

import { supabase } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return Notification.permission;
}

/**
 * Registers the Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Requests notification permission, subscribes device to push notifications,
 * and saves the subscription to the backend database.
 */
export async function subscribeToPushNotifications(userId?: string): Promise<{
  success: boolean;
  status: NotificationPermission;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      status: 'denied',
      error: 'Push notifications are not supported on this browser or device.',
    };
  }

  try {
    // 1. Request OS / Browser Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        status: permission,
        error: 'Notification permission was not granted by the user.',
      };
    }

    // 2. Register Service Worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // 3. Obtain VAPID Public Key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID public key is missing from environment.');
      return {
        success: false,
        status: permission,
        error: 'VAPID public key not configured.',
      };
    }

    // 4. Subscribe to Push Service
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const existingSubscription = await registration.pushManager.getSubscription();

    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      }));

    // 5. Direct save to Supabase using browser client (attaches active JWT session)
    const subJSON = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJSON.keys?.p256dh;
    const auth = subJSON.keys?.auth;

    if (endpoint && p256dh && auth) {
      try {
        const { error: directErr } = await supabase
          .from('user_push_subscriptions')
          .upsert(
            {
              user_id: userId || null,
              endpoint,
              p256dh,
              auth,
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'endpoint' }
          );

        if (directErr) {
          console.warn('Direct push upsert notice:', directErr.message);
        }
      } catch (directEx) {
        console.warn('Direct push upsert exception:', directEx);
      }
    }

    // 6. Also call Next.js API route to sync on backend
    try {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subJSON,
          userId: userId || null,
          userAgent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        console.warn('Backend push subscription response notice:', await res.text());
      }
    } catch (apiErr) {
      console.warn('Failed to call /api/push/subscribe:', apiErr);
    }

    return { success: true, status: 'granted' };
  } catch (err: any) {
    console.error('Error during push notification subscription:', err);
    return {
      success: false,
      status: getNotificationPermission(),
      error: err.message || 'Failed to subscribe to push notifications.',
    };
  }
}

/**
 * Unsubscribes the current device from push notifications.
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return true;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    }
    return true;
  } catch (err) {
    console.error('Error unsubscribing from push notifications:', err);
    return false;
  }
}
