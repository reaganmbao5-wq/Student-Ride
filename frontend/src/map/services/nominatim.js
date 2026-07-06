// Rate limiting and caching utility for Nominatim

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();

/**
 * Validates cache entries and removes expired ones
 */
const getCached_ = (key) => {
    if (cache.has(key)) {
        const { timestamp, data } = cache.get(key);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
        cache.delete(key);
    }
    return null;
};

export const searchAddress = async (query) => {
    if (!query || query.length < 3) return [];

    const cacheKey = `search:${query.toLowerCase().trim()}`;
    const cached = getCached_(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}&` +
            `format=json&` +
            `limit=5&` +
            `countrycodes=zm&` +
            `viewbox=28.0,14.0,29.0,15.0&` + // Kabwe area
            `bounded=0`,
            { headers: { 'User-Agent': 'MulungushiRides/1.0' } }
        );
        const data = await response.json();
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
    } catch (error) {
        console.error('Nominatim search error:', error);
        return [];
    }
};

export const reverseGeocode = async (lat, lng) => {
    // Round to 4 decimal places (~11m precision) to improve cache hit rate
    const latKey = Number(lat).toFixed(4);
    const lngKey = Number(lng).toFixed(4);
    const cacheKey = `reverse:${latKey},${lngKey}`;

    const cached = getCached_(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'User-Agent': 'MulungushiRides/1.0' } }
        );
        const data = await response.json();
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
    } catch (error) {
        console.error('Nominatim reverse error:', error);
        return null;
    }
};
