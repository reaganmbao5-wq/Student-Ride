import sys
import os
import asyncio

# Ensure backend import path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.osrm_service import get_route, get_multi_waypoint_route, calculate_eta

async def main():
    print("======================================================================")
    print("TESTING MAPBOX DIRECTIONS ENGINE & MULTI-WAYPOINT SHARED ROUTING")
    print("======================================================================\n")

    # 1. Single Segment Test: Main Gate -> Kabwe Kobil
    pickup_lat, pickup_lng = -14.294646, 28.549662
    drop_lat, drop_lng = -14.441372, 28.449307

    print("1. Testing Single Segment Route (Main Gate -> Kobil)...")
    route_res = await get_route(pickup_lat, pickup_lng, drop_lat, drop_lng)
    print(f"   Source: {route_res.get('source')}")
    print(f"   Distance: {route_res.get('distance_km'):.2f} km")
    print(f"   Duration: {route_res.get('duration_minutes'):.2f} min")
    print(f"   Geometry Point Count: {len(route_res.get('geometry', []))}")
    if route_res.get('geometry'):
        print(f"   First Point [lat, lng]: {route_res['geometry'][0]}")
        print(f"   Last Point [lat, lng]: {route_res['geometry'][-1]}")
    print("-" * 70)

    # 2. Multi-Waypoint Shared Ride Test (4 Stops: Pickup 1 -> Pickup 2 -> Dropoff 1 -> Dropoff 2)
    waypoints = [
        {"lat": -14.294646, "lng": 28.549662},  # Stop 1: Pickup Student A (Main Gate)
        {"lat": -14.305000, "lng": 28.555000},  # Stop 2: Pickup Student B (Hostel 4)
        {"lat": -14.420000, "lng": 28.460000},  # Stop 3: Dropoff Student A (Highridge)
        {"lat": -14.441372, "lng": 28.449307}   # Stop 4: Dropoff Student B (Kobil)
    ]
    print("\n2. Testing Shared Ride Multi-Waypoint Route (4 Stops)...")
    multi_geo = await get_multi_waypoint_route(waypoints)
    print(f"   Multi-Waypoint Geometry Point Count: {len(multi_geo)}")
    if multi_geo:
        print(f"   First Point [lat, lng]: {multi_geo[0]}")
        print(f"   Last Point [lat, lng]: {multi_geo[-1]}")
    print("-" * 70)

    # 3. ETA Test
    print("\n3. Testing Mapbox ETA Calculation...")
    eta_sec = await calculate_eta(pickup_lat, pickup_lng, drop_lat, drop_lng)
    print(f"   Estimated Time of Arrival: {eta_sec} seconds ({eta_sec // 60} minutes)")
    print("======================================================================")

if __name__ == '__main__':
    asyncio.run(main())
