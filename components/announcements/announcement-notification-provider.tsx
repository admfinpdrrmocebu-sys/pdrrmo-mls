'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { playNotificationSound, initAudioUnlocker } from '@/lib/audio/notification-sound';
import { registerServiceWorker } from '@/lib/push/push-client';
import {
  AnnouncementNotificationBanner,
  AnnouncementBannerData,
} from './announcement-notification-banner';

interface AnnouncementNotificationContextType {
  activeNotification: AnnouncementBannerData | null;
  dismissNotification: () => void;
}

const AnnouncementNotificationContext = createContext<AnnouncementNotificationContextType>({
  activeNotification: null,
  dismissNotification: () => {},
});

export function useAnnouncementNotificationContext() {
  return useContext(AnnouncementNotificationContext);
}

export function AnnouncementNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, user: authUser } = useAuth();
  const currentUserId = authUser?.id || profile?.id;

  const [activeNotification, setActiveNotification] = useState<AnnouncementBannerData | null>(null);

  const dismissNotification = useCallback(() => {
    setActiveNotification(null);
  }, []);

  const handleView = useCallback(
    (id: string) => {
      dismissNotification();
      router.push(`/announcements?id=${id}`);
    },
    [dismissNotification, router]
  );

  useEffect(() => {
    // 1. Initialize audio unlocker for mobile browser autoplay policy
    initAudioUnlocker();

    // 2. Register Service Worker for native background notifications
    registerServiceWorker();

    // 3. Subscribe to Supabase Realtime for newly published announcements
    const channel = supabase
      .channel('announcements-global-live-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          // If the current user was the one who posted it, do not show alert banner
          if (currentUserId && newRow.created_by === currentUserId) {
            return;
          }

          const bannerData: AnnouncementBannerData = {
            id: newRow.id,
            title: newRow.title || 'Urgent Bulletin',
            description: newRow.description || '',
            createdBy: newRow.created_by,
            createdByName: newRow.created_by_name || 'Operations Command',
            createdAt: newRow.created_at,
          };

          // 1. Play official sound effect (Notification.wav)
          playNotificationSound();

          // 2. Display in-app floating banner
          setActiveNotification(bannerData);

          // 3. If tab is backgrounded / minimized, trigger native OS notification
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.visibilityState === 'hidden'
          ) {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((reg) => {
                reg.showNotification(`PDRRMO: ${bannerData.title}`, {
                  body: bannerData.description.replace(/<[^>]*>?/gm, '').slice(0, 140),
                  icon: '/assets/logo.png',
                  badge: '/assets/logo.png',
                  vibrate: [250, 100, 250],
                  data: { url: `/announcements?id=${bannerData.id}` },
                } as any);
              });
            } else {
              new Notification(`PDRRMO: ${bannerData.title}`, {
                body: bannerData.description.replace(/<[^>]*>?/gm, '').slice(0, 140),
                icon: '/assets/logo.png',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <AnnouncementNotificationContext.Provider
      value={{
        activeNotification,
        dismissNotification,
      }}
    >
      {children}

      {/* Floating In-App Realtime Notification Banner */}
      <AnimatePresence>
        {activeNotification && (
          <AnnouncementNotificationBanner
            announcement={activeNotification}
            onView={handleView}
            onDismiss={dismissNotification}
          />
        )}
      </AnimatePresence>
    </AnnouncementNotificationContext.Provider>
  );
}
