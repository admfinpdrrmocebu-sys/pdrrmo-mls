/**
 * =============================================================================
 * MediaMTX / WHEP WebRTC Client Engine
 * =============================================================================
 * Connects native HTML5 <video> elements directly to MediaMTX (or any RFC-compliant
 * WHEP server) over Tailscale / LAN / Starlink without iframes.
 */

export type WhepConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline';

export interface WhepConnectOptions {
  url: string;
  videoElement: HTMLVideoElement;
  onStatusChange?: (status: WhepConnectionStatus, message?: string) => void;
  onStreamReady?: (stream: MediaStream) => void;
}

export interface WhepSessionHandle {
  pc: RTCPeerConnection;
  activeEndpoint: string;
  disconnect: (clearVideo?: boolean) => void;
}

/**
 * Normalizes a user-provided WebRTC / MediaMTX URL into a valid HTTP(S) WHEP endpoint.
 * If the user pastes a MediaMTX stream base URL (e.g. `http://100.64.0.5:8889/drone1`),
 * this helper automatically appends `/whep`.
 */
export function normalizeWhepUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath.toLowerCase().endsWith('/whep')) {
      parsed.pathname = `${cleanPath}/whep`;
    } else {
      parsed.pathname = cleanPath;
    }
    return parsed.toString();
  } catch {
    return withProtocol;
  }
}

/**
 * Generates suggested Medium and Low bitrate MediaMTX WHEP URLs from a primary URL.
 * Example: `http://100.64.0.5:8889/drone1/whep`
 *   -> med: `http://100.64.0.5:8889/drone1_med/whep`
 *   -> low: `http://100.64.0.5:8889/drone1_low/whep`
 */
export function suggestSubstreamUrls(primaryInput: string): {
  medUrl: string;
  lowUrl: string;
} {
  const normalized = normalizeWhepUrl(primaryInput);
  if (!normalized) return { medUrl: '', lowUrl: '' };

  try {
    const medParsed = new URL(normalized);
    const lowParsed = new URL(normalized);
    const basePath = medParsed.pathname.replace(/\/whep$/i, '').replace(/\/+$/, '');

    if (!basePath || basePath === '') {
      return { medUrl: '', lowUrl: '' };
    }

    medParsed.pathname = `${basePath}_med/whep`;
    lowParsed.pathname = `${basePath}_low/whep`;

    return {
      medUrl: medParsed.toString(),
      lowUrl: lowParsed.toString(),
    };
  } catch {
    return { medUrl: '', lowUrl: '' };
  }
}

/**
 * Waits for ICE candidate gathering to finish or until a short timeout elapses
 * so local & Tailscale WireGuard interface candidates are embedded in the SDP offer.
 */
function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 1200
): Promise<void> {
  if (pc.iceGatheringState === 'complete') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener('icegatheringstatechange', checkState);
      clearTimeout(timer);
      resolve();
    };

    const checkState = () => {
      if (pc.iceGatheringState === 'complete') {
        finish();
      }
    };

    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener('icegatheringstatechange', checkState);
  });
}

/**
 * Establishes a receive-only WebRTC WHEP session with MediaMTX and binds incoming
 * video/audio tracks directly to the provided native HTML5 `<video>` element.
 */
export async function connectWhepStream(
  options: WhepConnectOptions
): Promise<WhepSessionHandle> {
  const { url, videoElement, onStatusChange, onStreamReady } = options;

  const primaryEndpoint = normalizeWhepUrl(url);
  if (!primaryEndpoint) {
    throw new Error('Invalid WebRTC WHEP URL');
  }

  const abortController = new AbortController();
  let sessionResourceUrl: string | null = null;
  let isDisconnecting = false;

  onStatusChange?.('connecting', 'Negotiating WHEP SDP handshake...');

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    bundlePolicy: 'max-bundle',
  });

  // Receive-only transceivers for drone video + optional controller audio
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  const inboundStream = new MediaStream();

  pc.ontrack = (event: RTCTrackEvent) => {
    if (isDisconnecting) return;

    const stream = event.streams && event.streams[0] ? event.streams[0] : inboundStream;
    if (!event.streams || !event.streams[0]) {
      inboundStream.addTrack(event.track);
    }

    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }

    videoElement.play().catch(() => {
      // Autoplay fallback: ensure muted play succeeds if browser blocks unmuted autoplay
      videoElement.muted = true;
      videoElement.play().catch(() => {});
    });

    onStreamReady?.(stream);
    onStatusChange?.('live');
  };

  pc.onconnectionstatechange = () => {
    if (isDisconnecting) return;
    const state = pc.connectionState;
    if (state === 'connected') {
      onStatusChange?.('live');
    } else if (state === 'disconnected') {
      onStatusChange?.('reconnecting', 'Peer link interrupted over VPN/Starlink...');
    } else if (state === 'failed' || state === 'closed') {
      onStatusChange?.('offline', 'WebRTC transport disconnected');
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (isDisconnecting) return;
    const iceState = pc.iceConnectionState;
    if (iceState === 'connected' || iceState === 'completed') {
      onStatusChange?.('live');
    } else if (iceState === 'failed') {
      onStatusChange?.('offline', 'ICE transport failed');
    }
  };

  const disconnect = (clearVideo = false) => {
    if (isDisconnecting) return;
    isDisconnecting = true;
    abortController.abort();

    try {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    } catch {
      // Ignore close errors
    }

    if (sessionResourceUrl) {
      const resourceToClose = sessionResourceUrl;
      sessionResourceUrl = null;
      fetch(resourceToClose, { method: 'DELETE', mode: 'cors' }).catch(() => {});
    }

    if (clearVideo && videoElement) {
      try {
        videoElement.pause();
        videoElement.srcObject = null;
      } catch {
        // Ignore video cleanup errors
      }
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc, 1200);

    const localSdp = pc.localDescription?.sdp;
    if (!localSdp) {
      throw new Error('Failed to generate WebRTC SDP offer');
    }

    let response = await fetch(primaryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        Accept: 'application/sdp',
      },
      body: localSdp,
      signal: abortController.signal,
    });

    let activeEndpoint = primaryEndpoint;

    // Fallback: if `/whep` was auto-appended and returned 404, try raw user URL
    const rawTrimmed = url.trim();
    if (
      response.status === 404 &&
      !rawTrimmed.toLowerCase().endsWith('/whep')
    ) {
      const rawEndpoint = /^https?:\/\//i.test(rawTrimmed)
        ? rawTrimmed
        : `http://${rawTrimmed}`;
      response = await fetch(rawEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          Accept: 'application/sdp',
        },
        body: localSdp,
        signal: abortController.signal,
      });
      activeEndpoint = rawEndpoint;
    }

    if (!response.ok) {
      throw new Error(`MediaMTX WHEP HTTP ${response.status} (${response.statusText || 'Stream Offline'})`);
    }

    const locationHeader = response.headers.get('Location') || response.headers.get('location');
    if (locationHeader) {
      try {
        sessionResourceUrl = new URL(locationHeader, activeEndpoint).toString();
      } catch {
        sessionResourceUrl = null;
      }
    }

    const answerSdp = await response.text();
    if (!answerSdp || !answerSdp.includes('v=0')) {
      throw new Error('Invalid SDP answer from MediaMTX server');
    }

    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      })
    );

    return {
      pc,
      activeEndpoint,
      disconnect,
    };
  } catch (err) {
    disconnect(false);
    const message =
      err instanceof Error ? err.message : 'Unable to reach WebRTC WHEP relay';
    onStatusChange?.('offline', message);
    throw err;
  }
}
