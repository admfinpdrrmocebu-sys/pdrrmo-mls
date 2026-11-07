'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  LocateFixed,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  X,
  Lock,
  Globe,
  Smartphone,
  Laptop,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';

export interface LocationAccessModalProps {
  /**
   * Optional callback invoked when location is successfully granted and acquired
   */
  onLocationGranted?: (coords: { latitude: number; longitude: number }) => void;
  /**
   * Optional callback invoked when browser location permission state changes in realtime
   */
  onLocationStateChange?: (state: 'granted' | 'prompt' | 'denied') => void;
  /**
   * Optional screen name for contextual messaging
   */
  screenName?: string;
  /**
   * Optional control to manually open the modal / banner (if provided)
   */
  isOpen?: boolean;
  /**
   * Optional callback when modal / banner is closed
   */
  onClose?: () => void;
  /**
   * Display style: 'banner' (top notification banner) | 'modal' (center popup dialog)
   * Defaults to 'banner' for universal cross-browser prompt friendliness.
   */
  variant?: 'banner' | 'modal';
}

export type SupportedBrowser =
  | 'safari-mac'
  | 'safari-ios'
  | 'firefox'
  | 'edge'
  | 'brave'
  | 'chrome'
  | 'android';

/**
 * Universal browser and platform detection utility
 */
export function detectBrowserAndPlatform(): SupportedBrowser {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'chrome';

  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator.platform === 'string' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);

  if (isIOS) return 'safari-ios';

  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return 'android';

  // Brave Browser detection
  const isBrave =
    typeof (navigator as any).brave?.isBrave === 'function' || /Brave/i.test(ua);
  if (isBrave) return 'brave';

  const isFirefox = /Firefox/i.test(ua);
  if (isFirefox) return 'firefox';

  const isEdge = /Edg/i.test(ua);
  if (isEdge) return 'edge';

  const isChrome = /Chrome|CriOS/i.test(ua) && !isEdge;
  const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge && !isFirefox;
  if (isSafari) return 'safari-mac';

  return 'chrome';
}

