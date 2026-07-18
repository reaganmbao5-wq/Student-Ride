
import { CAMERA_CONFIG } from './CameraConfig';

/**
 * CameraAnimator translates the 'ideal target' from CameraState 
 * into actual Leaflet map operations, ensuring smooth 60FPS animation.
 */
class CameraAnimator {
  constructor(state) {
    this.state = state;
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
    if (this.map && !this.state.isUserInteracting && this.state.isIdle(CAMERA_CONFIG.INTERACTION.IDLE_TIMEOUT_MS)) {
      this.applyTargets();
    }
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  applyTargets() {
    // 1. Handle Bounds (OVERVIEW, FOLLOW_ROUTE)
    if (this.state.targetBounds) {
      // Prevent spamming fitBounds if bounds haven't changed by deep comparing the array
      const currentBoundsStr = JSON.stringify(this.state.targetBounds);
      if (this.lastTargetBounds !== currentBoundsStr) {
        try {
          const size = this.map.getSize();
          // Ensure map has actual dimensions before fitting bounds
          if (size.x > 0 && size.y > 0) {
            let paddingOpts = CAMERA_CONFIG.BOUNDS.getPaddingOptions();
            
            // Intelligent safeguard for mini maps (e.g. RideCard)
            if (size.y < 250 || size.x < 250) {
              paddingOpts = { paddingTopLeft: [15, 15], paddingBottomRight: [15, 15] };
            }

            this.map.fitBounds(this.state.targetBounds, {
              ...paddingOpts,
              animate: true,
              duration: CAMERA_CONFIG.ANIMATION.DURATION_MS / 1000,
              maxZoom: 15.5
            });
            this.lastTargetBounds = currentBoundsStr;
            
            // Clear center/zoom caching since bounds took over
            this.lastTargetCenter = null;
            this.lastTargetZoom = null;
          } else {
            // Map is not ready (0x0). Do not cache lastTargetBounds so we try again next tick.
          }
        } catch (e) {
          // Leaflet fitBounds can fail if dimensions are zero
        }
      }
      // If we have bounds, we don't try to fly to center/zoom
      return; 
    }

    // 2. Handle Center & Zoom (FOLLOW_DRIVER, PICKUP_SELECTION)
    const hasNewCenter = this.state.targetCenter && 
      (this.lastTargetCenter?.lat !== this.state.targetCenter.lat || 
       this.lastTargetCenter?.lng !== this.state.targetCenter.lng);
       
    const hasNewZoom = this.state.targetZoom && (this.lastTargetZoom !== this.state.targetZoom);

    if (hasNewCenter || hasNewZoom) {
      const currentCenter = this.map.getCenter();
      
      // We only strictly require targetZoom if we are flying, else we use current zoom
      const targetZoom = this.state.targetZoom || this.map.getZoom();

      if (hasNewCenter) {
        // If the new center is very far away, jump. Otherwise smooth animate.
        const dist = currentCenter.distanceTo(this.state.targetCenter);
        if (dist > 15000) {
          // Distance > 15km, teleport instantly
          this.map.flyTo(this.state.targetCenter, targetZoom, {
            animate: false
          });
        } else {
          // Smooth pan
          this.map.setView(this.state.targetCenter, targetZoom, {
            animate: true,
            duration: CAMERA_CONFIG.ANIMATION.DURATION_MS / 1000
          });
        }
        this.lastTargetCenter = this.state.targetCenter;
        this.lastTargetBounds = null; // Bounds invalidated
      } else if (hasNewZoom) {
        // Only zoom changed
        this.map.setZoom(targetZoom, {
          animate: true
        });
      }

      this.lastTargetZoom = targetZoom;
    }
  }
}

export { CameraAnimator };
