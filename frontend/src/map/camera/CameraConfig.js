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
    FOLLOW_DRIVER: 18,
    DEFAULT: 15,
    MAX: 18,
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
      // Top padding: 40px (clears top overlay while maximizing map area)
      // Bottom padding: Reserves lower ~28% of container height for sheet handle + 15px buffer
      // Side padding: Dynamic 6% of container width (clamped 20px–40px)
      const topPadding = 40;
      const bottomPadding = Math.round(containerHeight * 0.28) + 15;
      const sidePadding = Math.max(20, Math.min(40, Math.round(containerWidth * 0.06)));

      return {
        paddingTopLeft: [sidePadding, topPadding],
        paddingBottomRight: [sidePadding, bottomPadding]
      };
    }
  }
};
