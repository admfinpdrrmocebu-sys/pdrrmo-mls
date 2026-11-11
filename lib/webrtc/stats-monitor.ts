/**
 * =============================================================================
 * WebRTC getStats() Real-Time Telemetry Monitor
 * =============================================================================
 * Polls RTCPeerConnection.getStats() every second to compute incoming bitrate,
 * packet loss percentage, dropped frames, FPS, jitter, RTT, and resolution.
 */

export type StreamHealthLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface WebRtcTelemetrySnapshot {
  timestamp: number;
  bitrateKbps: number;
  bitrateLabel: string;
  packetLossPct: number;
  packetsReceived: number;
  packetsLost: number;
  framesDropped: number;
  framesDroppedDelta: number;
  framesDecoded: number;
  fps: number;
  width: number;
  height: number;
  resolutionLabel: string;
  jitterMs: number;
  rttMs: number | null;
  codec: string;
  health: StreamHealthLevel;
}

export const INITIAL_TELEMETRY_SNAPSHOT: WebRtcTelemetrySnapshot = {
  timestamp: 0,
  bitrateKbps: 0,
  bitrateLabel: '0 kbps',
  packetLossPct: 0,
  packetsReceived: 0,
  packetsLost: 0,
  framesDropped: 0,
  framesDroppedDelta: 0,
  framesDecoded: 0,
  fps: 0,
  width: 0,
  height: 0,
  resolutionLabel: '—',
  jitterMs: 0,
  rttMs: null,
  codec: 'H.264',
  health: 'offline',
};

export function formatBitrate(kbps: number): string {
  if (!Number.isFinite(kbps) || kbps <= 0) return '0 kbps';
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(2)} Mbps`;
  }
  return `${Math.round(kbps)} kbps`;
}

export function formatResolutionLabel(width: number, height: number): string {
  if (!width || !height) return '—';
  if (height >= 2160) return `4K (${width}×${height})`;
  if (height >= 1440) return `1440p (${width}×${height})`;
  if (height >= 1080) return `1080p (${width}×${height})`;
  if (height >= 720) return `720p (${width}×${height})`;
  if (height >= 480) return `480p (${width}×${height})`;
  if (height >= 360) return `360p (${width}×${height})`;
  return `${width}×${height}`;
}

export function evaluateStreamHealth(
  bitrateKbps: number,
  packetLossPct: number,
  framesDroppedDelta: number
): StreamHealthLevel {
  if (bitrateKbps <= 0) return 'offline';
  if (packetLossPct >= 8 || framesDroppedDelta >= 12) return 'poor';
  if (packetLossPct >= 3 || framesDroppedDelta >= 5) return 'fair';
  if (packetLossPct >= 0.8 || framesDroppedDelta >= 2) return 'good';
  return 'excellent';
}

interface PreviousSampleState {
  timestamp: number;
  bytesReceived: number;
  packetsReceived: number;
  packetsLost: number;
  framesDropped: number;
  framesDecoded: number;
}

/**
 * Creates a stateful `getStats()` poller for an active `RTCPeerConnection`.
 */
export function createStatsPoller(
  pc: RTCPeerConnection,
  videoElement: HTMLVideoElement | null,
  onSnapshot: (snapshot: WebRtcTelemetrySnapshot) => void,
  intervalMs = 1000
): () => void {
  let prev: PreviousSampleState | null = null;
  let stopped = false;

  const poll = async () => {
    if (stopped || pc.connectionState === 'closed') return;

    try {
      const report = await pc.getStats();
      if (stopped) return;

      let nowTs = performance.now();
      let bytesReceived = 0;
      let packetsReceived = 0;
      let packetsLost = 0;
      let framesDropped = 0;
      let framesDecoded = 0;
      let fps = 0;
      let frameWidth = videoElement?.videoWidth || 0;
      let frameHeight = videoElement?.videoHeight || 0;
      let jitterSec = 0;
      let rttSec: number | null = null;
      let codecId: string | null = null;
      const codecsMap = new Map<string, string>();

      report.forEach((stat) => {
        if (stat.type === 'codec' && stat.id && stat.mimeType) {
          const shortCodec = String(stat.mimeType).split('/')[1] || String(stat.mimeType);
          codecsMap.set(stat.id, shortCodec.toUpperCase());
        }

        if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
          nowTs = stat.timestamp || nowTs;
          bytesReceived = stat.bytesReceived ?? 0;
          packetsReceived = stat.packetsReceived ?? 0;
          packetsLost = Math.max(0, stat.packetsLost ?? 0);
          framesDropped = stat.framesDropped ?? 0;
          framesDecoded = stat.framesDecoded ?? 0;
          if (typeof stat.framesPerSecond === 'number') {
            fps = Math.round(stat.framesPerSecond);
          }
          if (typeof stat.frameWidth === 'number' && stat.frameWidth > 0) {
            frameWidth = stat.frameWidth;
          }
          if (typeof stat.frameHeight === 'number' && stat.frameHeight > 0) {
            frameHeight = stat.frameHeight;
          }
          if (typeof stat.jitter === 'number') {
            jitterSec = stat.jitter;
          }
          if (stat.codecId) {
            codecId = stat.codecId;
          }
        }

        if (
          stat.type === 'candidate-pair' &&
          stat.state === 'succeeded' &&
          typeof stat.currentRoundTripTime === 'number'
        ) {
          rttSec = stat.currentRoundTripTime;
        }
      });

      let bitrateKbps = 0;
      let packetLossPct = 0;
      let framesDroppedDelta = 0;

      if (prev && nowTs > prev.timestamp) {
        const elapsedSec = (nowTs - prev.timestamp) / 1000;
        if (elapsedSec > 0) {
          const bytesDelta = Math.max(0, bytesReceived - prev.bytesReceived);
          bitrateKbps = (bytesDelta * 8) / (elapsedSec * 1000);

          const rxDelta = Math.max(0, packetsReceived - prev.packetsReceived);
          const lostDelta = Math.max(0, packetsLost - prev.packetsLost);
          const totalDelta = rxDelta + lostDelta;
          if (totalDelta > 0) {
            packetLossPct = Number(((lostDelta / totalDelta) * 100).toFixed(1));
          }

          framesDroppedDelta = Math.max(0, framesDropped - prev.framesDropped);

          if (!fps && framesDecoded > prev.framesDecoded) {
            fps = Math.round((framesDecoded - prev.framesDecoded) / elapsedSec);
          }
        }
      }

      prev = {
        timestamp: nowTs,
        bytesReceived,
        packetsReceived,
        packetsLost,
        framesDropped,
        framesDecoded,
      };

      const codec = (codecId && codecsMap.get(codecId)) || 'H.264';
      const health = evaluateStreamHealth(
        bitrateKbps,
        packetLossPct,
        framesDroppedDelta
      );

      onSnapshot({
        timestamp: Date.now(),
        bitrateKbps: Math.round(bitrateKbps),
        bitrateLabel: formatBitrate(bitrateKbps),
        packetLossPct,
        packetsReceived,
        packetsLost,
        framesDropped,
        framesDroppedDelta,
        framesDecoded,
        fps,
        width: frameWidth,
        height: frameHeight,
        resolutionLabel: formatResolutionLabel(frameWidth, frameHeight),
        jitterMs: Math.round(jitterSec * 1000),
        rttMs: rttSec !== null ? Math.round(rttSec * 1000) : null,
        codec,
        health,
      });
    } catch {
      // Ignore transient getStats error during renegotiation
    }
  };

  const timer = setInterval(poll, intervalMs);
  poll();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
