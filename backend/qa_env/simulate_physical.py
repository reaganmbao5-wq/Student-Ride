import asyncio
import os
import math
import argparse
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def drive_smoothly(client, driver_user_id, start_coords, end_coords, steps=30):
    start_lat, start_lng = start_coords["lat"], start_coords["lng"]
    end_lat, end_lng = end_coords["lat"], end_coords["lng"]
    
    for i in range(1, steps + 1):
        progress = i / steps
        curr_lat = start_lat + (end_lat - start_lat) * progress
        curr_lng = start_lng + (end_lng - start_lng) * progress
        
        dy = end_lat - start_lat
        dx = end_lng - start_lng
        heading = (math.degrees(math.atan2(dx, dy)) + 360) % 360
        
        payload = {
            driver_user_id: {
                "lat": curr_lat,
                "lng": curr_lng,
                "heading": heading
            }
        }
        
        await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
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
    
    # Get current physical location of driver
    driver_loc = driver_profile.get("location", {}).get("coordinates", [pickup["lng"], pickup["lat"]])
    driver_start = {"lat": driver_loc[1], "lng": driver_loc[0]}
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        if ride["status"] == "driver_accepted":
            print(f"\n🚗 Driving from your current location to pickup: {pickup.get('address', 'Unknown')}...")
            await drive_smoothly(client, driver_user_id, driver_start, pickup, steps=20)
            
            print(f"\n🛑 Arrived at pickup! Waiting for you to click 'I've Arrived' and 'Start Ride' on the app...")
            while True:
                ride = await db.rides.find_one({"id": ride["id"]})
                if ride["status"] == "ongoing":
                    break
                await asyncio.sleep(2)
                
            print(f"\n🟢 Ride Started! Driving to destination...")
        
        elif ride["status"] == "driver_arrived":
            print(f"\n🛑 Already at pickup! Waiting for you to click 'Start Ride' on the app...")
            while True:
                ride = await db.rides.find_one({"id": ride["id"]})
                if ride["status"] == "ongoing":
                    break
                await asyncio.sleep(2)
            print(f"\n🟢 Ride Started! Driving to destination...")
            
        # Drive to dropoff
        print(f"\n🚗 Driving to dropoff location: {dropoff.get('address', 'Unknown')}...")
        await drive_smoothly(client, driver_user_id, pickup, dropoff, steps=30)
        
        print("\n🏁 Reached destination! You can now click 'Complete Ride' on the app.")

if __name__ == "__main__":
    asyncio.run(main())
