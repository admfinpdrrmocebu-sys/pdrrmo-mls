// =============================================================================
// CLIENT-SIDE WEB PUSH & NATIVE MOBILE NOTIFICATION HELPER
// =============================================================================

import { supabase } from '@/lib/supabase/client';

export const DEFAULT_VAPID_PUBLIC_KEY =
  'BIJ6Vz8cnZyFe76hVZqoHsGExgQIivB__UoW5eCjGgcWSbJzbJSDP6LIRloRYIlK--NIywmN_iVDR4VG8yqlbjc';

function cleanKey(rawKey?: string | null): string {
  if (!rawKey) return '';
  return rawKey.replace(/^["']|["']$/g, '').trim();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const sanitized = cleanKey(base64String);
  const padding = '='.repeat((4 - (sanitized.length % 4)) % 4);
  const base64 = (sanitized + padding).replace(/-/g, '+').replace(/_/g, '/');
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
 * Checks whether the current device is actively subscribed to Web Push.
 */
export async function checkIsPushSubscribed(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;
  if (getNotificationPermission() !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (err) {
    console.warn('Error checking push subscription status:', err);
    return false;
  }
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
 * Retrieves the VAPID Public Key via client environment variable,
 * dynamic API fetch (/api/push/vapid-public-key), or fallback default key.
 */
export async function getVapidPublicKey(): Promise<string> {
  // 1. Check inlined client environment variable
  let key = cleanKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  if (key) return key;

  // 2. Fetch dynamically from API endpoint
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/push/vapid-public-key');
      if (res.ok) {
        const data = await res.json();
        if (data?.publicKey) {
          key = cleanKey(data.publicKey);
          if (key) return key;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch VAPID public key from /api/push/vapid-public-key:', err);
    }
  }

  // 3. Fallback to configured project default VAPID public key
  return DEFAULT_VAPID_PUBLIC_KEY;
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

    // 3. Obtain VAPID Public Key (multi-tier resolution)
    const vapidPublicKey = await getVapidPublicKey();
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

      // Delete directly from Supabase
      try {
        await supabase.from('user_push_subscriptions').delete().eq('endpoint', endpoint);
      } catch (sbErr) {
        console.warn('Direct push delete error:', sbErr);
      }

      // Also call backend API to delete
      try {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      } catch (apiErr) {
        console.warn('Backend push delete error:', apiErr);
      }
    }
    return true;
  } catch (err) {
    console.error('Error unsubscribing from push notifications:', err);
    return false;
  }
}
