import { CAMERA_MODES, CAMERA_CONFIG } from './CameraConfig';

/**
 * ZoomController handles dynamic zoom calculations based on the active camera mode.
 */
class ZoomController {
  
  /**
   * Determine the ideal zoom level for a given mode.
   * Returns null if the mode should be determined by bounds (e.g. OVERVIEW).
   */
  getIdealZoom(mode) {
    switch (mode) {
      case CAMERA_MODES.PICKUP_SELECTION:
        return CAMERA_CONFIG.ZOOM.PICKUP_SELECTION;
      
      case CAMERA_MODES.DESTINATION_SELECTION:
        return CAMERA_CONFIG.ZOOM.DESTINATION_SELECTION;
      
      case CAMERA_MODES.FOLLOW_DRIVER:
        return CAMERA_CONFIG.ZOOM.FOLLOW_DRIVER;
        
      case CAMERA_MODES.FREE:
        return null; // Let the user dictate zoom
        
      case CAMERA_MODES.FOLLOW_ROUTE:
      case CAMERA_MODES.OVERVIEW:
        return null; // Determined dynamically by fitBounds
        
      default:
        return CAMERA_CONFIG.ZOOM.DEFAULT;
    }
  }

  /**
   * Clamp the zoom to acceptable minimum/maximum values.
   */
  clampZoom(zoom) {
    if (zoom === null || zoom === undefined) return null;
    return Math.max(CAMERA_CONFIG.ZOOM.MIN, Math.min(CAMERA_CONFIG.ZOOM.MAX, zoom));
  }
}

export const zoomController = new ZoomController();
