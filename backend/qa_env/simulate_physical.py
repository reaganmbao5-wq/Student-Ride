import asyncio
import os
import math
import argparse
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

async def drive_route(client, driver_user_id, start_coords, end_coords):
    start_lat, start_lng = start_coords["lat"], start_coords["lng"]
    end_lat, end_lng = end_coords["lat"], end_coords["lng"]
    
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    try:
        route_resp = await client.get(osrm_url)
        route_coords = route_resp.json()["routes"][0]["geometry"]["coordinates"]
    except Exception as e:
        print("Failed to get OSRM route, falling back to straight line.")
        route_coords = [[start_lng, start_lat], [end_lng, end_lat]]

    for i in range(len(route_coords) - 1):
        curr_lng, curr_lat = route_coords[i]
        next_lng, next_lat = route_coords[i+1]
        
        heading = calculate_bearing(curr_lat, curr_lng, next_lat, next_lng)
        
        payload = {
            driver_user_id: {
                "lat": curr_lat,
                "lng": curr_lng,
                "heading": heading
            }
        }
        
        backend_url = os.environ.get("BACKEND_URL", "https://student-ride-backend-manual.onrender.com")
        await client.post(f"{backend_url}/api/test/inject_drivers", json={"drivers": payload})
        print(f"Driving... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
        await asyncio.sleep(1.5)

async def main():
    parser = argparse.ArgumentParser(description="Simulate a physical ride by moving the driver pin")
    parser.add_argument("--email", required=True, help="The driver's email address")
    args = parser.parse_args()

    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    driver_user = await db.users.find_one({"email": args.email})
    if not driver_user:
        print(f"Driver with email {args.email} not found!")
        return

    driver_user_id = driver_user["id"]
    driver_profile = await db.drivers.find_one({"user_id": driver_user_id})
    if not driver_profile:
        print("Driver profile not found!")
        return
        
    driver_id = driver_profile["id"]
    
    print(f"✅ Found driver: {driver_user['name']} ({args.email})")
    print(f"⌛ Waiting for driver to ACCEPT a ride...")

    while True:
        # Look for a ride assigned to this driver that is in 'driver_accepted' state
        ride = await db.rides.find_one({"driver_id": driver_id, "status": {"$in": ["driver_accepted", "driver_arrived", "ongoing"]}})
        if ride:
            break
        await asyncio.sleep(2)
        
    print(f"\n🎉 Ride Accepted! ID: {ride['id']}")
    
    pickup = ride["pickup_location"]
    dropoff = ride["dropoff_location"]
    
    # Start the driver about 50 meters away from the pickup so we can see them driving
    driver_start = {
        "lat": pickup["lat"] - 0.0005, 
        "lng": pickup["lng"] - 0.0005
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        if ride["status"] == "driver_accepted":
            print(f"\n🚗 Driving from your current location to pickup: {pickup.get('address', 'Unknown')}...")
            await drive_route(client, driver_user_id, driver_start, pickup)
            
            print(f"\n🛑 Arrived at pickup! Waiting for you to click 'I've Arrived' and 'Start Ride' on the app...")
            while True:
                ride = await db.rides.find_one({"id": ride["id"]})
                if ride["status"] in ["ongoing", "ride_started", "ride_in_progress"]:
                    break
                await asyncio.sleep(2)
                
            print(f"\n🟢 Ride Started! Driving to destination...")
        
        elif ride["status"] == "driver_arrived":
            print(f"\n🛑 Already at pickup! Waiting for you to click 'Start Ride' on the app...")
            while True:
                ride = await db.rides.find_one({"id": ride["id"]})
                if ride["status"] in ["ongoing", "ride_started", "ride_in_progress"]:
                    break
                await asyncio.sleep(2)
            print(f"\n🟢 Ride Started! Driving to destination...")
            
        # Drive to dropoff
        print(f"\n🚗 Driving to dropoff location: {dropoff.get('address', 'Unknown')}...")
        await drive_route(client, driver_user_id, pickup, dropoff)
        
        print("\n🏁 Reached destination! You can now click 'Complete Ride' on the app.")

if __name__ == "__main__":
    asyncio.run(main())
