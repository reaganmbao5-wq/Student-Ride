import os
import httpx
import math
import logging
import time
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

MAPBOX_ACCESS_TOKEN = os.environ.get(
    "MAPBOX_ACCESS_TOKEN",
    "pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A"
)

MAPBOX_DIRECTIONS_BASE_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"
OSRM_BASE_URL = "http://router.project-osrm.org/route/v1/driving"

# Shared HTTPX Client Singleton (Connection Reuse & Reduced TCP Overhead)
_http_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        # STRICT TIMEOUT: 1.5s connect, 3.0s read, 4.5s total to prevent backend stalls
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(4.5, connect=1.5, read=3.0))
    return _http_client

# Performance Metrics Tracker
_metrics = {
    "total_calls": 0,
    "cache_hits": 0,
    "osrm_requests": 0,
    "osrm_errors": 0,
    "total_latency_ms": 0.0
}

def get_eta_metrics():
    """Returns current performance metrics for auditing and benchmarking."""
    m = dict(_metrics)
    avg_latency = (m["total_latency_ms"] / m["osrm_requests"]) if m["osrm_requests"] > 0 else 0.0
    hit_rate = (m["cache_hits"] / m["total_calls"] * 100.0) if m["total_calls"] > 0 else 0.0
    m["avg_latency_ms"] = round(avg_latency, 2)
    m["cache_hit_rate_pct"] = round(hit_rate, 2)
    return m

def reset_eta_metrics():
    """Resets metrics counters."""
    global _metrics
    _metrics = {
        "total_calls": 0,
        "cache_hits": 0,
        "osrm_requests": 0,
        "osrm_errors": 0,
        "total_latency_ms": 0.0
    }

_single_route_cache = {}

async def get_route(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float):
    """
    Calculates route using Mapbox Directions API (with OSRM + Haversine fallback).
    Returns:
        dict: {
            "distance_km": float,
            "duration_minutes": float,
            "geometry": list[list[float]]  # [[lat, lng], ...]
        }
    """
    cache_key = f"{round(pickup_lat, 4)},{round(pickup_lng, 4)};{round(drop_lat, 4)},{round(drop_lng, 4)}"
    if cache_key in _single_route_cache:
        return _single_route_cache[cache_key]

    client = get_http_client()
    
    # 1. Primary Engine: Mapbox Directions API v5
    try:
        coord_str = f"{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        url = f"{MAPBOX_DIRECTIONS_BASE_URL}/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "access_token": MAPBOX_ACCESS_TOKEN
        }
        
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                distance_meters = route["distance"]
                duration_seconds = route["duration"]
                # Mapbox returns [lng, lat], convert to [lat, lng] for Leaflet/Google/Mapbox frontend
                raw_geometry = route["geometry"]["coordinates"]
                geometry = [[coord[1], coord[0]] for coord in raw_geometry]
                
                distance_km = distance_meters / 1000.0
                
                # Realistic Campus & Urban Speed Calculation:
                # Mapbox driving duration uses theoretical open-highway speeds (80-100 km/h) on trunk roads.
                # In campus & local town environments, realistic speed is 25-35 km/h + 1.0 min starting/turning buffer.
                realistic_duration_min = max(
                    2.0,
                    (duration_seconds / 60.0),
                    (distance_km * 2.2) + 1.0
                )
                
                result = {
                    "distance_km": round(distance_km, 2),
                    "duration_minutes": round(realistic_duration_min, 1),
                    "geometry": geometry,
                    "source": "mapbox"
                }
                _single_route_cache[cache_key] = result
                return result
    except Exception as e:
        logger.warning(f"Mapbox Directions API Error: {e}, falling back to OSRM")

    # 2. Secondary Engine Fallback: OSRM
    try:
        url = f"{OSRM_BASE_URL}/{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        params = {"overview": "full", "geometries": "geojson"}
        response = await client.get(url, params=params)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                distance_meters = route["distance"]
                duration_seconds = route["duration"]
                raw_geometry = route["geometry"]["coordinates"]
                geometry = [[coord[1], coord[0]] for coord in raw_geometry]
                
                result = {
                    "distance_km": distance_meters / 1000.0,
                    "duration_minutes": duration_seconds / 60.0,
                    "geometry": geometry,
                    "source": "osrm"
                }
                _single_route_cache[cache_key] = result
                return result
    except Exception as e:
        logger.error(f"OSRM Fallback Error: {e}")

    # 3. Final Fallback: Haversine
    logger.info("Falling back to Haversine calculation")
    dist = haversine_distance(pickup_lat, pickup_lng, drop_lat, drop_lng)
    duration_minutes = (dist / 30.0) * 60.0
    
    return {
        "distance_km": dist,
        "duration_minutes": duration_minutes,
        "geometry": [],
        "source": "haversine_fallback"
    }