export function LocationAccessModal({
  onLocationGranted,
  onLocationStateChange,
  screenName = 'PDRRMO Operations',
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  variant = 'banner',
}: LocationAccessModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unsupported' | 'insecure' | 'checking'
  >('checking');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [justGranted, setJustGranted] = useState<boolean>(false);
  const [showUnblockHelpModal, setShowUnblockHelpModal] = useState<boolean>(false);

  // Detected browser & manual override browser tab in instructions
  const [detectedBrowser, setDetectedBrowser] = useState<SupportedBrowser>('chrome');
  const [selectedInstructionBrowser, setSelectedInstructionBrowser] =
    useState<SupportedBrowser>('chrome');

  useEffect(() => {
    const detected = detectBrowserAndPlatform();
    setDetectedBrowser(detected);
    setSelectedInstructionBrowser(detected);
  }, []);

  // Check browser geolocation permission status across all browser engines
  useEffect(() => {
    let isMounted = true;

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      if (isMounted) {
        setPermissionState('unsupported');
        setInternalIsOpen(true);
      }
      return;
    }

    // Insecure context check (HTTP non-localhost blocks geolocation silently on Safari/Firefox/Chrome)
    if ('isSecureContext' in window && !window.isSecureContext) {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalhost) {
        if (isMounted) {
          setPermissionState('insecure');
          setInternalIsOpen(true);
        }
        return;
      }
    }

    const checkPermissionCrossBrowser = async () => {
      // 1. Tier 1: Try modern Permissions API (Supported by Chrome, Edge, newer Firefox)
      if ('permissions' in navigator && typeof navigator.permissions?.query === 'function') {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (!isMounted) return;

          const handlePermStatus = (st: PermissionStatus) => {
            onLocationStateChange?.(st.state as 'granted' | 'prompt' | 'denied');
            if (st.state === 'granted') {
              setPermissionState('granted');
              setInternalIsOpen(false);
              try {
                localStorage.setItem('pdrrmo_location_granted', 'true');
              } catch {}
            } else if (st.state === 'denied') {
              setPermissionState('denied');
              setInternalIsOpen(true);
            } else {
              // 'prompt' - User device has not accepted access yet
              setPermissionState('prompt');
              setInternalIsOpen(true);
            }
          };

          handlePermStatus(status);

          status.onchange = () => {
            if (isMounted) {
              handlePermStatus(status);
            }
          };
          return;
        } catch {
          // Safari and WebKit engines reject permissions.query({ name: 'geolocation' }) with a TypeError.
          // Gracefully continue to Tier 2 silent probing below.
        }
      }

      // 2. Tier 2: WebKit / Safari / Legacy Fallback
      // If the user previously granted location, probe silently using cached coordinates
      let hasCachedGrant = false;
      try {
        hasCachedGrant = localStorage.getItem('pdrrmo_location_granted') === 'true';
      } catch {}

      if (hasCachedGrant) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMounted) return;
            setPermissionState('granted');
            setInternalIsOpen(false);
            onLocationGranted?.({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          (err) => {
            if (!isMounted) return;
            if (err.code === err.PERMISSION_DENIED) {
              setPermissionState('denied');
              setInternalIsOpen(true);
            } else {
              setPermissionState('prompt');
              setInternalIsOpen(true);
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: Infinity,
          }
        );
        return;
      }

      // 3. Tier 3: First-time prompt required
      if (isMounted) {
        setPermissionState('prompt');
        setInternalIsOpen(true);
      }
    };

    checkPermissionCrossBrowser();

    return () => {
      isMounted = false;
    };
  }, [onLocationGranted]);

  // Request location directly inside explicit user click gesture
  // This guarantees Edge, Firefox, Safari Mac/iOS, Brave, and Android/Samsung will pop up their native permission prompt banner!
  const handleRequestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    const handleSuccess = (position: GeolocationPosition) => {
      setIsRequesting(false);
      setJustGranted(true);
      setPermissionState('granted');
      try {
        localStorage.setItem('pdrrmo_location_granted', 'true');
      } catch {}

      if (onLocationGranted) {
        onLocationGranted({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }

      // Auto-hide banner after brief confirmation animation
      setTimeout(() => {
        setInternalIsOpen(false);
        if (controlledOnClose) controlledOnClose();
      }, 1400);
    };

    const handleFinalError = (error: GeolocationPositionError) => {
      setIsRequesting(false);
      if (error.code === error.PERMISSION_DENIED) {
        onLocationStateChange?.('denied');
        setPermissionState('denied');
        setErrorMessage(
          'Location access was blocked. Please allow location in your browser address bar.'
        );
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        setErrorMessage(
          'GPS signal unavailable. Please ensure location services are enabled in device settings.'
        );
      } else if (error.code === error.TIMEOUT) {
        setErrorMessage(
          'Location request timed out. Please check your network/GPS connection and try again.'
        );
      } else {
        setErrorMessage('Unable to acquire location coordinates. Please try again.');
      }
    };

    // Phase 1: High Accuracy GPS (Satellites + Wi-Fi) with 8s timeout
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (phase1Error) => {
        // Fallback to Phase 2: Standard Wi-Fi / Cell tower positioning
        if (
          phase1Error.code === phase1Error.TIMEOUT ||
          phase1Error.code === phase1Error.POSITION_UNAVAILABLE
        ) {
          navigator.geolocation.getCurrentPosition(handleSuccess, handleFinalError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          });
        } else {
          handleFinalError(phase1Error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 15000,
      }
    );
  }, [controlledOnClose, onLocationGranted]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setInternalIsOpen(false);
    if (controlledOnClose) {
      controlledOnClose();
    }
  }, [controlledOnClose]);

  // Determine visibility:
  const isVisible =
    controlledIsOpen !== undefined
      ? controlledIsOpen
      : internalIsOpen &&
        !dismissed &&
        permissionState !== 'granted' &&
        permissionState !== 'checking';

  // Instructions rendered per browser
  const browserInstructions = useMemo(() => {
    switch (selectedInstructionBrowser) {
      case 'safari-mac':
        return [
          {
            step: 'In the top macOS menu bar, click Safari → Settings (or Preferences).',
          },
          {
            step: 'Select the Websites tab at the top, then click Location in the left sidebar.',
          },
          {
            step: 'Find this website in the list and change its permission from Deny to Allow.',
            tip: 'Tip: You can also right-click the Safari address bar and choose "Settings for This Website...".',
          },
          {
            step: 'Click "Retry Location Access" below.',
          },
        ];
      case 'safari-ios':
        return [
          {
            step: 'Tap the "aA" or page settings icon on the left side of the Safari address bar.',
          },
          {
            step: 'Tap "Website Settings" in the popup menu.',
          },
          {
            step: 'Tap "Location" and change it to "Allow".',
            tip: 'If still blocked, check iPhone Settings → Privacy & Security → Location Services → Safari Websites.',
          },
          {
            step: 'Tap Done, then click "Retry Location Access" below.',
          },
        ];
      case 'firefox':
        return [
          {
            step: 'Click the crossed-out location or permissions shield icon to the left of the URL in the address bar.',
          },
          {
            step: 'Click the "✕" button next to "Blocked" or "Blocked Temporarily" under Permissions.',
          },
          {
            step: 'Click "Retry Location Access" below (or refresh the page).',
          },
        ];
      case 'edge':
        return [
          {
            step: 'Click the Lock / Site Permissions icon in the Microsoft Edge address bar.',
          },
          {
            step: 'Locate "Location" and switch it to "Allow" (or click "Reset permissions").',
          },
          {
            step: 'Click "Retry Location Access" below.',
          },
        ];
      case 'brave':
        return [
          {
            step: 'Click the Brave Lion / Shields icon or the Tune icon to the left of the address bar.',
          },
          {
            step: 'Find "Location" under Site Settings and toggle to "Allow".',
            tip: 'If Brave Shields is set to aggressive fingerprint blocking, allow location specifically for this site.',
          },
          {
            step: 'Click "Retry Location Access" below.',
          },
        ];
      case 'android':
        return [
          {
            step: 'Tap the Lock or tune icon in the Chrome / Samsung Internet address bar.',
          },
          {
            step: 'Tap "Permissions", then toggle "Location" to ON.',
            tip: 'Ensure Android system Location is turned on in your phone swipe-down Quick Settings.',
          },
          {
            step: 'Click "Retry Location Access" below.',
          },
        ];
      case 'chrome':
      default:
        return [
          {
            step: 'Click the Tune / Padlock icon on the left side of your browser address bar.',
          },
          {
            step: 'Find "Location" and toggle the switch to "Allow" (or click "Reset permission").',
          },
          {
            step: 'Click "Retry Location Access" below.',
          },
        ];
    }
  }, [selectedInstructionBrowser]);

  return (
    <>
      {/* =========================================================================
       * 1. TOP NOTIFICATION BANNER (Default variant="banner")
       * ========================================================================= */}
      {variant === 'banner' && (
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="fixed top-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-2xl sm:w-full z-50 pointer-events-auto"
              role="alert"
              aria-live="polite"
            >
              <div
                className={`relative rounded-2xl shadow-2xl backdrop-blur-md border p-3.5 sm:p-4 overflow-hidden transition-all duration-200 ${
                  justGranted
                    ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-300 dark:border-emerald-800'
                    : permissionState === 'denied' || permissionState === 'insecure'
                    ? 'bg-rose-50/95 dark:bg-slate-900/95 border-rose-300 dark:border-rose-900/60 shadow-rose-950/15'
                    : 'bg-white/95 dark:bg-slate-900/95 border-blue-200/90 dark:border-blue-800/80 shadow-blue-950/20'
                }`}
              >
                {/* Top Accent Gradient Line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    justGranted
                      ? 'bg-emerald-500'
                      : permissionState === 'denied' || permissionState === 'insecure'
                      ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500'
                      : 'bg-gradient-to-r from-[#004AC6] via-sky-400 to-[#004AC6]'
                  }`}
                />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5">
                  {/* Left: Icon & Text */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 sm:mt-0 ${
                        justGranted
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-200'
                          : permissionState === 'denied' || permissionState === 'insecure'
                          ? 'bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900'
                          : 'bg-blue-50 dark:bg-blue-950/60 text-[#004AC6] dark:text-sky-400 border-blue-200/80 dark:border-blue-800 relative'
                      }`}
                    >
                      {justGranted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : permissionState === 'denied' || permissionState === 'insecure' ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <>
                          <LocateFixed className="w-5 h-5" />
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900 animate-ping" />
                        </>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            justGranted
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : permissionState === 'denied'
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-[#004AC6] dark:text-sky-400'
                          }`}
                        >
                          {justGranted
                            ? 'Location Verified'
                            : permissionState === 'denied'
                            ? 'Location Access Blocked'
                            : permissionState === 'insecure'
                            ? 'HTTPS Required'
                            : 'Location Access Notification'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">•</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {screenName}
                        </span>
                      </div>

                      <p className="text-xs text-[#1E293B] dark:text-slate-200 font-medium leading-snug mt-0.5">
                        {justGranted
                          ? 'GPS coordinates successfully acquired and station perimeter clearance verified.'
                          : permissionState === 'denied'
                          ? 'Location permission was blocked in your browser. Click "How to Unblock" or retry below.'
                          : permissionState === 'insecure'
                          ? 'Modern browsers (Safari, Chrome, Firefox, Brave) restrict Geolocation to secure HTTPS links.'
                          : 'Allow location access so this browser can verify station geofence boundaries and duty rosters.'}
                      </p>

                      {errorMessage && !justGranted && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{errorMessage}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    {permissionState === 'denied' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowUnblockHelpModal(true)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100/80 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>How to Unblock</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRequestLocation}
                          disabled={isRequesting}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#004AC6] hover:bg-[#003EA8] text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRequesting ? 'animate-spin' : ''}`} />
                          <span>{isRequesting ? 'Checking...' : 'Retry'}</span>
                        </button>
                      </>
                    ) : justGranted ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-3 py-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleRequestLocation}
                          disabled={isRequesting || permissionState === 'insecure'}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#004AC6] hover:bg-[#003EA8] active:bg-[#002F82] text-white shadow-sm shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 flex-1 sm:flex-initial"
                        >
                          {isRequesting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Prompting Browser...</span>
                            </>
                          ) : (
                            <>
                              <LocateFixed className="w-3.5 h-3.5" />
                              <span>Allow Location Access</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleDismiss}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                          aria-label="Dismiss banner"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* =========================================================================
       * 2. CENTER MODAL (variant="modal" or fallback dialog)
       * ========================================================================= */}
      {variant === 'modal' && (
        <AnimatePresence>
          {isVisible && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleDismiss}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 max-h-[92vh] flex flex-col"
              >
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="overflow-y-auto custom-scrollbar pr-1 -mr-1">
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xs mb-4 ${
                        permissionState === 'denied' || permissionState === 'insecure'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                          : 'bg-[#004AC6]/10 text-[#004AC6] dark:text-blue-400 border-[#004AC6]/20 dark:border-blue-500/30'
                      }`}
                    >
                      {permissionState === 'denied' || permissionState === 'insecure' ? (
                        <AlertCircle className="w-7 h-7" />
                      ) : (
                        <LocateFixed className="w-7 h-7" />
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-[#1E293B] dark:text-slate-100">
                      {permissionState === 'denied'
                        ? 'Location Access Blocked'
                        : permissionState === 'insecure'
                        ? 'Secure Connection Required'
                        : 'Allow Location Access'}
                    </h3>

                    <p className="text-xs text-[#505F76] dark:text-slate-400 mt-1.5 leading-relaxed max-w-sm">
                      {permissionState === 'denied'
                        ? `Your browser or device has blocked location access for ${screenName}. Location is required to verify your geofencing perimeter and responder clearance.`
                        : permissionState === 'insecure'
                        ? 'Modern browsers (Safari, Chrome, Firefox, Brave) restrict Geolocation to secure HTTPS connections or localhost.'
                        : `${screenName} requires your device's location to verify station geofencing boundaries, duty rosters, and active attendance.`}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-left space-y-1.5">
                      <div className="flex items-center gap-2 text-[#004AC6] dark:text-blue-400 font-bold text-xs">
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Universal Cross-Browser Geolocation</span>
                      </div>
                      <p className="text-[11px] text-[#505F76] dark:text-slate-400 leading-relaxed">
                        Optimized for Microsoft Edge, Mozilla Firefox, Apple Safari (macOS &amp; iOS),
                        Brave Browser, Google Chrome, and Android / Samsung Internet.
                      </p>
                    </div>

                    {errorMessage && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
                    <PrimaryButton
                      type="button"
                      className="w-full justify-center"
                      size="md"
                      pill
                      onClick={handleRequestLocation}
                      disabled={isRequesting || permissionState === 'insecure'}
                      leftIcon={
                        permissionState === 'denied' ? (
                          <RefreshCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
                        ) : (
                          <LocateFixed className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
                        )
                      }
                    >
                      {isRequesting
                        ? 'Prompting Browser...'
                        : permissionState === 'denied'
                        ? 'Retry Location Access'
                        : 'Allow Location Access'}
                    </PrimaryButton>

                    <SecondaryButton
                      type="button"
                      className="w-full sm:w-auto justify-center shrink-0"
                      size="md"
                      pill
                      onClick={handleDismiss}
                    >
                      Continue Anyway
                    </SecondaryButton>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}

      {/* =========================================================================
       * 3. HELPER MODAL: HOW TO UNBLOCK LOCATION PER BROWSER
       * ========================================================================= */}
      <AnimatePresence>
        {showUnblockHelpModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnblockHelpModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <button
                type="button"
                onClick={() => setShowUnblockHelpModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close unblock help modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] dark:text-white">
                    How to Allow Location Access
                  </h3>
                  <p className="text-xs text-[#505F76] dark:text-slate-400">
                    Select your browser below for step-by-step unblocking steps.
                  </p>
                </div>
              </div>

              {/* Browser Selector Pill Switcher */}
              <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('edge')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'edge'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Edge
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('firefox')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'firefox'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Firefox
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('brave')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'brave'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Brave
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('safari-mac')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'safari-mac'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Safari Mac
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('safari-ios')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'safari-ios'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  iOS
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('android')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'android'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Android
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInstructionBrowser('chrome')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    selectedInstructionBrowser === 'chrome'
                      ? 'bg-[#004AC6] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  Chrome
                </button>
              </div>

              {/* Instructions List */}
              <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 overflow-y-auto custom-scrollbar flex-1">
                <ol className="text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside space-y-2 leading-relaxed">
                  {browserInstructions.map((item, idx) => (
                    <li key={idx} className="font-medium">
                      <span>{item.step}</span>
                      {item.tip && (
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 ml-4">
                          {item.tip}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong>System Location Services:</strong> Ensure that your operating system's
                  master location toggle is turned ON (Windows Settings → Privacy → Location, macOS
                  System Settings → Privacy &amp; Security → Location Services, or iOS / Android
                  Settings).
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnblockHelpModal(false);
                    handleRequestLocation();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#004AC6] hover:bg-[#003EA8] text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Location Access</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Export both names for maximum convenience across codebase
export const LocationAccessBanner = LocationAccessModal;
export default LocationAccessModal;
