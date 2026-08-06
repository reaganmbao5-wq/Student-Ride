import { useEffect, useMemo } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { CameraState } from './CameraState';
import { CameraController } from './CameraController';
import { CameraAnimator } from './CameraAnimator';
import { CAMERA_MODES } from './CameraConfig';

/**
 * CameraEngine
 * 
 * The root component of the camera subsystem. It bridges the React world 
 * with our high-performance non-React controllers.
 * 
 * Props:
 * - mode: One of CAMERA_MODES
 * - driverLocation: {lat, lng} of the active driver (for FOLLOW_DRIVER)
 * - routeBounds: Leaflet LatLngBounds array (for FOLLOW_ROUTE/OVERVIEW)
 * - selectionLocation: {lat, lng} for PICKUP_SELECTION/DESTINATION_SELECTION
 */
const CameraEngine = ({ 
  mode = CAMERA_MODES.FREE, 
  driverLocation = null, 
  routeBounds = null, 
  selectionLocation = null,
  bottomPadding = null
}) => {
  const map = useMap();

  const { cameraState, cameraController, cameraAnimator } = useMemo(() => {
    const state = new CameraState();
    const controller = new CameraController(state);
    const animator = new CameraAnimator(state);
    return { cameraState: state, cameraController: controller, cameraAnimator: animator };
  }, []);

  // 1. Attach/Detach Animator to the Leaflet instance
  useEffect(() => {
    if (!map) return;
    cameraAnimator.attach(map);
    return () => {
      cameraAnimator.detach();
    };
  }, [map, cameraAnimator]);

  // Sync bottomPadding override
  useEffect(() => {
    cameraAnimator.setBottomPadding(bottomPadding);
  }, [bottomPadding, cameraAnimator]);

  // 2. Intercept User Interactions
  useMapEvents({
    dragstart: () => {
      cameraState.markUserInteraction();
    },
    dragend: () => {
      cameraState.clearUserInteraction();
    },
    touchstart: () => {
      cameraState.markUserInteraction();
    },
    touchend: () => {
      cameraState.clearUserInteraction();
    }
  });

  // 3. Orchestrate State Updates
  useEffect(() => {
    cameraController.update(mode, driverLocation, routeBounds, selectionLocation, map);
  }, [mode, driverLocation, routeBounds, selectionLocation, map, cameraController]);

  return null; // The engine renders nothing visually, it purely controls the map camera
};

export default CameraEngine;