_multi_route_cache = {}  # key: "lat0,lng0;lat1,lng1...", value: {"data": res, "timestamp": float}

async def get_multi_waypoint_route_with_legs(waypoints: list) -> dict:
    """
    Calculates a single continuous multi-stop route with leg-level breakdowns
    using Mapbox Directions API (with OSRM fallback) and in-memory 15s TTL caching.
    
    Returns:
        dict: {
            "full_geometry": list[list[float]],  # [[lat, lng], ...]
            "legs": list[dict]  # [{"geometry": [[lat, lng], ...], "distance_km": float, "duration_seconds": float}, ...]
        }
    """
    if not waypoints or len(waypoints) < 2:
        return {"full_geometry": [], "legs": []}
    
    formatted_coords = []
    cache_coords = []
    for wp in waypoints:
        if isinstance(wp, dict):
            lat, lng = wp.get("lat"), wp.get("lng")
        elif isinstance(wp, (list, tuple)):
            lat, lng = wp[0], wp[1]
        else:
            continue
            
        if lat is not None and lng is not None:
            formatted_coords.append(f"{lng},{lat}")
            cache_coords.append(f"{round(lat, 4)},{round(lng, 4)}")
            
    if len(formatted_coords) < 2:
        return {"full_geometry": [], "legs": []}

    cache_key = ";".join(cache_coords)
    now = time.time()

    # 1. Check TTL Multi-Route Cache (15-second window)
    if cache_key in _multi_route_cache:
        cached_entry = _multi_route_cache[cache_key]
        if now - cached_entry["timestamp"] < 15.0:
            return cached_entry["data"]

    coord_str = ";".join(formatted_coords)
    client = get_http_client()

    # 2. Primary Engine: Mapbox Directions API v5 with steps=true
    try:
        url = f"{MAPBOX_DIRECTIONS_BASE_URL}/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
            "access_token": MAPBOX_ACCESS_TOKEN
        }
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                raw_geometry = route["geometry"]["coordinates"]
                full_geo = [[coord[1], coord[0]] for coord in raw_geometry]
                
                legs_data = []
                raw_legs = route.get("legs", [])
                for leg in raw_legs:
                    leg_coords = []
                    steps = leg.get("steps", [])
                    for step in steps:
                        step_geo = step.get("geometry", {}).get("coordinates", [])
                        for pt in step_geo:
                            lat_lng = [pt[1], pt[0]]
                            if not leg_coords or leg_coords[-1] != lat_lng:
                                leg_coords.append(lat_lng)
                    
                    if not leg_coords and steps:
                        # Fallback if step geometry was empty
                        leg_coords = full_geo
                        
                    legs_data.append({
                        "geometry": leg_coords,
                        "distance_km": leg.get("distance", 0.0) / 1000.0,
                        "duration_seconds": leg.get("duration", 0.0)
                    })
                
                # If legs were returned successfully, return unified structure and cache
                if legs_data:
                    result = {
                        "full_geometry": full_geo,
                        "legs": legs_data
                    }
                    _multi_route_cache[cache_key] = {"data": result, "timestamp": now}
                    return result
    except Exception as e:
        logger.warning(f"Mapbox Multi-Waypoint with Legs Error: {e}, falling back to single route or OSRM")

    # 2. Secondary Engine Fallback: OSRM
    try:
        url = f"{OSRM_BASE_URL}/{coord_str}"
        params = {"overview": "full", "geometries": "geojson", "steps": "true"}
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                raw_geometry = route["geometry"]["coordinates"]
                full_geo = [[coord[1], coord[0]] for coord in raw_geometry]
                legs_data = []
                for leg in route.get("legs", []):
                    leg_coords = []
                    for step in leg.get("steps", []):
                        step_geo = step.get("geometry", {}).get("coordinates", [])
                        for pt in step_geo:
                            lat_lng = [pt[1], pt[0]]
                            if not leg_coords or leg_coords[-1] != lat_lng:
                                leg_coords.append(lat_lng)
                    legs_data.append({
                        "geometry": leg_coords,
                        "distance_km": leg.get("distance", 0.0) / 1000.0,
                        "duration_seconds": leg.get("duration", 0.0)
                    })
                if legs_data:
                    return {"full_geometry": full_geo, "legs": legs_data}
    except Exception as e:
        logger.error(f"OSRM Multi-Waypoint Legs Fallback Error: {e}")

    # Fallback to single multi-waypoint call
    simple_geo = await get_multi_waypoint_route(waypoints)
    return {
        "full_geometry": simple_geo,
        "legs": [{"geometry": simple_geo, "distance_km": 0.0, "duration_seconds": 0.0}] if simple_geo else []
    }

