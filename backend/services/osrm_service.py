import httpx
import math
import logging

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
            "geometry": list[list[float]]  # [[lng, lat], ...]
        }
    """
    try:
        # OSRM expects {lng},{lat};{lng},{lat}
        url = f"{OSRM_BASE_URL}/{pickup_lng},{pickup_lat};{drop_lng},{drop_lat}"
        params = {
            "overview": "full",
            "geometries": "geojson"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    distance_meters = route["distance"]
                    duration_seconds = route["duration"]
                    geometry = route["geometry"]["coordinates"]
                    
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
        "geometry": [], # No geometry for fallback
        "source": "haversine_fallback"
    }

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c
