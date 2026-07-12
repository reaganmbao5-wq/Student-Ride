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
    DESTINATION_SELECTION: 16,
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
    getPaddingOptions: () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const sheetHeight = typeof window !== 'undefined' ? window.innerHeight * (isMobile ? 0.45 : 0.25) : 300;
      return {
        paddingTopLeft: [50, 120], // 50px left, 120px top (avoids back button and top edge)
        paddingBottomRight: [50, sheetHeight + 20] // 50px right, dynamic bottom padding + extra buffer
      };
    }
  }
};
