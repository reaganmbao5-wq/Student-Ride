import placesData from '../../data/places.json';

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://student-ride-backend-manual.onrender.com";

export const searchAddress = async (query) => {
    if (!query || query.length < 2) return [];

    const searchLower = query.toLowerCase().trim();
    const cacheKey = `search:${searchLower}`;
    const cached = getCached_(cacheKey);
    if (cached) return cached;

    // 1. Instant offline search using local razor-sharp places dataset (works offline in Web & APK)
    if (placesData && Array.isArray(placesData)) {
        const matches = [];
        const seen = new Set();
        
        for (const item of placesData) {
            const nameLower = item.display_name.toLowerCase();
            const catLower = (item.category || '').toLowerCase();
            
            if (nameLower.includes(searchLower) || catLower.includes(searchLower)) {
                if (!seen.has(nameLower)) {
                    seen.add(nameLower);
                    matches.push({
                        lat: String(item.lat),
                        lon: String(item.lon),
                        display_name: item.display_name
                    });
                }
            }
            if (matches.length >= 15) break;
        }

        if (matches.length > 0) {
            cache.set(cacheKey, { timestamp: Date.now(), data: matches });
            return matches;
        }
    }

    // 2. Try online backend API as secondary fallback
    try {
        const localRes = await fetch(`${BACKEND_URL}/api/places/search?q=${encodeURIComponent(query)}`);
        if (localRes.ok) {
            const dbData = await localRes.json();
            if (Array.isArray(dbData) && dbData.length > 0) {
                const seen = new Set();
                const formatted = [];
                for (const item of dbData) {
                    const cleanName = item.display_name ? item.display_name.trim() : '';
                    const key = cleanName.toLowerCase();
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    formatted.push({
                        lat: String(item.lat),
                        lon: String(item.lon),
                        display_name: cleanName
                    });
                }
                if (formatted.length > 0) {
                    cache.set(cacheKey, { timestamp: Date.now(), data: formatted });
                    return formatted;
                }
            }
        }
    } catch (dbErr) {
        console.warn('Local places search warning:', dbErr);
    }

    // 2. Fallback to online Nominatim OSM search
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
