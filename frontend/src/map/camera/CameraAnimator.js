
import L from 'leaflet';
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
    this.lastMaxBoundsZoom = 0;
    this.bottomPadding = null;
  }

  setBottomPadding(padding) {
    if (this.bottomPadding !== padding) {
      this.bottomPadding = padding;
      // Force bounds re-fit when bottom padding changes
      this.lastTargetBounds = null;
    }
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
    if (this.map && this.state) {
      this.applyTargets();
    }
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  applyTargets() {
    // Reset monotonic bounds zoom tracker when bounds are cleared
    if (!this.state.targetBounds) {
      this.lastMaxBoundsZoom = 0;
    }

    // 1. Handle Bounds (OVERVIEW, FOLLOW_ROUTE)
    if (this.state.targetBounds) {
      // Prevent spamming fitBounds if bounds haven't changed by deep comparing the array
      const currentBoundsStr = JSON.stringify(this.state.targetBounds);
      if (this.lastTargetBounds !== currentBoundsStr) {
        try {
          const size = this.map.getSize();
          // Ensure map has actual dimensions before fitting bounds
          if (size.x > 0 && size.y > 0) {
            let paddingOpts = CAMERA_CONFIG.BOUNDS.getPaddingOptions(size, this.bottomPadding);
            
            // Intelligent safeguard for mini maps (e.g. RideCard)
            if (size.y < 250 || size.x < 250) {
              paddingOpts = { paddingTopLeft: [15, 15], paddingBottomRight: [15, 15] };
            }

            // Monotonic Zoom Protection during approach:
            // Calculate ideal zoom for these bounds to eliminate zoom flickering/back-jumps on GPS pings
            let calculatedZoom = (this.map.getBoundsZoom && typeof this.map.getBoundsZoom === 'function') 
              ? this.map.getBoundsZoom(this.state.targetBounds, false, paddingOpts) 
              : 18;

            // Distance-scaled adaptive zoom lock for close targets (<350m)
            if (this.state.targetBounds && Array.isArray(this.state.targetBounds) && this.state.targetBounds.length === 2) {
              try {
                const p1 = L.latLng(this.state.targetBounds[0]);
                const p2 = L.latLng(this.state.targetBounds[1]);
                const distMeters = p1.distanceTo(p2);
                if (distMeters < 350) {
                  // Continuous zoom tightening: 350m -> 17.5, 200m -> 18.5, 50m -> 20.0
                  const adaptiveZoom = Math.min(20, Math.max(17.5, 20 - (distMeters / 350) * 2.5));
                  calculatedZoom = Math.max(calculatedZoom, adaptiveZoom);
                }
              } catch (err) {
                // Fallback if coordinates missing
              }
            }

            calculatedZoom = Math.min(calculatedZoom, CAMERA_CONFIG.ZOOM.MAX || 20);

            if (!this.lastMaxBoundsZoom || calculatedZoom >= this.lastMaxBoundsZoom - 0.5) {
              this.lastMaxBoundsZoom = Math.max(this.lastMaxBoundsZoom || 0, calculatedZoom);
            } else {
              // Bounds expanded significantly (e.g. driver turned around/rerouted), allow zoom out
              this.lastMaxBoundsZoom = calculatedZoom;
            }

            this.map.fitBounds(this.state.targetBounds, {
              ...paddingOpts,
              animate: true,
              duration: CAMERA_CONFIG.ANIMATION.DURATION_MS / 1000,
              maxZoom: CAMERA_CONFIG.ZOOM.MAX || 20
            });
            this.lastTargetBounds = currentBoundsStr;
            
            // Clear center/zoom caching since bounds took over
            this.lastTargetCenter = null;
            this.lastTargetZoom = null;
          } else {
            // Map is not ready (0x0). Force Leaflet to recalculate its size so it eventually becomes ready.
            this.map.invalidateSize();
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
      const size = this.map.getSize();
      if (size.x === 0 || size.y === 0) {
        this.map.invalidateSize();
        return;
      }

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
