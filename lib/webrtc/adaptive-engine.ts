/**
 * =============================================================================
 * Browser-Side Adaptive Stream Switching (ABR) & Quality Override Engine
 * =============================================================================
 * Evaluates rolling WebRTC `getStats()` telemetry over Starlink / Tailscale VPN
 * and automatically switches between High, Medium, and Low MediaMTX WHEP URLs
 * when in `auto` mode, or locks to a specific tier under Manual Override.
 */

import type { WebRtcTelemetrySnapshot } from './stats-monitor';

export type StreamQualityTier = 'high' | 'medium' | 'low';
export type StreamQualityMode = 'auto' | StreamQualityTier;

export interface StreamTierUrls {
  high: string;
  medium?: string | null;
  low?: string | null;
}

export interface AdaptiveDecision {
  shouldSwitch: boolean;
  nextTier: StreamQualityTier;
  reason: string | null;
}

export const QUALITY_MODE_OPTIONS: {
  value: StreamQualityMode;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: 'auto',
    label: 'Auto',
    shortLabel: 'Auto',
  },
  {
    value: 'high',
    label: '1080p',
    shortLabel: '1080p',
  },
  {
    value: 'medium',
    label: '720p',
    shortLabel: '720p',
  },
  {
    value: 'low',
    label: '480p',
    shortLabel: '480p',
  },
];

export function formatTierBadge(
  mode: StreamQualityMode,
  activeTier: StreamQualityTier
): string {
  const resLabel = activeTier === 'high' ? '1080p' : activeTier === 'medium' ? '720p' : '480p';
  if (mode === 'auto') {
    return `Auto (${resLabel})`;
  }
  return resLabel;
}

/**
 * Resolves the target WHEP URL for a requested tier, gracefully falling back
 * to the closest configured URL if an optional substream URL is not set.
 */
export function resolveTierUrl(
  tier: StreamQualityTier,
  urls: StreamTierUrls
): { url: string; effectiveTier: StreamQualityTier } {
  const high = (urls.high || '').trim();
  const medium = (urls.medium || '').trim();
  const low = (urls.low || '').trim();

  if (tier === 'low') {
    if (low) return { url: low, effectiveTier: 'low' };
    if (medium) return { url: medium, effectiveTier: 'medium' };
    return { url: high, effectiveTier: 'high' };
  }

  if (tier === 'medium') {
    if (medium) return { url: medium, effectiveTier: 'medium' };
    if (low) return { url: low, effectiveTier: 'low' };
    return { url: high, effectiveTier: 'high' };
  }

  return { url: high, effectiveTier: 'high' };
}

/**
 * Returns which quality tiers have distinct URLs configured on a drone stream.
 */
export function getConfiguredTiers(urls: StreamTierUrls): StreamQualityTier[] {
  const tiers: StreamQualityTier[] = ['high'];
  if (urls.medium && urls.medium.trim() && urls.medium.trim() !== urls.high.trim()) {
    tiers.push('medium');
  }
  if (urls.low && urls.low.trim() && urls.low.trim() !== urls.high.trim()) {
    tiers.push('low');
  }
  return tiers;
}

/**
 * Stateful rolling-window evaluator for Dynamic Stream Switching.
 * - Degrades (`high` -> `medium` -> `low`) when 4-second rolling average packet loss > 5%
 *   or frame drop rate > 15% (or >= 8 dropped frames/sec).
 * - Upgrades (`low` -> `medium` -> `high`) when packet loss < 1% and 0 dropped frames
 *   for 15 consecutive seconds.
 */
export class AdaptiveStreamEvaluator {
  private degradedWindow: WebRtcTelemetrySnapshot[] = [];
  private stableSecondCount = 0;
  private lastSwitchAt = 0;
  private readonly cooldownMs = 10_000;

  public reset(): void {
    this.degradedWindow = [];
    this.stableSecondCount = 0;
  }

  public evaluate(
    sample: WebRtcTelemetrySnapshot,
    currentTier: StreamQualityTier,
    urls: StreamTierUrls
  ): AdaptiveDecision {
    const availableTiers = getConfiguredTiers(urls);
    // If only primary URL is configured, no alternate URL exists to switch to
    if (availableTiers.length <= 1) {
      return { shouldSwitch: false, nextTier: currentTier, reason: null };
    }

    const now = Date.now();
    if (now - this.lastSwitchAt < this.cooldownMs) {
      return { shouldSwitch: false, nextTier: currentTier, reason: null };
    }

    // Keep last 4 samples (4-second rolling window)
    this.degradedWindow.push(sample);
    if (this.degradedWindow.length > 4) {
      this.degradedWindow.shift();
    }

    const avgLoss =
      this.degradedWindow.reduce((sum, s) => sum + s.packetLossPct, 0) /
      this.degradedWindow.length;

    const avgDropsPerSec =
      this.degradedWindow.reduce((sum, s) => sum + s.framesDroppedDelta, 0) /
      this.degradedWindow.length;

    const avgFps =
      this.degradedWindow.reduce((sum, s) => sum + (s.fps || 30), 0) /
      this.degradedWindow.length;

    const dropRatioPct = avgFps > 0 ? (avgDropsPerSec / avgFps) * 100 : 0;

    // 1. Check for network degradation (4 full samples required)
    if (
      this.degradedWindow.length >= 4 &&
      (avgLoss > 5 || dropRatioPct > 15 || avgDropsPerSec >= 8)
    ) {
      const nextLower = this.getLowerTier(currentTier, availableTiers);
      if (nextLower !== currentTier) {
        this.lastSwitchAt = now;
        this.reset();
        const label = nextLower === 'high' ? '1080p' : nextLower === 'medium' ? '720p' : '480p';
        const reason =
          avgLoss > 5
            ? `Auto-switched to ${label} (Packet loss ${avgLoss.toFixed(1)}%)`
            : `Auto-switched to ${label} (Frame drops ${Math.round(avgDropsPerSec)}/s)`;
        return {
          shouldSwitch: true,
          nextTier: nextLower,
          reason,
        };
      }
    }

    // 2. Check for network stability to step back up (15 consecutive seconds < 1% loss & 0 drops)
    if (sample.bitrateKbps > 0 && sample.packetLossPct < 1 && sample.framesDroppedDelta === 0) {
      this.stableSecondCount += 1;
    } else {
      this.stableSecondCount = 0;
    }

    if (this.stableSecondCount >= 15 && currentTier !== 'high') {
      const nextHigher = this.getHigherTier(currentTier, availableTiers);
      if (nextHigher !== currentTier) {
        this.lastSwitchAt = now;
        this.reset();
        const label = nextHigher === 'high' ? '1080p' : nextHigher === 'medium' ? '720p' : '480p';
        return {
          shouldSwitch: true,
          nextTier: nextHigher,
          reason: `Link stable · Restored ${label} quality`,
        };
      }
    }

    return { shouldSwitch: false, nextTier: currentTier, reason: null };
  }

  private getLowerTier(
    current: StreamQualityTier,
    available: StreamQualityTier[]
  ): StreamQualityTier {
    if (current === 'high') {
      if (available.includes('medium')) return 'medium';
      if (available.includes('low')) return 'low';
    }
    if (current === 'medium') {
      if (available.includes('low')) return 'low';
    }
    return current;
  }

  private getHigherTier(
    current: StreamQualityTier,
    available: StreamQualityTier[]
  ): StreamQualityTier {
    if (current === 'low') {
      if (available.includes('medium')) return 'medium';
      return 'high';
    }
    if (current === 'medium') {
      return 'high';
    }
    return current;
  }
}
