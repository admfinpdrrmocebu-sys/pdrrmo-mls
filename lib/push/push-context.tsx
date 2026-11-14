'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AlertCircle, BellOff, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '@/lib/auth';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  checkIsPushSubscribed,
} from '@/lib/push/push-client';

export interface PushToastState {
  message: string;
  submessage?: string;
  type: 'success' | 'error' | 'info';
}

export interface PushNotificationContextType {
  isPushSupported: boolean;
  pushStatus: NotificationPermission;
  isPushActive: boolean;
  isSubscribingPush: boolean;
  togglePushNotifications: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType>({
  isPushSupported: false,
  pushStatus: 'default',
  isPushActive: false,
  isSubscribingPush: false,
  togglePushNotifications: async () => {},
});

export function usePushNotifications(): PushNotificationContextType {
  return useContext(PushNotificationContext);
}

/**
 * PushNotificationProvider
 * ========================
 * Global Web Push / Alert preference state and actions shared across the layout shell
 * and VerticalNav so users can manage device alerts from any operational route without
 * re-checking Service Worker & PushManager state on every navigation.
 */
export function PushNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const currentUserId = user?.id || profile?.id || '';

  const [isPushSupported, setIsPushSupported] = useState(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [isPushActive, setIsPushActive] = useState(false);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [pushToast, setPushToast] = useState<PushToastState | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedUserRef = useRef<string | null>(null);

  const showPushToast = useCallback(
    (
      message: string,
      submessage?: string,
      type: 'success' | 'error' | 'info' = 'success'
    ) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setPushToast({ message, submessage, type });
      toastTimerRef.current = setTimeout(() => {
        setPushToast(null);
      }, 4000);
    },
    []
  );

  // Sync Web Push support, permission status, and active subscription state asynchronously
  useEffect(() => {
    let cancelled = false;

    const syncPushState = async () => {
      const supported = isPushNotificationSupported();
      const perm = getNotificationPermission();
      const subscribed =
        supported && perm === 'granted' ? await checkIsPushSubscribed() : false;

      if (cancelled) return;
      setIsPushSupported(supported);
      setPushStatus(perm);
      setIsPushActive(subscribed);

      if (subscribed && syncedUserRef.current !== (currentUserId || '__anon__')) {
        syncedUserRef.current = currentUserId || '__anon__';
        subscribeToPushNotifications(currentUserId || undefined).catch((err) => {
          console.warn('Background push subscription sync notice:', err);
        });
      }
    };

    void syncPushState();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const togglePushNotifications = useCallback(async () => {
    if (!isPushSupported) {
      showPushToast(
        'Push Notifications Unsupported',
        'Your browser or device does not support Web Push notifications.',
        'info'
      );
      return;
    }

    if (pushStatus === 'denied') {
      showPushToast(
        'Notifications Blocked',
        'Notification permissions are blocked in your browser settings. Please allow notifications for this site.',
        'error'
      );
      return;
    }

    setIsSubscribingPush(true);

    try {
      if (isPushActive) {
        await unsubscribeFromPushNotifications();
        setIsPushActive(false);
        showPushToast(
          'Phone Alerts Turned Off',
          'You will no longer receive background phone alerts.',
          'info'
        );
      } else {
        const res = await subscribeToPushNotifications(currentUserId || undefined);
        setPushStatus(res.status);
        if (res.success) {
          setIsPushActive(true);
          syncedUserRef.current = currentUserId || '__anon__';
          showPushToast(
            'Phone Alerts Turned On',
            'You will now receive native alerts even when the app is closed.',
            'success'
          );
        } else if (res.status === 'denied') {
          setIsPushActive(false);
          showPushToast(
            'Permission Declined',
            'Notification permission was declined.',
            'info'
          );
        } else {
          setIsPushActive(false);
          showPushToast(
            'Notification Setup',
            res.error || 'Could not complete push registration.',
            'error'
          );
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update alert settings.';
      showPushToast('Error', msg, 'error');
    } finally {
      setIsSubscribingPush(false);
    }
  }, [
    isPushSupported,
    pushStatus,
    isPushActive,
    currentUserId,
    showPushToast,
  ]);

  return (
    <PushNotificationContext.Provider
      value={{
        isPushSupported,
        pushStatus,
        isPushActive,
        isSubscribingPush,
        togglePushNotifications,
      }}
    >
      {children}

      {/* Global Push Toggle Feedback Toast */}
      <AnimatePresence>
        {pushToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 text-white px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 print:hidden ${
              pushToast.type === 'error'
                ? 'bg-rose-900/90 border-rose-700 text-white'
                : pushToast.type === 'info'
                ? 'bg-sky-900/90 border-sky-700 text-white'
                : 'bg-[#1E293B] border-slate-700 text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                pushToast.type === 'error'
                  ? 'bg-rose-500/20 text-rose-300'
                  : pushToast.type === 'info'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {pushToast.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : pushToast.type === 'info' ? (
                <BellOff className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold">{pushToast.message}</p>
              {pushToast.submessage && (
                <p className="text-xs text-slate-300">{pushToast.submessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PushNotificationContext.Provider>
  );
}
