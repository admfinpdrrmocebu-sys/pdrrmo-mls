'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin,
  LocateFixed,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/button';

export interface LocationAccessModalProps {
  /**
   * Optional callback invoked when location is successfully granted and acquired
   */
  onLocationGranted?: (coords: { latitude: number; longitude: number }) => void;
  /**
   * Optional screen name for contextual messaging
   */
  screenName?: string;
  /**
   * Optional control to manually open the modal (if provided)
   */
  isOpen?: boolean;
  /**
   * Optional callback when modal is closed
   */
  onClose?: () => void;
}

export function LocationAccessModal({
  onLocationGranted,
  screenName = 'PDRRMO Operations',
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: LocationAccessModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<
    'granted' | 'prompt' | 'denied' | 'unsupported' | 'checking'
  >('checking');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Check browser geolocation permission status
  useEffect(() => {
    let isMounted = true;

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      if (isMounted) {
        setPermissionState('unsupported');
        setInternalIsOpen(true);
      }
      return;
    }

    const checkPermission = async () => {
      if ('permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (!isMounted) return;

          const updateStatus = (st: PermissionStatus) => {
            if (st.state === 'granted') {
              setPermissionState('granted');
              setInternalIsOpen(false);
            } else if (st.state === 'denied') {
              setPermissionState('denied');
              setInternalIsOpen(true);
            } else {
              // 'prompt' - User device has not accepted access yet
              setPermissionState('prompt');
              setInternalIsOpen(true);
            }
          };

          updateStatus(status);

          status.onchange = () => {
            if (isMounted) {
              updateStatus(status);
            }
          };
          return;
        } catch {
          // Some browsers throw on permissions.query({ name: 'geolocation' })
        }
      }

      // Fallback: Check if device can get location without showing prompt, or show prompt
      if (isMounted) {
        setPermissionState('prompt');
        setInternalIsOpen(true);
      }
    };

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle requesting geolocation on user button click
  const handleRequestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequesting(false);
        setPermissionState('granted');
        setInternalIsOpen(false);
        if (controlledOnClose) controlledOnClose();
        if (onLocationGranted) {
          onLocationGranted({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      },
      (error) => {
        setIsRequesting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
          setErrorMessage(
            'Location access was denied. Please allow location in your browser address bar settings.'
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMessage(
            'GPS signal unavailable. Please ensure location services are enabled on your device.'
          );
        } else if (error.code === error.TIMEOUT) {
          setErrorMessage('Location request timed out. Please try again.');
        } else {
          setErrorMessage('Unable to acquire location coordinates. Please try again.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
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
  // If controlledIsOpen is provided, use it.
  // Otherwise, only show if permissionState is NOT granted and user has not dismissed in this session.
  const isModalVisible =
    controlledIsOpen !== undefined
      ? controlledIsOpen
      : internalIsOpen && !dismissed && permissionState !== 'granted' && permissionState !== 'checking';

  return (
    <AnimatePresence>
      {isModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl p-6 sm:p-7 overflow-hidden z-10"
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Icon */}
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-xs mb-4 ${
                  permissionState === 'denied'
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-[#004AC6]/10 text-[#004AC6] border-[#004AC6]/20'
                }`}
              >
                {permissionState === 'denied' ? (
                  <AlertCircle className="w-7 h-7" />
                ) : (
                  <LocateFixed className="w-7 h-7" />
                )}
              </div>

              <h3 className="text-lg font-bold text-[#1E293B]">
                {permissionState === 'denied'
                  ? 'Location Access Blocked'
                  : 'Allow Location Access'}
              </h3>

              <p className="text-xs text-[#505F76] mt-1.5 leading-relaxed">
                {permissionState === 'denied'
                  ? `Your device or browser has blocked location access for ${screenName}. Location is required to verify your proximity and attendance.`
                  : `${screenName} requires your device's location to verify station geofencing boundaries, duty rosters, and responder presence.`}
              </p>
            </div>

            {/* Instruction / Information Box */}
            <div className="mt-5 space-y-3">
              {permissionState === 'denied' ? (
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-left space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>How to enable in your browser:</span>
                  </div>
                  <ol className="text-[11px] text-rose-700/90 list-decimal list-inside space-y-1 pl-1">
                    <li>
                      Click the <strong>site settings / lock icon</strong> in your browser address bar.
                    </li>
                    <li>
                      Find <strong>Location</strong> and switch it to <strong>Allow</strong>.
                    </li>
                    <li>
                      Click <strong>Retry Location Access</strong> below.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/70 text-left space-y-1.5">
                  <div className="flex items-center gap-2 text-[#004AC6] font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Secure Geofence Verification</span>
                  </div>
                  <p className="text-[11px] text-[#505F76] leading-relaxed">
                    Your GPS coordinates are never tracked outside active duty hours. Location is only checked to confirm station perimeter clearance.
                  </p>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
              <PrimaryButton
                type="button"
                className="w-full justify-center"
                size="md"
                pill
                onClick={handleRequestLocation}
                disabled={isRequesting}
                leftIcon={
                  permissionState === 'denied' ? (
                    <RefreshCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
                  ) : (
                    <LocateFixed className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
                  )
                }
              >
                {isRequesting
                  ? 'Requesting Access...'
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
