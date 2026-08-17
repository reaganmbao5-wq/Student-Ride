import placesData from '../../data/places.json';
import finalPlaces from '../../data/final_places.json';

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

export const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const cleanAddressString = (rawName) => {
    if (!rawName) return "Unknown location";
    const parts = rawName.split(',').map(p => p.trim()).filter(Boolean);
    const ignored = new Set([
        'zambia', 'central province', 'copperbelt province', 'lusaka province',
        'kapiri mposhi district', 'kabwe district', 'chibombo district'
    ]);
    const cleanParts = [];
    for (const part of parts) {
        const lower = part.toLowerCase();
        if (ignored.has(lower)) continue;
        if (/^\d{4,6}$/.test(part)) continue; // Postal code like 10101
        if (lower.includes('unnamed')) continue;
        cleanParts.push(part);
        if (cleanParts.length >= 2) break;
    }
    return cleanParts.length > 0 ? cleanParts.join(', ') : (parts[0] || rawName);
};

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

    // 2. Try online backend API as secondary fallback (hits MongoDB cache and restricted Mapbox)
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

    // 3. Fallback to online Nominatim OSM search strictly bounded to Kabwe, Campus & Kapiri
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)}&` +
            `format=json&` +
            `limit=5&` +
            `countrycodes=zm&` +
            `viewbox=28.20,-13.80,28.85,-14.60&` +
            `bounded=1`,
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

/**
 * High-Precision Proximity Reverse Geocoder
 * 1. Checks local campus landmarks/hostels within 320m radius (< 0.1ms, 0 API calls).
 * 2. If <= 35m: returns exact name (e.g. "Chambeshi Hostel")
 * 3. If <= 320m: returns "Near [Landmark]" (e.g. "Near Lusisi Hostel")
 * 4. Outside campus: Queries backend/OSM and cleans noisy address strings.
 */
export const reverseGeocode = async (lat, lng) => {
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) return null;

    // 1. Instant Local Proximity Search across places.json and final_places.json
    let bestLandmark = null;
    let bestDist = Infinity;

    // Check places.json
    if (placesData && Array.isArray(placesData)) {
        for (const item of placesData) {
            const pLat = parseFloat(item.lat);
            const pLon = parseFloat(item.lon);
            if (!isNaN(pLat) && !isNaN(pLon)) {
                const d = getDistanceMeters(numLat, numLng, pLat, pLon);
                if (d < bestDist) {
                    bestDist = d;
                    bestLandmark = item.display_name;
                }
            }
        }
    }

    // Check final_places.json
    if (finalPlaces?.features) {
        for (const feat of finalPlaces.features) {
            const coords = feat.geometry?.coordinates || [];
            const name = feat.properties?.name;
            if (name && coords.length >= 2) {
                const d = getDistanceMeters(numLat, numLng, coords[1], coords[0]);
                if (d < bestDist) {
                    bestDist = d;
                    bestLandmark = name;
                }
            }
        }
    }

    // Proximity Landmark Snapping (< 320 meters)
    if (bestLandmark && bestDist <= 320) {
        const cleanName = bestLandmark.split(',')[0].trim();
        if (bestDist <= 35) {
            return {
                display_name: cleanName,
                nearest_landmark: cleanName,
                distance_m: Math.round(bestDist),
                is_exact: true
            };
        } else {
            return {
                display_name: `Near ${cleanName}`,
                nearest_landmark: cleanName,
                distance_m: Math.round(bestDist),
                is_exact: false
            };
        }
    }

    // 2. Cache check for remote geocoding
    const latKey = numLat.toFixed(4);
    const lngKey = numLng.toFixed(4);
    const cacheKey = `reverse:${latKey},${lngKey}`;

    const cached = getCached_(cacheKey);
    if (cached) return cached;

    // 3. Query Backend Proximity / Mapbox Reverse Endpoint
    try {
        const backendRes = await fetch(`${BACKEND_URL}/api/places/reverse?lat=${numLat}&lng=${numLng}`);
        if (backendRes.ok) {
            const bData = await backendRes.json();
            if (bData && bData.display_name) {
                const cleaned = {
                    display_name: bData.display_name,
                    nearest_landmark: bData.nearest_landmark,
                    distance_m: bData.distance_m,
                    is_exact: bData.is_exact || false
                };
                cache.set(cacheKey, { timestamp: Date.now(), data: cleaned });
                return cleaned;
            }
        }
    } catch (err) {
        console.warn('Backend reverse geocode failed, falling back to OSM:', err);
    }

    // 4. Fallback to OpenStreetMap Reverse Geocode with clean address parsing
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}`,
            { headers: { 'User-Agent': 'MulungushiRides/1.0' } }
        );
        const data = await response.json();
        if (data && data.display_name) {
            const cleanName = cleanAddressString(data.display_name);
            const res = {
                display_name: cleanName,
                raw: data
            };
            cache.set(cacheKey, { timestamp: Date.now(), data: res });
            return res;
        }
        return null;
    } catch (error) {
        console.error('Nominatim reverse error:', error);
        return null;
    }
};
