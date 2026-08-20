import asyncio
import os
import math
import uuid
import httpx
import socketio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MAPBOX_ACCESS_TOKEN = os.environ.get(
    "MAPBOX_ACCESS_TOKEN",
    "pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A"
)

COORDINATES = {
    'CAMPUS_GATE': {'lat': -14.4087, 'lng': 28.2849, 'name': 'Mulungushi Main Gate'},
    'ADMIN_BLOCK': {'lat': -14.4095, 'lng': 28.2860, 'name': 'Administration Block'},
    'LIBRARY': {'lat': -14.4102, 'lng': 28.2872, 'name': 'University Library'},
    'HOSTELS_NORTH': {'lat': -14.4065, 'lng': 28.2830, 'name': 'North Hostels (Silungwe)'},
    'HOSTELS_SOUTH': {'lat': -14.4120, 'lng': 28.2890, 'name': 'South Hostels'},
    'GRADUATION_SQUARE': {'lat': -14.4110, 'lng': 28.2845, 'name': 'Graduation Square'}
}

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

def interpolate_points(start_lat, start_lng, end_lat, end_lng, step_meters=15):
    total_dist = haversine(start_lat, start_lng, end_lat, end_lng)
    if total_dist <= step_meters:
        return [{'lat': round(end_lat, 6), 'lng': round(end_lng, 6), 'heading': round(calculate_bearing(start_lat, start_lng, end_lat, end_lng), 1)}]
    
    num_steps = max(1, int(total_dist // step_meters))
    points = []
    for i in range(1, num_steps + 1):
        fraction = i / num_steps
        lat = start_lat + (end_lat - start_lat) * fraction
        lng = start_lng + (end_lng - start_lng) * fraction
        bearing = calculate_bearing(start_lat, start_lng, end_lat, end_lng)
        points.append({'lat': round(lat, 6), 'lng': round(lng, 6), 'heading': round(bearing, 1)})
    return points

async def get_curved_road_route(client, start_pos, target_pos):
    s_lat, s_lng = start_pos['lat'], start_pos['lng']
    t_lat, t_lng = target_pos['lat'], target_pos['lng']
    raw_coords = None
    
    try:
        mapbox_url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{s_lng},{s_lat};{t_lng},{t_lat}"
        params = {"overview": "full", "geometries": "geojson", "access_token": MAPBOX_ACCESS_TOKEN}
        r = await client.get(mapbox_url, params=params, timeout=8.0)
        if r.status_code == 200:
            data = r.json()
            if data.get("routes") and len(data["routes"]) > 0:
                raw_coords = data["routes"][0]["geometry"]["coordinates"]
    except Exception:
        pass
        
    if not raw_coords:
        try:
            osrm_url = f"http://router.project-osrm.org/route/v1/driving/{s_lng},{s_lat};{t_lng},{t_lat}?overview=full&geometries=geojson"
            r = await client.get(osrm_url, timeout=5.0)
            if r.status_code == 200:
                data = r.json()
                if data.get("routes"):
                    raw_coords = data["routes"][0]["geometry"]["coordinates"]
        except Exception:
            pass
            
    if not raw_coords:
        raw_coords = [[s_lng, s_lat], [t_lng, t_lat]]
        
    smooth_path = []
    for i in range(len(raw_coords) - 1):
        p1_lng, p1_lat = raw_coords[i]
        p2_lng, p2_lat = raw_coords[i+1]
        smooth_path.extend(interpolate_points(p1_lat, p1_lng, p2_lat, p2_lng, step_meters=15))
        
    return smooth_path

class DriverGPSSimulator:
    def __init__(self, backend_url=None, ws_url=None):
        self.backend_url = backend_url or os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8000')
        self.ws_url = ws_url or self.backend_url
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self.mongo_client = AsyncIOMotorClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
        self.db = self.mongo_client[os.getenv('DB_NAME', 'mulungushi_rides')]
        self.is_connected = False

    async def connect(self):
        try:
            await self.sio.connect(self.ws_url, transports=['websocket', 'polling'])
            self.is_connected = True
            print(f'[DriverGPSSimulator] Connected to WebSocket at {self.ws_url}')
        except Exception as e:
            print(f'[DriverGPSSimulator] WebSocket connection fallback: {e}')

    async def disconnect(self):
        if self.is_connected:
            await self.sio.disconnect()
            self.is_connected = False
            print('[DriverGPSSimulator] Disconnected from WebSocket')

    async def simulate_trip(self, driver_id, start_pos, target_pos, ride_id=None, step_delay=0.35):
        async with httpx.AsyncClient(timeout=15.0) as client:
            path = await get_curved_road_route(client, start_pos, target_pos)
            
        print(f'[DriverGPSSimulator] Streaming {len(path)} curved GPS road waypoints for driver {driver_id}...')
        for idx, pt in enumerate(path):
            try:
                await self.db.drivers.update_one(
                    {'id': driver_id},
                    {'$set': {
                        'current_location': {'lat': pt['lat'], 'lng': pt['lng']},
                        'heading': pt['heading'],
                        'last_active': datetime.now(timezone.utc).isoformat()
                    }}
                )
            except Exception:
                pass
                
            if self.is_connected:
                payload = {
                    'driver_id': driver_id,
                    'location': {'lat': pt['lat'], 'lng': pt['lng']},
                    'heading': pt['heading'],
                    'ride_id': ride_id
                }
                try:
                    await self.sio.emit('driver_location_update', payload)
                except Exception:
                    pass
            await asyncio.sleep(step_delay)
            
        print(f'[DriverGPSSimulator] Driver {driver_id} reached destination waypoint: {target_pos}')
        return path[-1] if path else target_pos
