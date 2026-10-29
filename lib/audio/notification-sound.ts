// =============================================================================
// NOTIFICATION AUDIO SOUND UTILITY
// =============================================================================
// Plays Notification.wav with audio unlocking for mobile browser autoplay policy.
// =============================================================================

let isAudioUnlocked = false;
let preloadedAudio: HTMLAudioElement | null = null;

/**
 * Initializes and unlocks the audio context on the first user interaction.
 * Modern mobile browsers (iOS Safari, Android Chrome) block programmatic
 * audio playback until at least one user gesture has occurred on the page.
 */
export function initAudioUnlocker(): void {
  if (typeof window === 'undefined' || isAudioUnlocked) return;

  const unlockAudio = () => {
    if (isAudioUnlocked) return;
    try {
      if (!preloadedAudio) {
        preloadedAudio = new Audio('/sfx/Notification.wav');
        preloadedAudio.volume = 0.01;
      }
      const playPromise = preloadedAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (preloadedAudio) {
              preloadedAudio.pause();
              preloadedAudio.currentTime = 0;
              preloadedAudio.volume = 0.9;
            }
            isAudioUnlocked = true;
            removeUnlockListeners();
          })
          .catch(() => {
            // Wait for next interaction
          });
      }
    } catch {
      // Ignore
    }
  };

  const removeUnlockListeners = () => {
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('pointerdown', unlockAudio, { passive: true, once: true });
  window.addEventListener('keydown', unlockAudio, { passive: true, once: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true, once: true });
}

/**
 * Plays the official PDRRMO announcement sound effect (Notification.wav)
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;

  try {
    const audio = new Audio('/sfx/Notification.wav');
    audio.volume = 0.9;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Notification audio playback deferred by browser policy:', err);
      });
    }
  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
}