async def get_multi_waypoint_route(waypoints: list):
    """
    Calculates multi-stop road route using Mapbox Directions API (with OSRM fallback).
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
    client = get_http_client()

    # 1. Primary Engine: Mapbox Directions API v5 (Multi-Waypoint)
    try:
        url = f"{MAPBOX_DIRECTIONS_BASE_URL}/{coord_str}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "access_token": MAPBOX_ACCESS_TOKEN
        }
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("routes") and len(data["routes"]) > 0:
                route = data["routes"][0]
                raw_geometry = route["geometry"]["coordinates"]
                return [[coord[1], coord[0]] for coord in raw_geometry]
    except Exception as e:
        logger.warning(f"Mapbox Multi-Waypoint Error: {e}, falling back to OSRM")

    # 2. Secondary Engine Fallback: OSRM
    try:
        url = f"{OSRM_BASE_URL}/{coord_str}"
        params = {"overview": "full", "geometries": "geojson"}
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("code") == "Ok" and data.get("routes"):
                route = data["routes"][0]
                raw_geometry = route["geometry"]["coordinates"]
                return [[coord[1], coord[0]] for coord in raw_geometry]
    except Exception as e:
        logger.error(f"OSRM Multi-Waypoint Fallback Error: {e}")

    # NEVER return straight lines when API calls fail. Return empty list to preserve active geometry.
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

async def calculate_eta(pickup_lat: float, pickup_lng: float, drop_lat: float, drop_lng: float, force_recalculate: bool = False) -> int:
    """
    Independent ETA calculation using Mapbox Directions API (with OSRM & Haversine fallback).
    """
    global _eta_cache, _metrics
    _metrics["total_calls"] += 1
    cache_key = f"{drop_lat:.5f},{drop_lng:.5f}"
    current_time = time.time()
    
    # 1. Throttled & Movement-Based Cache Check (<50m movement & <12s elapsed)
    if cache_key in _eta_cache and not force_recalculate:
        cached = _eta_cache[cache_key]
        dist_moved_km = haversine_distance(pickup_lat, pickup_lng, cached["pickup_lat"], cached["pickup_lng"])
        time_elapsed = current_time - cached["timestamp"]
        
        if dist_moved_km < 0.05 and time_elapsed < 12.0:
            _metrics["cache_hits"] += 1
            return cached["eta"]

    # 2. Try Mapbox Directions API
    start_time = time.time()
    _metrics["osrm_requests"] += 1
    client = get_http_client()
    
    try:
        coord_str = f"{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        url = f"{MAPBOX_DIRECTIONS_BASE_URL}/{coord_str}"
        params = {
            "access_token": MAPBOX_ACCESS_TOKEN
        }
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("routes") and len(data["routes"]) > 0:
                raw_duration_sec = data["routes"][0]["duration"]
                dist_km = data["routes"][0]["distance"] / 1000.0
                # Realistic dynamic ETA calculation (speeds ~25-35 km/h) allowing continuous countdown down to arrival (<1 min)
                if dist_km <= 0.05:
                    realistic_eta_sec = 15
                else:
                    duration_from_speed = (dist_km / 25.0) * 3600
                    realistic_eta_sec = int(max(15, raw_duration_sec if raw_duration_sec > 0 else duration_from_speed))
                _eta_cache[cache_key] = {
                    "pickup_lat": pickup_lat, 
                    "pickup_lng": pickup_lng, 
                    "eta": realistic_eta_sec, 
                    "timestamp": current_time
                }
                _metrics["total_latency_ms"] += (time.time() - start_time) * 1000
                return realistic_eta_sec
    except Exception as e:
        _metrics["osrm_errors"] += 1
        logger.warning(f"Mapbox ETA failed, falling back: {e}")

    # 3. Fallback to Last Valid ETA
    if cache_key in _eta_cache:
        return _eta_cache[cache_key]["eta"]

    # 4. Final Haversine Fallback (30 km/h)
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
