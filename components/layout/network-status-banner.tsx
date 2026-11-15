'use client';

import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Gauge } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type NetworkStatus = 'online' | 'slow' | 'offline';

interface NetworkInformationLike extends EventTarget {
  type?: string;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

const PROBE_INTERVAL_MS = 4000;
const PROBE_TIMEOUT_MS = 4500;
const SLOW_LATENCY_MS = 1500;
const HEALTHY_LATENCY_MS = 1200;

function getNetworkConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

function getImmediateDeviceStatus(): NetworkStatus | null {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }
  const conn = getNetworkConnection();
  if (!conn) return null;

  if (conn.type === 'none' || conn.downlink === 0) {
    return 'offline';
  }
  if (
    conn.effectiveType === 'slow-2g' ||
    conn.effectiveType === '2g' ||
    (typeof conn.rtt === 'number' && conn.rtt >= 800) ||
    (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < 0.7)
  ) {
    return 'slow';
  }
  return null;
}

/**
 * NetworkStatusBanner
 * ===================
 * Global, zero-button floating info banner mounted in RootLayout so any screen
 * immediately notifies the operator when internet connectivity is slow or lost.
 * Runs entirely in the frontend using browser network events, Network Information API,
 * and a lightweight client-side reachability check.
 */
export function NetworkStatusBanner() {
  // Start 'online' on SSR & first hydration frame to avoid hydration mismatches.
  const [status, setStatus] = useState<NetworkStatus>('online');

  const consecutiveTimeoutsRef = useRef(0);
  const probeInFlightRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let activeController: AbortController | null = null;

    const applyStatus = (next: NetworkStatus) => {
      if (!isMounted) return;
      setStatus((prev) => (prev === next ? prev : next));
    };

    const runConnectivityProbe = async () => {
      if (!isMounted || probeInFlightRef.current) return;

      const immediate = getImmediateDeviceStatus();
      if (immediate === 'offline') {
        applyStatus('offline');
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      probeInFlightRef.current = true;
      const controller = new AbortController();
      activeController = controller;
      const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      const startedAt = performance.now();

      try {
        // Prefer external Supabase health endpoint so turning off Wi-Fi/internet on localhost
        // immediately detects real internet loss (instead of succeeding over 127.0.0.1 loopback).
        const useSupabaseHealth = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
        const probeTarget = useSupabaseHealth
          ? `${SUPABASE_URL}/auth/v1/health?_nc=${Date.now()}`
          : `/manifest.json?_nc=${Date.now()}`;

        const res = await fetch(probeTarget, {
          method: useSupabaseHealth ? 'GET' : 'HEAD',
          cache: 'no-store',
          headers: useSupabaseHealth && SUPABASE_ANON_KEY
            ? { apikey: SUPABASE_ANON_KEY }
            : undefined,
          signal: controller.signal,
        });

        const latencyMs = performance.now() - startedAt;
        consecutiveTimeoutsRef.current = 0;

        if (!res.ok) {
          applyStatus('offline');
          return;
        }

        const hint = getImmediateDeviceStatus();
        if (hint === 'offline') {
          applyStatus('offline');
        } else if (hint === 'slow' || latencyMs >= SLOW_LATENCY_MS) {
          applyStatus('slow');
        } else if (latencyMs < HEALTHY_LATENCY_MS) {
          applyStatus('online');
        }
      } catch {
        // If aborted by timeout, connection is stalled/slow first; if immediate network failure
        // (DNS / ERR_INTERNET_DISCONNECTED) or navigator.onLine === false, mark offline at once.
        if (controller.signal.aborted && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
          consecutiveTimeoutsRef.current += 1;
          applyStatus(consecutiveTimeoutsRef.current >= 2 ? 'offline' : 'slow');
        } else {
          applyStatus('offline');
        }
      } finally {
        clearTimeout(timeoutId);
        if (activeController === controller) {
          activeController = null;
        }
        probeInFlightRef.current = false;
      }
    };

    const syncFromDeviceState = () => {
      const immediate = getImmediateDeviceStatus();
      if (immediate === 'offline') {
        applyStatus('offline');
        return;
      }
      if (immediate === 'slow') {
        applyStatus('slow');
      }
      void runConnectivityProbe();
    };

    const handleOffline = () => {
      consecutiveTimeoutsRef.current = 0;
      applyStatus('offline');
    };

    const handleOnline = () => {
      consecutiveTimeoutsRef.current = 0;
      const immediate = getImmediateDeviceStatus();
      applyStatus(immediate ?? 'online');
      void runConnectivityProbe();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncFromDeviceState();
      }
    };

    const handleConnectionChange = () => {
      syncFromDeviceState();
    };

    // Immediate post-hydration device check
    const mountCheckTimer = setTimeout(() => {
      syncFromDeviceState();
    }, 0);

    const intervalId = setInterval(() => {
      void runConnectivityProbe();
    }, PROBE_INTERVAL_MS);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const conn = getNetworkConnection();
    conn?.addEventListener?.('change', handleConnectionChange);

    return () => {
      isMounted = false;
      clearTimeout(mountCheckTimer);
      clearInterval(intervalId);
      activeController?.abort();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      conn?.removeEventListener?.('change', handleConnectionChange);
    };
  }, []);

  const isOffline = status === 'offline';

  return (
    <AnimatePresence>
      {status !== 'online' && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 sm:top-4 inset-x-0 z-[9999] flex justify-center px-4 pointer-events-none select-none print:hidden"
        >
          <motion.div
            key={status}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="w-full max-w-md"
          >
            <div
              className={`relative overflow-hidden rounded-2xl border backdrop-blur-md shadow-xl px-4 py-3 flex items-center gap-3 bg-white/95 ${
                isOffline
                  ? 'border-rose-200 shadow-rose-950/15'
                  : 'border-amber-200 shadow-amber-950/15'
              }`}
            >
              {/* Top Status Accent Strip */}
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 ${
                  isOffline
                    ? 'bg-gradient-to-r from-rose-500 via-red-400 to-rose-500'
                    : 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500'
                }`}
              />

              {/* Status Icon */}
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 relative ${
                  isOffline
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-amber-50 border-amber-200 text-amber-600'
                }`}
              >
                {isOffline ? (
                  <WifiOff className="w-4.5 h-4.5" />
                ) : (
                  <Gauge className="w-4.5 h-4.5" />
                )}
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                    isOffline ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
              </div>

              {/* Info Text Only (No Buttons) */}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs sm:text-sm font-bold leading-tight ${
                    isOffline ? 'text-rose-700' : 'text-amber-800'
                  }`}
                >
                  {isOffline ? 'No internet connection' : 'Slow internet connection'}
                </p>
                <p className="text-[11px] text-[#505F76] leading-snug mt-0.5">
                  {isOffline
                    ? 'Device is offline. Updates will resume when connected.'
                    : 'High latency detected. Loading and syncing may take longer.'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default NetworkStatusBanner;
