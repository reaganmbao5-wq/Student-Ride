import asyncio
import httpx
import time
import math
import random
import uuid
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = "http://localhost:8000/api"

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

async def register_or_login(client, role, email, password, name):
    resp = await client.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    
    resp = await client.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
        "role": role,
        "phone": f"+260{str(uuid.uuid4().int)[:9]}"
    })
    
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return None

async def drive_route(client, route_coords, driver_id="ghost-driver-0"):
    for i in range(len(route_coords) - 1):
        curr_lng, curr_lat = route_coords[i]
        next_lng, next_lat = route_coords[i+1]
        
        heading = calculate_bearing(curr_lat, curr_lng, next_lat, next_lng)
        
        payload = {
            driver_id: {
                "lat": curr_lat,
                "lng": curr_lng,
                "heading": heading
            }
        }
        
        # Post location to backend
        await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
        print(f"Driving... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
        
        # Wait 1.5 seconds between points to simulate normal driving speed
        await asyncio.sleep(1.5)

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    async with httpx.AsyncClient(timeout=60.0) as client:
        print("Waiting for a ride to be requested from your app...")
        ride = None
        while True:
            resp = await client.get("http://localhost:8000/api/test/get_active_ride_for_simulation")
            data = resp.json()
            if data and data.get("status") == "requested":
                ride = data
                break
            await asyncio.sleep(2)
            
        print("Ride requested! ID:", ride["id"])
        pickup = ride["pickup_location"]
        dropoff = ride["dropoff_location"]
        pickup_lat, pickup_lng = pickup["lat"], pickup["lng"]
        dropoff_lat, dropoff_lng = dropoff["lat"], dropoff["lng"]
        
        # 0. Setup Driver
        driver_email = f"driver_{int(time.time())}@test.com"
        driver_token = await register_or_login(client, "driver", driver_email, "password123", "Simulated Driver")
        driver_user = await db.users.find_one({"email": driver_email})
        driver_id = str(uuid.uuid4())
        driver_user_id = driver_user["id"]
        
        # Inject driver profile
        driver_doc = {
            "id": driver_id,
            "user_id": driver_user_id,
            "vehicle_make": "Simulated",
            "vehicle_model": "Car",
            "vehicle_color": "Blue",
            "vehicle_plate": "SIM-001",
            "vehicle_capacity": 4,
            "accepts_shared_rides": False,
            "is_approved": True,
            "vehicle_verified": True,
            "is_online": True,
            "wallet_balance": 100.0,
            "wallet_status": "active"
        }
        await db.drivers.insert_one(driver_doc)
        headers_driver = {"Authorization": f"Bearer {driver_token}"}
        print("Simulated Driver online and authenticated.")

        # 1. Roam idly around pickup for a few seconds
        print("Simulating idle driver...")
        idle_lat, idle_lng = pickup_lat + 0.005, pickup_lng + 0.005
        
        for _ in range(3):
            idle_lat += random.uniform(-0.0002, 0.0002)
            idle_lng += random.uniform(-0.0002, 0.0002)
            payload = {
                driver_user_id: {"lat": idle_lat, "lng": idle_lng, "heading": random.uniform(0, 360)}
            }
            await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
            await asyncio.sleep(1.5)
            
        # 2. Accept trip using NEW State Machine API
        print("Driver is accepting the ride...")
        resp = await client.post(f"{BASE_URL}/rides/{ride['id']}/accept", headers=headers_driver)
        if resp.status_code != 200:
            print("Failed to accept ride!", resp.json())
            return
            
        # 3. Transition to En Route
        await client.post(f"{BASE_URL}/rides/{ride['id']}/en_route", headers=headers_driver)
        print("Driver is En Route to Pickup...")
        
        # 4. Drive to Pickup
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{idle_lng},{idle_lat};{pickup_lng},{pickup_lat}?overview=full&geometries=geojson"
        route_resp = await client.get(osrm_url)
        pickup_route = route_resp.json()["routes"][0]["geometry"]["coordinates"]
        
        await drive_route(client, pickup_route, driver_user_id)
        
        # 5. Arrive and Boarding
        print("Driver has arrived! Waiting 3 seconds for passenger...")
        await client.post(f"{BASE_URL}/rides/{ride['id']}/arrived", headers=headers_driver)
        await asyncio.sleep(3)
        
        print("Passenger is boarding...")
        await client.post(f"{BASE_URL}/rides/{ride['id']}/boarding", headers=headers_driver)
        await asyncio.sleep(2)
        
        print("Starting ride...")
        await client.post(f"{BASE_URL}/rides/{ride['id']}/start", headers=headers_driver)
        await client.post(f"{BASE_URL}/rides/{ride['id']}/in_progress", headers=headers_driver)
        await asyncio.sleep(1)
        
        # 6. Drive to Destination
        print(f"Fetching OSRM route to destination...")
        osrm_url_dest = f"http://router.project-osrm.org/route/v1/driving/{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}?overview=full&geometries=geojson"
        route_dest_resp = await client.get(osrm_url_dest)
        dest_route = route_dest_resp.json()["routes"][0]["geometry"]["coordinates"]
        
        print("Driving to destination...")
        await drive_route(client, dest_route, driver_user_id)
        
        # 7. Arriving & Complete
        print("Arriving at destination...")
        await client.post(f"{BASE_URL}/rides/{ride['id']}/arriving", headers=headers_driver)
        
        # Override the started_at time in DB to bypass the 60s fraud check wait for testing
        from datetime import datetime, timezone, timedelta
        mock_start = (datetime.now(timezone.utc) - timedelta(seconds=65)).isoformat()
        await db.rides.update_one({"id": ride['id']}, {"$set": {"started_at": mock_start}})
        
        print("Completing ride...")
        resp = await client.post(f"{BASE_URL}/rides/{ride['id']}/complete", headers=headers_driver)
        if resp.status_code == 200:
            print("E2E Simulation Finished Successfully! Ride Archived.")
        else:
            print("Failed to complete ride:", resp.json())

if __name__ == "__main__":
    asyncio.run(main())
