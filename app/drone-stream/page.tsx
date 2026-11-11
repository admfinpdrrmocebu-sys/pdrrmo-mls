'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Drone,
  Plus,
  RefreshCw,
  Maximize2,
  Minimize2,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  GripVertical,
  LayoutGrid,
  Check,
  ChevronDown,
  Loader2,
  Volume2,
  VolumeX,
  Activity,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
  SlidersHorizontal,
  Scan,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePathname } from 'next/navigation';
import { AppLayoutShell } from '@/components/nav-route';
import { getCachedDroneStreams, setCachedDroneStreams } from '@/lib/cache/screen-data-cache';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase/client';
import {
  computeAutoGrid,
  GRID_PRESET_OPTIONS,
  type GridPreset,
  type LayoutProfileKey,
} from '@/lib/projector/auto-grid';
import {
  connectWhepStream,
  normalizeWhepUrl,
  suggestSubstreamUrls,
  type WhepConnectionStatus,
  type WhepSessionHandle,
} from '@/lib/webrtc/whep-client';
import {
  createStatsPoller,
  INITIAL_TELEMETRY_SNAPSHOT,
  type WebRtcTelemetrySnapshot,
} from '@/lib/webrtc/stats-monitor';
import {
  AdaptiveStreamEvaluator,
  formatTierBadge,
  getConfiguredTiers,
  QUALITY_MODE_OPTIONS,
  resolveTierUrl,
  type StreamQualityMode,
  type StreamQualityTier,
  type StreamTierUrls,
} from '@/lib/webrtc/adaptive-engine';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

export interface DroneStreamItem {
  id: string;
  name: string;
  webrtc_url: string;
  webrtc_url_med?: string | null;
  webrtc_url_low?: string | null;
  sort_order: number;
  device_orders?: Partial<Record<LayoutProfileKey, number>>;
  is_active: boolean;
  notes?: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string;
}

const LOCAL_STORAGE_STREAMS_KEY = 'pdrrmo_drone_streams_v1';
const LOCAL_STORAGE_GRID_PRESET_KEY = 'pdrrmo_drone_grid_preset_v1';
const LOCAL_STORAGE_QUALITY_MODE_KEY = 'pdrrmo_drone_quality_modes_v1';
const MAX_AUTO_RETRIES = 5;

// Compact preset options tailored for Drone Operations (Auto, 1×1, 2×1, 2×2, 3×2, 4×2, 3×3)
const DRONE_GRID_PRESETS = GRID_PRESET_OPTIONS.slice(0, 7);

// =============================================================================
// STREAM TILE PLAYER COMPONENT (NATIVE <video> + WHEP + getStats + ABR)
// =============================================================================

interface DroneVideoTileProps {
  stream: DroneStreamItem;
  index: number;
  canManage: boolean;
  isDark: boolean;
  isFocused: boolean;
  isFillViewport: boolean;
  minHeightPx: number;
  isDragging: boolean;
  isDragOver: boolean;
  globalRefreshTick: number;
  initialQualityMode: StreamQualityMode;
  isPageActive?: boolean;
  onQualityModePersist: (streamId: string, mode: StreamQualityMode) => void;
  onLiveStateChange: (streamId: string, isLive: boolean) => void;
  onToggleFocus: (stream: DroneStreamItem) => void;
  onEdit: (stream: DroneStreamItem) => void;
  onDelete: (stream: DroneStreamItem) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragEnd: () => void;
}

