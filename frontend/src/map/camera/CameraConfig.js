export const CAMERA_MODES = {
  FREE: 'FREE',
  FOLLOW_DRIVER: 'FOLLOW_DRIVER',
  FOLLOW_ROUTE: 'FOLLOW_ROUTE',
  PICKUP_SELECTION: 'PICKUP_SELECTION',
  DESTINATION_SELECTION: 'DESTINATION_SELECTION',
  OVERVIEW: 'OVERVIEW',
};

export const CAMERA_CONFIG = {
  ZOOM: {
    PICKUP_SELECTION: 17,
    DESTINATION_SELECTION: 17,
    FOLLOW_DRIVER: 19,
    DEFAULT: 15,
    MAX: 20,
    MIN: 5,
  },
  ANIMATION: {
    DURATION_MS: 1500, // Smooth flyTo duration
    TICK_MS: 1000 / 60, // 60 FPS
  },
  INTERACTION: {
    IDLE_TIMEOUT_MS: 5000, // Wait 5s after user drag before resuming auto-follow
  },
  BOUNDS: {
    getPaddingOptions: (mapSize) => {
      // Derive padding strictly from live map container geometry and viewport dimensions (no static device checks)
      const containerHeight = mapSize && mapSize.y ? mapSize.y : (typeof window !== 'undefined' ? window.innerHeight : 600);
      const containerWidth = mapSize && mapSize.x ? mapSize.x : (typeof window !== 'undefined' ? window.innerWidth : 400);

      // Usable visible viewport padding calculation:
      // Top padding: 30px (clears top overlay while maximizing map area)
      // Bottom padding: Reserves lower ~48% of container height (min 240px) for bottom sheet overlays
      // Side padding: Dynamic 4% of container width (clamped 15px–30px)
      const topPadding = 30;
      const bottomPadding = Math.max(240, Math.round(containerHeight * 0.48));
      const sidePadding = Math.max(15, Math.min(30, Math.round(containerWidth * 0.04)));

      return {
        paddingTopLeft: [sidePadding, topPadding],
        paddingBottomRight: [sidePadding, bottomPadding]
      };
    }
  }
};
