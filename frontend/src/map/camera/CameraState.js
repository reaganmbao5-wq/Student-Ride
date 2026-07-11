import { CAMERA_MODES } from './CameraConfig';

/**
 * CameraState holds the mutable high-frequency state for the camera engine.
 * Keeping this outside of React state prevents unnecessary 60FPS re-renders.
 */
class CameraState {
  constructor() {
    this.mode = CAMERA_MODES.FREE;
    
    // User interaction state
    this.isUserInteracting = false;
    this.lastInteractionTime = 0; // Set to 0 so it's idle by default
    
    // Target state
    this.targetCenter = null;
    this.targetZoom = null;
    this.targetBounds = null;
    
    // Current interpolated state
    this.currentCenter = null;
    this.currentZoom = null;
    
    // Animation tracking
    this.isAnimating = false;
  }

  setMode(newMode) {
    // If the user is actively interacting, we don't switch out of FREE mode immediately,
    // but we can store what the "desired" mode is, or we just temporarily ignore it.
    // For simplicity, we update the mode, but the Controller will handle the pause logic.
    this.mode = newMode;
  }

  markUserInteraction() {
    this.isUserInteracting = true;
    this.lastInteractionTime = Date.now();
  }

  clearUserInteraction() {
    this.isUserInteracting = false;
    this.lastInteractionTime = Date.now();
  }

  isIdle(idleTimeoutMs) {
    if (this.isUserInteracting) return false;
    return (Date.now() - this.lastInteractionTime) > idleTimeoutMs;
  }
}

export const cameraState = new CameraState();
