import { CAMERA_MODES, CAMERA_CONFIG } from './CameraConfig';
import { zoomController } from './ZoomController';
import { followController } from './FollowController';

/**
 * CameraController is the "brain" of the engine.
 * It takes the current inputs (mode, driver location, bounds) and user state,
 * and continuously updates the CameraState with the 'ideal' target.
 */
class CameraController {
  constructor(state) {
    this.state = state;
  }
  
  update(mode, driverLocation, routeBounds, selectionLocation, map) {
    const modeChanged = this.state.mode !== mode;
    // 1. Update Mode
    this.state.setMode(mode);

    // Reset interaction block whenever mode changes OR when a new selectionLocation is chosen from search
    const selectionChanged = selectionLocation && 
      (!this.lastSelectionLoc || 
       this.lastSelectionLoc.lat !== selectionLocation.lat || 
       this.lastSelectionLoc.lng !== selectionLocation.lng);

    if (modeChanged || selectionChanged) {
      if (selectionChanged) {
        this.lastSelectionLoc = selectionLocation;
      }
      this.state.resetInteraction();
    }

    // 2. Check for idle timeout (resume auto-follow after user interaction)
    if (this.state.isUserInteracting) {
      // Do not fight the user during active drag/touch
      return;
    }

    if (!selectionChanged && !this.state.isIdle(CAMERA_CONFIG.INTERACTION.IDLE_TIMEOUT_MS)) {
      // Still in timeout period for passive follow modes, wait for it to elapse
      return;
    }

    // 3. Determine ideal zoom
    const idealZoom = zoomController.getIdealZoom(mode);
    if (idealZoom !== null) {
      this.state.targetZoom = idealZoom;
    }

    // 4. Determine ideal bounds or center based on mode
    switch (mode) {
      case CAMERA_MODES.FOLLOW_DRIVER:
        // Frame both the driver and the target (pickup/dropoff) if bounds exist
        if (routeBounds && routeBounds.length > 1) {
          this.state.targetBounds = routeBounds;
          this.state.targetCenter = null;
        } else {
          const driverCenter = followController.getTargetCenter(driverLocation);
          if (driverCenter) {
            const containerHeight = map && map.getSize ? map.getSize().y : (typeof window !== 'undefined' ? window.innerHeight : 600);
            const offset = 0.0006 * (600 / Math.max(containerHeight, 300));
            
            this.state.targetCenter = {
              lat: driverCenter.lat - offset,
              lng: driverCenter.lng
            };
            this.state.targetBounds = null; // Clear bounds
          }
        }
        break;

      case CAMERA_MODES.PICKUP_SELECTION:
      case CAMERA_MODES.DESTINATION_SELECTION:
        if (selectionLocation) {
          this.state.targetCenter = selectionLocation;
          this.state.targetBounds = null;
        }
        break;

      case CAMERA_MODES.FOLLOW_ROUTE:
      case CAMERA_MODES.OVERVIEW:
        if (routeBounds) {
          this.state.targetBounds = routeBounds;
          this.state.targetCenter = null; // Bounds override center
        }
        break;

      case CAMERA_MODES.FREE:
      default:
        // Do nothing, let user control
        break;
    }
  }
}

export { CameraController };
