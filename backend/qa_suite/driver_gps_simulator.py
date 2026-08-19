import asyncio
import os
import math
import uuid
import socketio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

COORDINATES = {
    'CAMPUS_GATE': {'lat': -14.4087, 'lng': 28.2849, 'name': 'Mulungushi Main Gate'},
    'ADMIN_BLOCK': {'lat': -14.4095, 'lng': 28.2860, 'name': 'Administration Block'},
    'LIBRARY': {'lat': -14.4102, 'lng': 28.2872, 'name': 'University Library'},
    'HOSTELS_NORTH': {'lat': -14.4065, 'lng': 28.2830, 'name': 'North Hostels (Silungwe)'},
    'HOSTELS_SOUTH': {'lat': -14.4120, 'lng': 28.2890, 'name': 'South Hostels'},
    'GRADUATION_SQUARE': {'lat': -14.4110, 'lng': 28.2845, 'name': 'Graduation Square'}
}

def interpolate_points(p1, p2, num_steps=20):
    points = []
    for i in range(num_steps + 1):
        t = i / num_steps
        lat = p1['lat'] + t * (p2['lat'] - p1['lat'])
        lng = p1['lng'] + t * (p2['lng'] - p1['lng'])
        d_lng = p2['lng'] - p1['lng']
        d_lat = p2['lat'] - p1['lat']
        bearing = math.degrees(math.atan2(d_lng, d_lat)) % 360
        points.append({'lat': round(lat, 6), 'lng': round(lng, 6), 'heading': round(bearing, 1)})
    return points

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
            print(f'[DriverGPSSimulator] WebSocket connection failed: {e}')

    async def disconnect(self):
        if self.is_connected:
            await self.sio.disconnect()
            self.is_connected = False
            print('[DriverGPSSimulator] Disconnected from WebSocket')

    async def simulate_trip(self, driver_id, start_pos, target_pos, ride_id=None, step_delay=0.2, num_steps=15):
        path = interpolate_points(start_pos, target_pos, num_steps=num_steps)
        print(f'[DriverGPSSimulator] Streaming {len(path)} GPS points for driver {driver_id}...')
        for idx, pt in enumerate(path):
            await self.db.drivers.update_one(
                {'id': driver_id},
                {'': {
                    'current_location': {'lat': pt['lat'], 'lng': pt['lng']},
                    'heading': pt['heading'],
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }}
            )
            if self.is_connected:
                payload = {
                    'driver_id': driver_id,
                    'location': {'lat': pt['lat'], 'lng': pt['lng']},
                    'heading': pt['heading'],
                    'ride_id': ride_id
                }
                await self.sio.emit('driver_location_update', payload)
            await asyncio.sleep(step_delay)
        print(f'[DriverGPSSimulator] Driver {driver_id} reached waypoint: {target_pos}')
        return path[-1]