function DroneVideoTile({
  stream,
  index,
  canManage,
  isDark,
  isFocused,
  isFillViewport,
  minHeightPx,
  isDragging,
  isDragOver,
  globalRefreshTick,
  initialQualityMode,
  isPageActive = true,
  onQualityModePersist,
  onLiveStateChange,
  onToggleFocus,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: DroneVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<WhepSessionHandle | null>(null);
  const statsCleanupRef = useRef<(() => void) | null>(null);
  const abrEvaluatorRef = useRef<AdaptiveStreamEvaluator>(new AdaptiveStreamEvaluator());
  const qualityMenuRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<WhepConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to MediaMTX WHEP...');
  const [telemetry, setTelemetry] = useState<WebRtcTelemetrySnapshot>(INITIAL_TELEMETRY_SNAPSHOT);

  // Quality mode ('auto' | 'high' | 'medium' | 'low') and currently active tier
  const [qualityMode, setQualityMode] = useState<StreamQualityMode>(initialQualityMode);
  const [activeTier, setActiveTier] = useState<StreamQualityTier>(
    initialQualityMode === 'auto' ? 'high' : initialQualityMode
  );
  const [adaptationNotice, setAdaptationNotice] = useState<string | null>(null);
  const [isQualityDropdownOpen, setIsQualityDropdownOpen] = useState(false);

  // Player UI controls
  const [isMuted, setIsMuted] = useState(true);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover'>('contain');
  const [showStatsHud, setShowStatsHud] = useState(false);
  const [localReconnectTick, setLocalReconnectTick] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const retryCountRef = useRef(0);
  const isRetryingRef = useRef(false);
  const lastGlobalTickRef = useRef(globalRefreshTick);

  // When global toolbar "Reconnect" is triggered, reset auto-reconnect budget
  useEffect(() => {
    if (lastGlobalTickRef.current !== globalRefreshTick) {
      lastGlobalTickRef.current = globalRefreshTick;
      retryCountRef.current = 0;
      setRetryCount(0);
    }
  }, [globalRefreshTick]);

  const tierUrls: StreamTierUrls = useMemo(
    () => ({
      high: stream.webrtc_url,
      medium: stream.webrtc_url_med,
      low: stream.webrtc_url_low,
    }),
    [stream.webrtc_url, stream.webrtc_url_med, stream.webrtc_url_low]
  );

  const configuredTiers = useMemo(() => getConfiguredTiers(tierUrls), [tierUrls]);

  // Auto-mute stream audio when page is in background to prevent sound bleeding
  useEffect(() => {
    if (!isPageActive && !isMuted) {
      setIsMuted(true);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }
  }, [isPageActive, isMuted]);

  // Close quality dropdown on outside click
  useEffect(() => {
    if (!isQualityDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setIsQualityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isQualityDropdownOpen]);

  // Auto-clear adaptation notice after 5 seconds
  useEffect(() => {
    if (!adaptationNotice) return;
    const timer = setTimeout(() => setAdaptationNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [adaptationNotice]);

  // Notify parent when live status changes
  useEffect(() => {
    onLiveStateChange(stream.id, status === 'live');
  }, [stream.id, status, onLiveStateChange]);

  // Resolve target WHEP URL based on activeTier
  const resolvedTarget = useMemo(
    () => resolveTierUrl(activeTier, tierUrls),
    [activeTier, tierUrls]
  );

  // Establish WebRTC WHEP connection & attach getStats() poller
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !resolvedTarget.url) return;

    let cancelled = false;
    let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
    isRetryingRef.current = false;

    const cleanupCurrent = () => {
      if (autoRetryTimer) {
        clearTimeout(autoRetryTimer);
        autoRetryTimer = null;
      }
      if (statsCleanupRef.current) {
        statsCleanupRef.current();
        statsCleanupRef.current = null;
      }
      if (sessionRef.current) {
        sessionRef.current.disconnect(false);
        sessionRef.current = null;
      }
    };

    const handleFailure = (rawMessage?: string) => {
      if (cancelled) return;
      if (isRetryingRef.current) return;
      isRetryingRef.current = true;

      const baseMsg = rawMessage || 'Connection offline';

      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        const nextCount = retryCountRef.current + 1;
        retryCountRef.current = nextCount;
        setRetryCount(nextCount);
        setStatus('reconnecting');
        setStatusMessage(
          `${baseMsg} · Auto-reconnecting (${nextCount}/${MAX_AUTO_RETRIES}) in 5s...`
        );

        if (autoRetryTimer) clearTimeout(autoRetryTimer);
        autoRetryTimer = setTimeout(() => {
          if (!cancelled) {
            setLocalReconnectTick((t) => t + 1);
          }
        }, 5000);
      } else {
        setStatus('offline');
        setStatusMessage(
          `Connection offline · Auto-reconnect stopped after ${MAX_AUTO_RETRIES} attempts. Click Reconnect to restart.`
        );
        if (autoRetryTimer) {
          clearTimeout(autoRetryTimer);
          autoRetryTimer = null;
        }
      }
    };

    const startConnection = async () => {
      cleanupCurrent();
      isRetryingRef.current = false;

      if (retryCountRef.current > 0) {
        setStatus('reconnecting');
        setStatusMessage(
          `Connecting to MediaMTX WHEP (Attempt ${retryCountRef.current}/${MAX_AUTO_RETRIES})...`
        );
      } else {
        setStatus('connecting');
        setStatusMessage('Negotiating WHEP stream...');
      }

      try {
        const session = await connectWhepStream({
          url: resolvedTarget.url,
          videoElement: videoEl,
          onStatusChange: (nextStatus, msg) => {
            if (cancelled) return;

            if (nextStatus === 'live') {
              retryCountRef.current = 0;
              setRetryCount(0);
              isRetryingRef.current = false;
              if (autoRetryTimer) {
                clearTimeout(autoRetryTimer);
                autoRetryTimer = null;
              }
              setStatus('live');
              if (msg) setStatusMessage(msg);
              return;
            }

            if (nextStatus === 'reconnecting') {
              setStatus('reconnecting');
              if (msg) setStatusMessage(msg);
              return;
            }

            if (nextStatus === 'offline') {
              handleFailure(msg);
              return;
            }

            setStatus(nextStatus);
            if (msg) setStatusMessage(msg);
          },
        });

        if (cancelled) {
          session.disconnect(true);
          return;
        }

        sessionRef.current = session;

        // Start 1-second WebRTC getStats() telemetry polling
        statsCleanupRef.current = createStatsPoller(
          session.pc,
          videoEl,
          (snapshot) => {
            if (cancelled) return;
            setTelemetry(snapshot);

            // Evaluate Dynamic Stream Switching when in 'auto' mode
            if (qualityMode === 'auto') {
              const decision = abrEvaluatorRef.current.evaluate(
                snapshot,
                resolvedTarget.effectiveTier,
                tierUrls
              );
              if (decision.shouldSwitch && decision.nextTier !== activeTier) {
                setActiveTier(decision.nextTier);
                if (decision.reason) {
                  setAdaptationNotice(decision.reason);
                }
              }
            }
          },
          1000
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Unable to connect to WHEP stream';
        setTelemetry(INITIAL_TELEMETRY_SNAPSHOT);
        handleFailure(message);
      }
    };

    startConnection();

    return () => {
      cancelled = true;
      cleanupCurrent();
    };
  }, [
    resolvedTarget.url,
    resolvedTarget.effectiveTier,
    qualityMode,
    activeTier,
    tierUrls,
    globalRefreshTick,
    localReconnectTick,
  ]);

  // Handle Manual Quality Override / Auto Mode selection
  const handleSelectQualityMode = (nextMode: StreamQualityMode) => {
    setQualityMode(nextMode);
    onQualityModePersist(stream.id, nextMode);
    abrEvaluatorRef.current.reset();
    setIsQualityDropdownOpen(false);

    retryCountRef.current = 0;
    setRetryCount(0);

    if (nextMode === 'auto') {
      setAdaptationNotice('Dynamic ABR enabled (Auto quality)');
    } else {
      const label = nextMode === 'high' ? '1080p' : nextMode === 'medium' ? '720p' : '480p';
      setActiveTier(nextMode);
      setAdaptationNotice(`Locked quality to ${label}`);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const handleManualReconnect = () => {
    retryCountRef.current = 0;
    setRetryCount(0);
    abrEvaluatorRef.current.reset();
    setLocalReconnectTick((t) => t + 1);
  };

  const statusBadgeConfig = useMemo(() => {
    if (status === 'live') {
      return {
        label: 'LIVE',
        dotClass: 'bg-emerald-400 animate-pulse',
        pillClass: isDark
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (status === 'connecting' || status === 'reconnecting') {
      const isRetry = retryCount > 0;
      return {
        label: isRetry
          ? `RETRYING ${retryCount}/${MAX_AUTO_RETRIES}`
          : status === 'reconnecting'
          ? 'RECONNECTING'
          : 'CONNECTING',
        dotClass: 'bg-amber-400 animate-ping',
        pillClass: isDark
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: retryCount >= MAX_AUTO_RETRIES ? `OFFLINE (${MAX_AUTO_RETRIES}/${MAX_AUTO_RETRIES})` : 'OFFLINE',
      dotClass: 'bg-rose-400',
      pillClass: isDark
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        : 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }, [status, retryCount, isDark]);

  const healthColorClass = useMemo(() => {
    switch (telemetry.health) {
      case 'excellent':
      case 'good':
        return isDark ? 'text-emerald-400' : 'text-emerald-600';
      case 'fair':
        return isDark ? 'text-amber-400' : 'text-amber-600';
      case 'poor':
        return isDark ? 'text-rose-400' : 'text-rose-600';
      default:
        return isDark ? 'text-slate-500' : 'text-slate-400';
    }
  }, [telemetry.health, isDark]);

  return (
    <div
      draggable={!isFocused}
      onDragStart={(e) => onDragStart(e, stream.id)}
      onDragOver={(e) => onDragOver(e, stream.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stream.id)}
      onDragEnd={onDragEnd}
      style={{
        minHeight: isFillViewport ? undefined : `${minHeightPx}px`,
      }}
      className={`group relative rounded-xl overflow-hidden border flex flex-col transition-all select-none ${
        isFillViewport ? 'h-full min-h-0' : ''
      } ${
        isDark
          ? 'bg-[#090D16] border-[#1E293B] shadow-lg shadow-black/40'
          : 'bg-white border-[#CBD5E1] shadow-sm'
      } ${isDragging ? 'opacity-40 scale-[0.99]' : 'opacity-100'} ${
        isDragOver ? 'ring-2 ring-[#004AC6] border-[#004AC6]' : ''
      }`}
    >
      {/* ================================================================= */}
      {/* MINIMALIST STREAM HEADER BAR                                      */}
      {/* ================================================================= */}
      <div
        className={`h-9 px-2.5 flex items-center justify-between gap-2 border-b shrink-0 z-20 ${
          isDark
            ? 'bg-[#0F172A]/95 border-[#1E293B] text-[#F8FAFC]'
            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]'
        }`}
      >
        {/* Left: Drag Handle + Status Badge + Stream Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!isFocused && (
            <div
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-200 shrink-0"
              title="Drag to reorder stream position"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Status Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border shrink-0 ${statusBadgeConfig.pillClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadgeConfig.dotClass}`} />
            {statusBadgeConfig.label}
          </span>

          {/* Stream Name */}
          <span className="text-xs font-bold truncate" title={stream.name}>
            {stream.name}
          </span>

          {/* Compact Real-Time Telemetry Pill (Visible when LIVE) */}
          {status === 'live' && (
            <button
              type="button"
              onClick={() => setShowStatsHud((prev) => !prev)}
              title="Click to toggle detailed WebRTC getStats() overlay"
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <span className={healthColorClass}>●</span>
              <span>{telemetry.bitrateLabel}</span>
              {telemetry.fps > 0 && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{telemetry.fps}fps</span>
                </>
              )}
              <span className="opacity-40">·</span>
              <span
                className={
                  telemetry.packetLossPct > 2
                    ? 'text-amber-400 font-bold'
                    : ''
                }
              >
                {telemetry.packetLossPct.toFixed(1)}% loss
              </span>
            </button>
          )}
        </div>

        {/* Right: Quality Override Selector + Minimal Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quality Mode Override Dropdown */}
          <div ref={qualityMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsQualityDropdownOpen((o) => !o)}
              title="Stream Quality Mode (Auto ABR or Manual Override)"
              className={`h-6 px-2 rounded-md text-[10px] font-bold tracking-wide flex items-center gap-1 border transition-colors cursor-pointer ${
                qualityMode === 'auto'
                  ? isDark
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                    : 'bg-blue-50 text-[#004AC6] border-blue-200 hover:bg-blue-100'
                  : isDark
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <SlidersHorizontal className="w-2.5 h-2.5" />
              <span>{formatTierBadge(qualityMode, resolvedTarget.effectiveTier)}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-75" />
            </button>

            <AnimatePresence>
              {isQualityDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute right-0 top-full mt-1.5 w-32 rounded-xl border shadow-xl p-1 z-50 ${
                    isDark
                      ? 'bg-[#0F172A] border-[#1E293B] text-white'
                      : 'bg-white border-[#E2E8F0] text-[#0F172A]'
                  }`}
                >
                  {QUALITY_MODE_OPTIONS.map((opt) => {
                    const isSelected = qualityMode === opt.value;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectQualityMode(opt.value)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-[#2563EB]/25 text-blue-300 font-bold'
                              : 'bg-blue-50 text-[#004AC6] font-bold'
                            : isDark
                            ? 'hover:bg-slate-800/80 text-slate-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs">{opt.label}</span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 shrink-0 text-[#3B82F6]" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toggle WebRTC getStats() HUD Overlay */}
          <button
            type="button"
            onClick={() => setShowStatsHud((prev) => !prev)}
            title="Toggle WebRTC getStats() Telemetry HUD"
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              showStatsHud
                ? isDark
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-blue-50 text-[#004AC6]'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          {/* Audio Mute / Unmute */}
          <button
            type="button"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute stream audio' : 'Mute stream audio'}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              !isMuted
                ? isDark
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-emerald-50 text-emerald-700'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Aspect Fit / Cover Toggle */}
          <button
            type="button"
            onClick={() =>
              setObjectFit((prev) => (prev === 'contain' ? 'cover' : 'contain'))
            }
            title={
              objectFit === 'contain'
                ? 'Switch to Fill/Cover video fit'
                : 'Switch to Contain (Full Frame) video fit'
            }
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
          </button>

          {/* Reconnect Stream */}
          <button
            type="button"
            onClick={handleManualReconnect}
            title={
              retryCount >= MAX_AUTO_RETRIES
                ? 'Auto-reconnect stopped after 5 attempts. Click to restart reconnection'
                : 'Reconnect WebRTC WHEP stream (resets 5 auto attempts)'
            }
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              retryCount >= MAX_AUTO_RETRIES
                ? 'bg-rose-500/20 text-rose-400 animate-pulse border border-rose-500/30'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Focus / Maximize Stream */}
          <button
            type="button"
            onClick={() => onToggleFocus(stream)}
            title={isFocused ? 'Restore Multi-Stream Grid' : 'Maximize this Drone Stream'}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isFocused
                ? 'bg-[#004AC6] text-white'
                : isDark
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
            }`}
          >
            {isFocused ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Edit / Delete (Full Access only) */}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => onEdit(stream)}
                title="Edit WebRTC Link & Quality URLs"
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isDark
                    ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                    : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(stream)}
                title="Remove Drone Stream"
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isDark
                    ? 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400'
                    : 'hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* NATIVE HTML5 <video> VIEWPORT (ZERO IFRAMES)                      */}
      {/* ================================================================= */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-[#05080F] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className={`w-full h-full ${
            objectFit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />

        {/* Dynamic Stream Switching Notification Banner */}
        <AnimatePresence>
          {adaptationNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-slate-900/90 border border-blue-500/40 text-blue-200 text-[11px] font-semibold shadow-lg backdrop-blur-md flex items-center gap-1.5 pointer-events-none"
            >
              <Sparkles className="w-3 h-3 text-blue-400 shrink-0" />
              <span>{adaptationNotice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WebRTC getStats() Real-Time Telemetry HUD Overlay */}
        <AnimatePresence>
          {showStatsHud && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-3 left-3 z-20 w-64 rounded-xl bg-slate-950/85 border border-slate-800/90 p-3 text-slate-200 shadow-2xl backdrop-blur-md text-[11px] font-mono space-y-2"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-blue-400" />
                  WebRTC getStats()
                </span>
                <button
                  type="button"
                  onClick={() => setShowStatsHud(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Bitrate
                  </span>
                  <span className="font-bold text-white">{telemetry.bitrateLabel}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Packet Loss
                  </span>
                  <span
                    className={`font-bold ${
                      telemetry.packetLossPct > 5
                        ? 'text-rose-400'
                        : telemetry.packetLossPct > 1
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {telemetry.packetLossPct.toFixed(1)}% ({telemetry.packetsLost})
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Dropped Frames
                  </span>
                  <span
                    className={`font-bold ${
                      telemetry.framesDroppedDelta > 0
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {telemetry.framesDropped} (+{telemetry.framesDroppedDelta}/s)
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Resolution · FPS
                  </span>
                  <span className="font-bold text-slate-200">
                    {telemetry.width && telemetry.height
                      ? `${telemetry.width}×${telemetry.height}`
                      : '—'}{' '}
                    {telemetry.fps ? `@ ${telemetry.fps}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Jitter / RTT
                  </span>
                  <span className="text-slate-300">
                    {telemetry.jitterMs}ms /{' '}
                    {telemetry.rttMs !== null ? `${telemetry.rttMs}ms` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-sans uppercase">
                    Active Tier
                  </span>
                  <span className="text-blue-300 font-bold">
                    {formatTierBadge(qualityMode, resolvedTarget.effectiveTier)}
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 truncate">
                WHEP: {normalizeWhepUrl(resolvedTarget.url)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom-left subtle Stream Watermark & Quick Unmute Pill when LIVE */}
        {status === 'live' && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10">
            <div className="px-2 py-0.5 rounded bg-black/55 backdrop-blur-xs text-[10px] font-mono text-slate-300 border border-white/10">
              CH {String(index + 1).padStart(2, '0')} ·{' '}
              {telemetry.resolutionLabel !== '—'
                ? telemetry.resolutionLabel.split(' ')[0]
                : 'WebRTC'}
            </div>

            {isMuted && (
              <button
                type="button"
                onClick={handleToggleMute}
                className="pointer-events-auto px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 text-white text-[10px] font-semibold border border-white/15 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <VolumeX className="w-3 h-3 text-amber-400" />
                <span>Muted · Click to Unmute</span>
              </button>
            )}
          </div>
        )}

        {/* Connecting / Reconnecting / Offline Minimal Overlay */}
        {status !== 'live' && (
          <div className="absolute inset-0 bg-[#05080F]/90 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center z-10">
            {status === 'connecting' || status === 'reconnecting' ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center mb-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
                <p className="text-xs font-bold text-white">{stream.name}</p>
                <p className="text-[11px] text-slate-300 mt-1 max-w-xs leading-normal">
                  {statusMessage}
                </p>
                {retryCount > 0 && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      Attempt {retryCount} of {MAX_AUTO_RETRIES}
                    </span>
                    <button
                      type="button"
                      onClick={handleManualReconnect}
                      className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Skip wait timer and reconnect immediately"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Retry Now</span>
                    </button>
                  </div>
                )}
                <span className="mt-2.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 max-w-xs truncate">
                  {normalizeWhepUrl(resolvedTarget.url)}
                </span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mb-3">
                  <WifiOff className="w-5 h-5 text-rose-400" />
                </div>
                <p className="text-xs font-bold text-white">{stream.name}</p>
                <p className="text-[11px] text-slate-300 mt-1 max-w-xs leading-normal">
                  {retryCount >= MAX_AUTO_RETRIES
                    ? `Auto-reconnect stopped after ${MAX_AUTO_RETRIES} failed attempts. Please check drone power, MediaMTX relay, or Starlink VPN.`
                    : statusMessage || 'Awaiting MediaMTX WebRTC feed over Tailscale...'}
                </p>
                <span className="mt-2 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 max-w-xs truncate">
                  {normalizeWhepUrl(resolvedTarget.url)}
                </span>
                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualReconnect}
                    className="px-3.5 py-1.5 rounded-lg bg-[#004AC6] hover:bg-[#003896] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{retryCount >= MAX_AUTO_RETRIES ? 'Reconnect (Restart 5 Attempts)' : 'Retry Link'}</span>
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onEdit(stream)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit URL</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN DRONE STREAM CONSOLE PAGE
// =============================================================================

export default function DroneStreamPage() {
  const { profile, canWrite } = useAuth();
  const { isDark } = useTheme();
  const canManageStreams = canWrite('Drone Stream');

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const isPageActive = pathname === '/drone-stream' || pathname?.startsWith('/drone-stream/');

  // Stream list state (hydrated synchronously from in-memory cache)
  const initialCachedStreams = getCachedDroneStreams();
  const [streams, setStreams] = useState<DroneStreamItem[]>(() => initialCachedStreams || []);
  const [isLoading, setIsLoading] = useState(!initialCachedStreams);
  const [globalRefreshTick, setGlobalRefreshTick] = useState(0);
  const [liveMap, setLiveMap] = useState<Record<string, boolean>>({});

  // Per-stream persisted quality mode ('auto' | 'high' | 'medium' | 'low')
  const [qualityModes, setQualityModes] = useState<Record<string, StreamQualityMode>>({});

  // Viewport & Auto-Grid layout state (mirrors screen-projector/page.tsx)
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [gridPreset, setGridPreset] = useState<GridPreset>('auto');
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);

  // Drag-and-drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<DroneStreamItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [primaryUrlInput, setPrimaryUrlInput] = useState('');
  const [medUrlInput, setMedUrlInput] = useState('');
  const [lowUrlInput, setLowUrlInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [showAdvancedTiers, setShowAdvancedTiers] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation modal
  const [deletingStream, setDeletingStream] = useState<DroneStreamItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load saved grid preset & quality modes from localStorage
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem(LOCAL_STORAGE_GRID_PRESET_KEY) as GridPreset | null;
      if (savedPreset && GRID_PRESET_OPTIONS.some((o) => o.value === savedPreset)) {
        setGridPreset(savedPreset);
      }
      const savedModes = localStorage.getItem(LOCAL_STORAGE_QUALITY_MODE_KEY);
      if (savedModes) {
        const parsed = JSON.parse(savedModes);
        if (parsed && typeof parsed === 'object') {
          setQualityModes(parsed);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleSelectGridPreset = (preset: GridPreset) => {
    setGridPreset(preset);
    setIsGridMenuOpen(false);
    try {
      localStorage.setItem(LOCAL_STORAGE_GRID_PRESET_KEY, preset);
    } catch {
      // Ignore storage errors
    }
  };

  const handlePersistQualityMode = useCallback(
    (streamId: string, mode: StreamQualityMode) => {
      setQualityModes((prev) => {
        const next = { ...prev, [streamId]: mode };
        try {
          localStorage.setItem(LOCAL_STORAGE_QUALITY_MODE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    },
    []
  );

  const handleLiveStateChange = useCallback((streamId: string, isLive: boolean) => {
    setLiveMap((prev) => {
      if (prev[streamId] === isLive) return prev;
      return { ...prev, [streamId]: isLive };
    });
  }, []);

  // Track viewport size for responsive auto-layout
  useEffect(() => {
    const updateSize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Track Fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // LocalStorage helpers
  const loadLocalStreams = useCallback((): DroneStreamItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_STREAMS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const saveLocalStreams = useCallback((items: DroneStreamItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_STREAMS_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Fetch Drone Streams from Supabase (with seamless localStorage fallback)
  const fetchStreams = useCallback(async () => {
    if (!getCachedDroneStreams() && streams.length === 0) {
      setIsLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('drone_streams')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && data) {
        const mapped: DroneStreamItem[] = data.map((row: Record<string, unknown>, idx: number) => ({
          id: String(row.id),
          name: String(row.name || 'Drone Feed'),
          webrtc_url: String(row.webrtc_url || ''),
          webrtc_url_med: row.webrtc_url_med ? String(row.webrtc_url_med) : null,
          webrtc_url_low: row.webrtc_url_low ? String(row.webrtc_url_low) : null,
          sort_order: typeof row.sort_order === 'number' ? row.sort_order : idx,
          device_orders:
            row.device_orders && typeof row.device_orders === 'object'
              ? (row.device_orders as Partial<Record<LayoutProfileKey, number>>)
              : {},
          is_active: row.is_active !== false,
          notes: row.notes ? String(row.notes) : null,
          created_by: row.created_by ? String(row.created_by) : null,
          created_by_name: row.created_by_name ? String(row.created_by_name) : null,
          created_at: String(row.created_at || new Date().toISOString()),
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
        }));
        setStreams(mapped);
        saveLocalStreams(mapped);
        setCachedDroneStreams(mapped);
        setIsLoading(false);
        return;
      }
      const local = loadLocalStreams();
      setStreams(local);
      setCachedDroneStreams(local);
    } catch {
      const local = loadLocalStreams();
      setStreams(local);
      setCachedDroneStreams(local);
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalStreams, saveLocalStreams]);

  useEffect(() => {
    fetchStreams();

    const channelName = `drone-streams-console-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drone_streams' },
        () => {
          fetchStreams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStreams]);

  // Compute Auto-Grid Layout based on active stream count
  const focusedStream = useMemo(
    () => streams.find((s) => s.id === focusedStreamId) || null,
    [streams, focusedStreamId]
  );

  const visibleStreamsBase = useMemo(
    () => (focusedStream ? [focusedStream] : streams),
    [focusedStream, streams]
  );

  const autoGrid = useMemo(() => {
    const effectivePreset: GridPreset = focusedStream ? '1x1' : gridPreset;
    return computeAutoGrid(
      viewport.width,
      viewport.height,
      visibleStreamsBase.length,
      effectivePreset
    );
  }, [viewport.width, viewport.height, visibleStreamsBase.length, gridPreset, focusedStream]);

  // Sort streams by per-device profile order
  const orderedStreams = useMemo(() => {
    const profileKey = autoGrid.profileKey;
    return [...visibleStreamsBase].sort((a, b) => {
      const orderA = a.device_orders?.[profileKey] ?? a.sort_order;
      const orderB = b.device_orders?.[profileKey] ?? b.sort_order;
      if (orderA !== orderB) return orderA - orderB;
      return a.sort_order - b.sort_order;
    });
  }, [visibleStreamsBase, autoGrid.profileKey]);

  const liveCount = useMemo(
    () => streams.filter((s) => liveMap[s.id]).length,
    [streams, liveMap]
  );

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (gridContainerRef.current?.requestFullscreen) {
          await gridContainerRef.current.requestFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen permission errors
    }
  };

  // Drag & Drop Reordering
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const profileKey = autoGrid.profileKey;
    const currentOrdered = [...orderedStreams];
    const fromIndex = currentOrdered.findIndex((s) => s.id === draggedId);
    const toIndex = currentOrdered.findIndex((s) => s.id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }

    const [moved] = currentOrdered.splice(fromIndex, 1);
    currentOrdered.splice(toIndex, 0, moved);

    const updatedOrderMap = new Map<string, number>();
    currentOrdered.forEach((item, idx) => {
      updatedOrderMap.set(item.id, idx);
    });

    const nextStreams = streams.map((item) => {
      const newOrder = updatedOrderMap.get(item.id);
      if (newOrder === undefined) return item;
      return {
        ...item,
        sort_order: newOrder,
        device_orders: {
          ...(item.device_orders || {}),
          [profileKey]: newOrder,
        },
      };
    });

    setStreams(nextStreams);
    saveLocalStreams(nextStreams);
    setCachedDroneStreams(nextStreams);
    setDraggedId(null);

    try {
      await Promise.all(
        nextStreams.map((item) =>
          supabase
            .from('drone_streams')
            .update({
              sort_order: item.sort_order,
              device_orders: item.device_orders || {},
            })
            .eq('id', item.id)
        )
      );
    } catch {
      // Local order already updated
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Modal Open / Save / Delete Handlers
  const openAddModal = () => {
    setEditingStream(null);
    setNameInput('');
    setPrimaryUrlInput('');
    setMedUrlInput('');
    setLowUrlInput('');
    setNotesInput('');
    setShowAdvancedTiers(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (stream: DroneStreamItem) => {
    setEditingStream(stream);
    setNameInput(stream.name);
    setPrimaryUrlInput(stream.webrtc_url);
    setMedUrlInput(stream.webrtc_url_med || '');
    setLowUrlInput(stream.webrtc_url_low || '');
    setNotesInput(stream.notes || '');
    setShowAdvancedTiers(Boolean(stream.webrtc_url_med || stream.webrtc_url_low));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAutoFillSubstreams = () => {
    if (!primaryUrlInput.trim()) {
      setFormError('Enter the Primary WebRTC / WHEP URL first to auto-generate substream paths.');
      return;
    }
    const suggested = suggestSubstreamUrls(primaryUrlInput);
    if (suggested.medUrl) setMedUrlInput(suggested.medUrl);
    if (suggested.lowUrl) setLowUrlInput(suggested.lowUrl);
    setShowAdvancedTiers(true);
    setFormError(null);
  };

  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = nameInput.trim();
    const cleanPrimary = normalizeWhepUrl(primaryUrlInput);
    const cleanMed = medUrlInput.trim() ? normalizeWhepUrl(medUrlInput) : null;
    const cleanLow = lowUrlInput.trim() ? normalizeWhepUrl(lowUrlInput) : null;
    const cleanNotes = notesInput.trim() || null;

    if (!cleanName) {
      setFormError('Please enter a drone or camera stream name.');
      return;
    }
    if (!cleanPrimary) {
      setFormError('Please enter a valid MediaMTX WebRTC / WHEP link.');
      return;
    }

    try {
      new URL(cleanPrimary);
    } catch {
      setFormError('Please enter a valid URL (e.g. http://100.64.0.10:8889/drone1/whep).');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingStream) {
        const updatedItem: DroneStreamItem = {
          ...editingStream,
          name: cleanName,
          webrtc_url: cleanPrimary,
          webrtc_url_med: cleanMed,
          webrtc_url_low: cleanLow,
          notes: cleanNotes,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('drone_streams')
          .update({
            name: cleanName,
            webrtc_url: cleanPrimary,
            webrtc_url_med: cleanMed,
            webrtc_url_low: cleanLow,
            notes: cleanNotes,
            updated_by: profile?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingStream.id);

        const nextList = streams.map((s) =>
          s.id === editingStream.id ? updatedItem : s
        );
        setStreams(nextList);
        saveLocalStreams(nextList);
        setCachedDroneStreams(nextList);
      } else {
        const nextOrder = streams.length;
        const defaultOrders: Partial<Record<LayoutProfileKey, number>> = {
          mobile: nextOrder,
          tablet: nextOrder,
          desktop: nextOrder,
          led_wall: nextOrder,
        };

        const newItem: DroneStreamItem = {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `drone-${Date.now()}`,
          name: cleanName,
          webrtc_url: cleanPrimary,
          webrtc_url_med: cleanMed,
          webrtc_url_low: cleanLow,
          sort_order: nextOrder,
          device_orders: defaultOrders,
          is_active: true,
          notes: cleanNotes,
          created_by: profile?.id || null,
          created_by_name: profile?.full_name || 'Duty Officer',
          created_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from('drone_streams')
          .insert({
            name: cleanName,
            webrtc_url: cleanPrimary,
            webrtc_url_med: cleanMed,
            webrtc_url_low: cleanLow,
            sort_order: nextOrder,
            device_orders: defaultOrders,
            is_active: true,
            notes: cleanNotes,
            created_by: profile?.id || null,
            created_by_name: profile?.full_name || 'Duty Officer',
          })
          .select('*')
          .single();

        if (!error && data) {
          newItem.id = String(data.id);
        }

        const nextList = [...streams, newItem];
        setStreams(nextList);
        saveLocalStreams(nextList);
        setCachedDroneStreams(nextList);
      }

      setIsModalOpen(false);
      setEditingStream(null);
    } catch {
      setFormError('Unable to save drone stream configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStream) return;
    setIsDeleting(true);

    try {
      await supabase.from('drone_streams').delete().eq('id', deletingStream.id);
      const nextList = streams.filter((s) => s.id !== deletingStream.id);
      setStreams(nextList);
      saveLocalStreams(nextList);
      setCachedDroneStreams(nextList);
      if (focusedStreamId === deletingStream.id) {
        setFocusedStreamId(null);
      }
      setDeletingStream(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayoutShell
      title="Drone Stream"
      subtitle="MediaMTX WebRTC Live Feeds"
      screen="Drone Stream"
      className="max-w-none px-2 sm:px-3 md:px-4 py-2 pb-2"
    >
      <div className="flex flex-col gap-2 w-full">
        {/* ================================================================= */}
        {/* 1. COMPACT MINIMALIST TOP CONTROL BAR                             */}
        {/* ================================================================= */}
        <header
          className={`h-12 px-3 sm:px-4 rounded-xl border flex items-center justify-between gap-2 shrink-0 z-30 transition-colors shadow-2xs ${
            isDark
              ? 'bg-[#0B1120] border-[#1E293B] text-[#F8FAFC]'
              : 'bg-white border-[#E2E8F0] text-[#0F172A]'
          }`}
        >
          {/* Left: Brand Icon + Title + Live Telemetry Summary */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#004AC6] flex items-center justify-center text-white shadow-xs shrink-0">
              <Drone className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                Drone Stream
              </h1>

              {/* Active / Live Counter Badge */}
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  liveCount > 0
                    ? isDark
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isDark
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    liveCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {liveCount}/{streams.length} Live
              </span>

              {/* Stack Indicator Pill */}
              <span
                className={`hidden xl:inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                  isDark
                    ? 'bg-slate-900 text-slate-400 border-slate-800'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <Wifi className="w-3 h-3 text-blue-500" />
                MediaMTX · WHEP · Native &lt;video&gt;
              </span>
            </div>
          </div>

          {/* Right: Auto-Layout Selector + Reconnect All + Fullscreen + Add Link */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {focusedStream && (
              <button
                type="button"
                onClick={() => setFocusedStreamId(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Focus</span>
              </button>
            )}

            {/* Grid Layout Preset Selector (Auto, 1×1, 2×1, 2×2, 3×2) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsGridMenuOpen((o) => !o)}
                className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#0F172A] border-[#1E293B] text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-50 border-[#CBD5E1] text-slate-700 hover:bg-slate-100'
                }`}
                title="Grid Layout Mode (Auto-adjusts 1×1 for 1 stream, 2×1 for 2 streams)"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span className="hidden sm:inline">Layout:</span>
                <span className="font-bold">
                  {gridPreset === 'auto'
                    ? `Auto (${autoGrid.cols}×${autoGrid.rows})`
                    : gridPreset.replace('x', '×')}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              <AnimatePresence>
                {isGridMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className={`absolute right-0 top-full mt-1.5 w-44 rounded-xl border shadow-xl p-1.5 z-50 ${
                      isDark
                        ? 'bg-[#0F172A] border-[#1E293B] text-white'
                        : 'bg-white border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    {DRONE_GRID_PRESETS.map((opt) => {
                      const active = gridPreset === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectGridPreset(opt.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#004AC6] text-white'
                              : isDark
                              ? 'hover:bg-slate-800 text-slate-200'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reconnect All Streams */}
            {streams.length > 0 && (
              <button
                type="button"
                onClick={() => setGlobalRefreshTick((t) => t + 1)}
                title="Reconnect all WebRTC streams"
                className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#0F172A] border-[#1E293B] text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-50 border-[#CBD5E1] text-slate-700 hover:bg-slate-100'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reconnect</span>
              </button>
            )}

            {/* Global Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen View'}
              className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#0F172A] border-[#1E293B] text-slate-200 hover:bg-slate-800'
                  : 'bg-slate-50 border-[#CBD5E1] text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">
                {isFullscreen ? 'Exit Full' : 'Fullscreen'}
              </span>
            </button>

            {/* Add WebRTC Link Button */}
            {canManageStreams && (
              <button
                type="button"
                onClick={openAddModal}
                className="h-8 px-3 rounded-lg bg-[#004AC6] hover:bg-[#003896] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add WebRTC Link</span>
              </button>
            )}
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. ADAPTIVE MULTI-STREAM VIDEO CANVAS                             */}
        {/* ================================================================= */}
        <div
          ref={gridContainerRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-[999] w-screen h-screen bg-[#060911] p-2 overflow-auto group/fs'
              : `w-full relative ${
                  autoGrid.fillViewport
                    ? 'lg:h-[calc(100dvh-140px)] min-h-[420px]'
                    : 'min-h-[calc(100dvh-140px)]'
                }`
          }
        >
          {isFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="fixed top-3 right-3 z-[1010] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-slate-700/80 text-xs font-semibold shadow-xl opacity-0 hover:opacity-100 focus:opacity-100 group-hover/fs:opacity-80 transition-opacity cursor-pointer backdrop-blur-sm"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Exit Fullscreen</span>
            </button>
          )}

          {isLoading ? (
            <div className="w-full h-full min-h-[380px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#004AC6] animate-spin" />
              <p className="text-xs font-semibold text-slate-400">
                Initializing WebRTC Drone Stream Console...
              </p>
            </div>
          ) : orderedStreams.length === 0 ? (
            /* Clean Minimal Empty State */
            <div className="w-full h-full min-h-[380px] flex items-center justify-center p-4">
              <div
                className={`max-w-md w-full rounded-2xl border p-7 text-center shadow-sm ${
                  isDark
                    ? 'bg-[#0B1120]/90 border-[#1E293B]'
                    : 'bg-white border-[#E2E8F0]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#004AC6]/10 border border-[#004AC6]/25 flex items-center justify-center mx-auto mb-4 text-[#3B82F6]">
                  <Drone className="w-6 h-6" />
                </div>
                <h2 className="text-base font-extrabold tracking-tight">
                  No Active Drone WebRTC Streams
                </h2>
                <p
                  className={`text-xs mt-1.5 leading-relaxed ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Connect your Raspberry Pi MediaMTX relay over Tailscale VPN. Streams play
                  natively inside hardware-accelerated HTML5{' '}
                  <code className="px-1 py-0.5 rounded bg-slate-500/15 font-mono">
                    &lt;video&gt;
                  </code>{' '}
                  elements with real-time <code className="font-mono">getStats()</code>{' '}
                  monitoring and dynamic quality switching.
                </p>

                <div
                  className={`mt-4 p-3 rounded-xl border text-left text-[11px] font-mono space-y-1 ${
                    isDark
                      ? 'bg-[#060911] border-slate-800 text-slate-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
                    Example MediaMTX WHEP Endpoint
                  </div>
                  <div className="truncate text-blue-400">
                    http://100.x.y.z:8889/drone1/whep
                  </div>
                </div>

                {canManageStreams && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="mt-5 w-full py-2.5 px-4 rounded-xl bg-[#004AC6] hover:bg-[#003896] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Add WebRTC Link</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Auto-Layout Video Grid (1 stream -> 1×1, 2 streams -> 2×1, etc.) */
            <div
              style={{
                gridTemplateColumns: `repeat(${autoGrid.cols}, minmax(0, 1fr))`,
                ...(autoGrid.fillViewport
                  ? {
                      gridTemplateRows: `repeat(${autoGrid.rows}, minmax(0, 1fr))`,
                      height: '100%',
                    }
                  : {
                      gridAutoRows: `${autoGrid.minRowHeightPx}px`,
                    }),
              }}
              className="grid gap-2.5 w-full h-full"
            >
              {orderedStreams.map((stream, index) => (
                <DroneVideoTile
                  key={stream.id}
                  stream={stream}
                  index={index}
                  canManage={canManageStreams}
                  isDark={isDark}
                  isFocused={focusedStreamId === stream.id}
                  isFillViewport={autoGrid.fillViewport}
                  minHeightPx={autoGrid.minRowHeightPx}
                  isDragging={draggedId === stream.id}
                  isDragOver={dragOverId === stream.id}
                  globalRefreshTick={globalRefreshTick}
                  initialQualityMode={qualityModes[stream.id] || 'auto'}
                  isPageActive={isPageActive}
                  onQualityModePersist={handlePersistQualityMode}
                  onLiveStateChange={handleLiveStateChange}
                  onToggleFocus={(item) =>
                    setFocusedStreamId((prev) => (prev === item.id ? null : item.id))
                  }
                  onEdit={openEditModal}
                  onDelete={(item) => setDeletingStream(item)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* ADD / EDIT WEBRTC STREAM MODAL                                    */}
        {/* ================================================================= */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.16 }}
                className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${
                  isDark
                    ? 'bg-[#0F172A] border-[#1E293B] text-white'
                    : 'bg-white border-[#E2E8F0] text-[#0F172A]'
                }`}
              >
                {/* Modal Header */}
                <div
                  className={`px-5 py-4 border-b flex items-center justify-between ${
                    isDark ? 'border-[#1E293B]' : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#004AC6] text-white flex items-center justify-center">
                      <Drone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold">
                        {editingStream ? 'Edit Drone WebRTC Stream' : 'Add Drone WebRTC Link'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        MediaMTX WHEP stream played directly in native &lt;video&gt;
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSaveStream} className="p-5 space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Drone / Stream Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Drone / Camera Label
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Drone 1 — Alpha Recon"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004AC6] ${
                        isDark
                          ? 'bg-[#090D16] border-[#1E293B] text-white placeholder:text-slate-500'
                          : 'bg-slate-50 border-[#CBD5E1] text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  {/* Primary High-Quality WebRTC / WHEP Link */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Primary WebRTC / WHEP URL (High Quality)
                      </label>
                      <span className="text-[10px] font-mono text-blue-400">
                        Auto-appends /whep
                      </span>
                    </div>
                    <input
                      type="text"
                      value={primaryUrlInput}
                      onChange={(e) => setPrimaryUrlInput(e.target.value)}
                      placeholder="http://100.64.0.10:8889/drone1/whep"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#004AC6] ${
                        isDark
                          ? 'bg-[#090D16] border-[#1E293B] text-white placeholder:text-slate-500'
                          : 'bg-slate-50 border-[#CBD5E1] text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  {/* Dynamic Stream Switching Tiers (Medium & Low WHEP URLs) */}
                  <div
                    className={`rounded-xl border p-3.5 space-y-3 ${
                      isDark
                        ? 'bg-[#090D16]/70 border-[#1E293B]'
                        : 'bg-slate-50/80 border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAdvancedTiers((prev) => !prev)}
                          className="text-xs font-bold flex items-center gap-1.5 cursor-pointer text-left"
                        >
                          <Radio className="w-3.5 h-3.5 text-blue-400" />
                          <span>Dynamic Stream Switching Tiers (Optional)</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${
                              showAdvancedTiers ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Used by Auto ABR & Manual Override to switch quality over Starlink
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleAutoFillSubstreams}
                        className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[10px] font-bold shrink-0 cursor-pointer transition-colors"
                      >
                        Auto-fill _med / _low
                      </button>
                    </div>

                    {showAdvancedTiers && (
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Medium Quality WHEP URL (720p Substream)
                          </label>
                          <input
                            type="text"
                            value={medUrlInput}
                            onChange={(e) => setMedUrlInput(e.target.value)}
                            placeholder="http://100.64.0.10:8889/drone1_med/whep"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#004AC6] ${
                              isDark
                                ? 'bg-[#0F172A] border-[#1E293B] text-white placeholder:text-slate-600'
                                : 'bg-white border-[#CBD5E1] text-slate-900 placeholder:text-slate-400'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Low Quality WHEP URL (480p Starlink Saver)
                          </label>
                          <input
                            type="text"
                            value={lowUrlInput}
                            onChange={(e) => setLowUrlInput(e.target.value)}
                            placeholder="http://100.64.0.10:8889/drone1_low/whep"
                            className={`w-full px-3 py-2 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#004AC6] ${
                              isDark
                                ? 'bg-[#0F172A] border-[#1E293B] text-white placeholder:text-slate-600'
                                : 'bg-white border-[#CBD5E1] text-slate-900 placeholder:text-slate-400'
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        isDark
                          ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-xl bg-[#004AC6] hover:bg-[#003896] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingStream ? 'Save Changes' : 'Connect Stream'}</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================================================================= */}
        {/* DELETE STREAM CONFIRMATION MODAL                                  */}
        {/* ================================================================= */}
        <AnimatePresence>
          {deletingStream && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${
                  isDark
                    ? 'bg-[#0F172A] border-[#1E293B] text-white'
                    : 'bg-white border-[#E2E8F0] text-[#0F172A]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Remove Drone Stream?</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Disconnect and remove{' '}
                      <span className="font-bold text-slate-200">
                        {deletingStream.name}
                      </span>
                      ?
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeletingStream(null)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Remove</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayoutShell>
  );
}
