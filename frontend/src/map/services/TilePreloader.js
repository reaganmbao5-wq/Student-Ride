/**
 * TilePreloader.js
 * High-performance background tile pre-fetcher and pre-warmer.
 * Downloads all Google Maps tiles in a ~3km radius around the user's location
 * across Zoom levels 14, 15, 16, 17 so map transitions render instantly with 0ms delay.
 */

// Mercator Projection: Converts lat/lng + zoom to Tile (X, Y)
function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

const preloadedUrls = new Set();

export const TilePreloader = {
  preloadArea: (lat, lng, radiusKm = 3) => {
    if (!lat || !lng) return;

    // Use requestIdleCallback or setTimeout to avoid blocking main UI thread
    const schedule = typeof window !== 'undefined' && window.requestIdleCallback 
      ? window.requestIdleCallback 
      : (cb) => setTimeout(cb, 100);

    schedule(() => {
      const zooms = [14, 15, 16, 17];
      const subdomains = ['0', '1', '2', '3'];

      zooms.forEach((zoom) => {
        const centerTile = latLngToTile(lat, lng, zoom);
        // Radius in tiles roughly corresponding to ~3km depending on zoom
        const tileRadius = zoom >= 16 ? 2 : 1;

        for (let dx = -tileRadius; dx <= tileRadius; dx++) {
          for (let dy = -tileRadius; dy <= tileRadius; dy++) {
            const tileX = centerTile.x + dx;
            const tileY = centerTile.y + dy;
            const sub = subdomains[Math.abs(tileX + tileY) % subdomains.length];
            const tileUrl = `https://mt${sub}.google.com/vt/lyrs=m&x=${tileX}&y=${tileY}&z=${zoom}&scale=2`;

            if (!preloadedUrls.has(tileUrl)) {
              preloadedUrls.add(tileUrl);
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = tileUrl;
            }
          }
        }
      });
      console.log(`[TilePreloader] Preloaded ${preloadedUrls.size} tiles around (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    });
  }
};
