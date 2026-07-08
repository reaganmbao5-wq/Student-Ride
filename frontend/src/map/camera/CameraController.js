import { CAMERA_MODES, CAMERA_CONFIG } from './CameraConfig';
import { cameraState } from './CameraState';
import { zoomController } from './ZoomController';
import { followController } from './FollowController';

/**
 * CameraController is the "brain" of the engine.
 * It takes the current inputs (mode, driver location, bounds) and user state,
 * and continuously updates the CameraState with the 'ideal' target.
 */
class CameraController {
  
  update(mode, driverLocation, routeBounds, selectionLocation, map) {
    // 1. Update Mode
    cameraState.setMode(mode);

    // 2. Check for idle timeout (resume auto-follow after user interaction)
    if (cameraState.isUserInteracting) {
      // Do not fight the user
      return;
    }

    if (!cameraState.isIdle(CAMERA_CONFIG.INTERACTION.IDLE_TIMEOUT_MS)) {
      // Still in timeout period, wait for it to elapse before taking over again
      return;
    }

    // 3. Determine ideal zoom
    const idealZoom = zoomController.getIdealZoom(mode);
    if (idealZoom !== null) {
      cameraState.targetZoom = idealZoom;
    }

    // 4. Determine ideal bounds or center based on mode
    switch (mode) {
      case CAMERA_MODES.FOLLOW_DRIVER:
        // Frame both the driver and the target (pickup/dropoff) if bounds exist
        if (routeBounds && routeBounds.length > 1) {
          cameraState.targetBounds = routeBounds;
          cameraState.targetCenter = null;
        } else {
          const driverCenter = followController.getTargetCenter(driverLocation);
          if (driverCenter) {
            // Offset the center slightly South so the car appears higher on the screen
            // Reduced to 0.0004 (approx 45 meters) to be safe at zoom level 18
            cameraState.targetCenter = {
              lat: driverCenter.lat - 0.0004,
              lng: driverCenter.lng
            };
            cameraState.targetBounds = null; // Clear bounds
          }
        }
        break;

      case CAMERA_MODES.PICKUP_SELECTION:
      case CAMERA_MODES.DESTINATION_SELECTION:
        if (selectionLocation) {
          cameraState.targetCenter = selectionLocation;
          cameraState.targetBounds = null;
        }
        break;

      case CAMERA_MODES.FOLLOW_ROUTE:
      case CAMERA_MODES.OVERVIEW:
        if (routeBounds) {
          cameraState.targetBounds = routeBounds;
          cameraState.targetCenter = null; // Bounds override center
        }
        break;

      case CAMERA_MODES.FREE:
      default:
        // Do nothing, let user control
        break;
    }
  }
}

export const cameraController = new CameraController();
