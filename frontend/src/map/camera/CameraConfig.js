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
      // Top padding: 80px to clear floating header while keeping top area clear.
      // Bottom padding: Reserves lower ~42% of container height (matching bottom sheet overlay) + 20px buffer.
      // Side padding: Dynamic 10% of container width (clamped between 30px and 60px) for marker icons.
      const topPadding = 80;
      const bottomPadding = Math.round(containerHeight * 0.42) + 20;
      const sidePadding = Math.max(30, Math.min(60, Math.round(containerWidth * 0.1)));

      return {
        paddingTopLeft: [sidePadding, topPadding],
        paddingBottomRight: [sidePadding, bottomPadding]
      };
    }
  }
};
