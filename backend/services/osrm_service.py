import httpx
import math
import logging
import time
# Configure logging
logger = logging.getLogger(__name__)

OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"

async def get_route(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float):
    """
    Calculates route using OSRM.
    Returns:
        dict: {
            "distance_km": float,
            "duration_minutes": float,
            "geometry": list[list[float]]  # [[lat, lng], ...]
        }
    """
    try:
        url = f"{OSRM_BASE_URL}/{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        params = {
            "overview": "full",
            "geometries": "geojson"
        }
        
        async with httpx.AsyncClient(timeout=httpx.Timeout(3.0, connect=1.5)) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    distance_meters = route["distance"]
                    duration_seconds = route["duration"]
                    # OSRM returns [lng, lat], we need [lat, lng] for frontend mapping (Leaflet/Google)
                    raw_geometry = route["geometry"]["coordinates"]
                    geometry = [[coord[1], coord[0]] for coord in raw_geometry]
                    
                    return {
                        "distance_km": distance_meters / 1000.0,
                        "duration_minutes": duration_seconds / 60.0,
                        "geometry": geometry,
                        "source": "osrm"
                    }
            
            logger.warning(f"OSRM request failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        logger.error(f"OSRM Error: {e}")

    # Fallback to Haversine
    logger.info("Falling back to Haversine calculation")
    dist = haversine_distance(pickup_lat, pickup_lng, drop_lat, drop_lng)
    
    # Estimate duration: assume 30km/h average speed in city
    # Time = Distance / Speed
    duration_minutes = (dist / 30.0) * 60.0
    
    return {
        "distance_km": dist,
        "duration_minutes": duration_minutes,
        "geometry": [],
        "source": "haversine_fallback"
    }

async def get_multi_waypoint_route(waypoints: list):
    """
    Calculates multi-stop road route using OSRM.
    waypoints: list of dicts or tuples e.g. [{"lat": y, "lng": x}, ...] or [[lat, lng], ...]
    Returns list of [lat, lng] coordinates following road network.
    """
    if not waypoints or len(waypoints) < 2:
        return []
    
    formatted_coords = []
    for wp in waypoints:
        if isinstance(wp, dict):
            lat, lng = wp.get("lat"), wp.get("lng")
        elif isinstance(wp, (list, tuple)):
            lat, lng = wp[0], wp[1]
        else:
            continue
            
        if lat is not None and lng is not None:
            formatted_coords.append(f"{lng},{lat}")
            
    if len(formatted_coords) < 2:
        return []

    coord_str = ";".join(formatted_coords)
    url = f"{OSRM_BASE_URL}/{coord_str}"
    params = {
        "overview": "full",
        "geometries": "geojson"
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    raw_geometry = route["geometry"]["coordinates"]
                    # OSRM returns [lng, lat], convert to [lat, lng]
                    return [[coord[1], coord[0]] for coord in raw_geometry]
    except Exception as e:
        logger.error(f"OSRM Multi-Waypoint Error: {e}")

    # NEVER return straight lines when OSRM fails. Return empty list to trigger last valid route preservation.
    return []

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

_eta_cache = {}  # key: "drop_lat,drop_lng", value: {"pickup_lat": lat, "pickup_lng": lng, "eta": seconds, "timestamp": time.time()}

async def calculate_eta(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float) -> int:
    """
    Independent ETA calculation (Phase 4). Returns ETA in seconds.
    Hierarchy: OSRM -> Haversine fallback (30km/h). No Google Maps.
    """
    global _eta_cache
    cache_key = f"{drop_lat},{drop_lng}"
    current_time = time.time()
    
    # 1. Check Movement-Based Cache
    if cache_key in _eta_cache:
        cached = _eta_cache[cache_key]
        dist_moved_km = haversine_distance(pickup_lat, pickup_lng, cached["pickup_lat"], cached["pickup_lng"])
        # If driver moved less than 20 meters (0.02 km), use cache
        if dist_moved_km < 0.02:
            return cached["eta"]

    # 2. Try OSRM
    try:
        url = f"{OSRM_BASE_URL}/{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    eta = int(data["routes"][0]["duration"])
                    _eta_cache[cache_key] = {
                        "pickup_lat": pickup_lat, 
                        "pickup_lng": pickup_lng, 
                        "eta": eta, 
                        "timestamp": current_time
                    }
                    return eta
    except Exception as e:
        logger.warning(f"OSRM ETA failed, using fallback: {e}")

    # 3. Fallback to Last Valid ETA if OSRM fails
    if cache_key in _eta_cache:
        return _eta_cache[cache_key]["eta"]

    # 4. Final Haversine Fallback (30 km/h) if no cache exists
    dist_km = haversine_distance(pickup_lat, pickup_lng, drop_lat, drop_lng)
    speed_kmh = 30.0
    duration_hours = dist_km / speed_kmh
    eta = int(duration_hours * 3600)
    _eta_cache[cache_key] = {
        "pickup_lat": pickup_lat, 
        "pickup_lng": pickup_lng, 
        "eta": eta, 
        "timestamp": current_time
    }
    return eta
