import { cameraState } from './CameraState';
import { CAMERA_CONFIG } from './CameraConfig';

/**
 * CameraAnimator translates the 'ideal target' from CameraState 
 * into actual Leaflet map operations, ensuring smooth 60FPS animation.
 */
class CameraAnimator {
  constructor() {
    this.map = null;
    this.animationFrameId = null;
    this.lastTargetCenter = null;
    this.lastTargetBounds = null;
    this.lastTargetZoom = null;
  }

  attach(mapInstance) {
    this.map = mapInstance;
    this.start();
  }

  detach() {
    this.stop();
    this.map = null;
  }

  start() {
    if (!this.animationFrameId) {
      this.tick();
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  tick = () => {
    if (this.map && !cameraState.isUserInteracting && cameraState.isIdle(CAMERA_CONFIG.INTERACTION.IDLE_TIMEOUT_MS)) {
      this.applyTargets();
    }
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  applyTargets() {
    // 1. Handle Bounds (OVERVIEW, FOLLOW_ROUTE)
    if (cameraState.targetBounds) {
      // Prevent spamming fitBounds if bounds haven't changed by deep comparing the array
      const currentBoundsStr = JSON.stringify(cameraState.targetBounds);
      if (this.lastTargetBounds !== currentBoundsStr) {
        try {
          const size = this.map.getSize();
          // Ensure map has actual dimensions before fitting bounds
          if (size.x > 0 && size.y > 0) {
            this.map.fitBounds(cameraState.targetBounds, {
              ...CAMERA_CONFIG.BOUNDS.getPaddingOptions(),
              animate: true,
              duration: CAMERA_CONFIG.ANIMATION.DURATION_MS / 1000,
            });
            this.lastTargetBounds = currentBoundsStr;
            
            // Clear center/zoom caching since bounds took over
            this.lastTargetCenter = null;
            this.lastTargetZoom = null;
          } else {
            // Map is not ready (0x0). Do not cache lastTargetBounds so we try again next tick.
          }
        } catch (e) {
          console.warn("CameraAnimator: Invalid bounds", e);
          // DO NOT cache lastTargetBounds on error, so it can retry if it was a temporary map initialization issue
        }
      }
      return; // Bounds override center/zoom
    }

    // 2. Handle Center & Zoom (FOLLOW_DRIVER, PICKUP_SELECTION)
    const hasNewCenter = cameraState.targetCenter && 
      (this.lastTargetCenter?.lat !== cameraState.targetCenter.lat || 
       this.lastTargetCenter?.lng !== cameraState.targetCenter.lng);
       
    const hasNewZoom = cameraState.targetZoom && (this.lastTargetZoom !== cameraState.targetZoom);

    if (hasNewCenter || hasNewZoom) {
      const targetZoom = cameraState.targetZoom || this.map.getZoom();
      
      if (hasNewCenter) {
        // If center changed, use setView/flyTo or panTo
        // panTo is smoother for continuous tracking (e.g. driver moving)
        this.map.setView(cameraState.targetCenter, targetZoom, {
          animate: true,
          duration: 1.0, // 1 second duration matches our 1Hz driver updates perfectly
          easeLinearity: 0.25
        });
        this.lastTargetCenter = cameraState.targetCenter;
      } else if (hasNewZoom) {
        // Only zoom changed
        this.map.setZoom(targetZoom, { animate: true });
      }
      this.lastTargetZoom = targetZoom;
    }
  }
}

export const cameraAnimator = new CameraAnimator();
