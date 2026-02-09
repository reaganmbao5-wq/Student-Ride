import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
API_URL = "http://localhost:8000/api"

async def verify_pricing():
    print("Verifying Pricing & OSRM Integration...")
    
    # 1. Create/Login Student
    student_email = f"student_osrm_{uuid.uuid4().hex[:6]}@test.com"
    driver_profile = None # Placeholder
    
    # Increase timeout for testing
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Register
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": student_email,
            "password": "password123",
            "name": "OSRM Tester",
            "phone": "+260111222333",
            "role": "student"
        })
        if resp.status_code != 200:
            print(f"Register failed: {resp.text}")
            return
            
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Request Ride
        # Mulungushi University region points
        pickup = {"lat": -14.4450, "lng": 28.4480, "address": "Start Point"}
        dropoff = {"lat": -14.4200, "lng": 28.4600, "address": "End Point"}
        
        # Haversine approx: ~3km?
        # OSRM was 4.01km in Phase 1
        
        req_data = {
            "pickup_location": pickup,
            "dropoff_location": dropoff,
            "estimated_fare": 0,    # Should be ignored
            "estimated_distance": 0, # Should be ignored
            "estimated_duration": 0  # Should be ignored
        }
        
        print("Requesting ride...")
        ride_resp = await client.post(
            f"{API_URL}/rides/request",
            headers=headers,
            json=req_data
        )
        
        if ride_resp.status_code != 200:
            print(f"Ride request failed: {ride_resp.text}")
            return
        
        ride = ride_resp.json()
        print("\n--- Ride Created ---")
        print(f"Ride ID: {ride['id']}")
        print(f"Fare: K{ride['fare']}")
        print(f"Commission: K{ride['commission']}")
        print(f"Distance: {ride['distance']} km")
        print(f"Duration: {ride['duration']} min")
        
        # Check verified fields (won't be in Pydantic response unless we check DB or if we specifically added them to response model... 
        # Wait, the response model likely doesn't have verified_geometry yet? 
        # The prompt didn't say to update Pydantic models, but effectively we probably should to communicate geometry to frontend.
        # But Phase 3 is "Frontend Route Visual Fix", so maybe the geometry is sent there?
        # Let's check DB directly to be sure fields are stored.
        
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo = AsyncIOMotorClient(MONGO_URL)
        db = mongo[DB_NAME]
        
        db_ride = await db.rides.find_one({"id": ride["id"]})
        
        print("\n--- DB Verification ---")
        print(f"Verified Distance: {db_ride.get('verified_distance')}")
        print(f"Verified Duration: {db_ride.get('verified_duration')}")
        print(f"Route Source: {db_ride.get('route_source')}")
        geom = db_ride.get('verified_geometry', [])
        print(f"Geometry Points: {len(geom)}")
        
        if db_ride.get('route_source') == 'osrm' and len(geom) > 0:
             print("\n✅ Pricing & OSRM Storage Verified")
        else:
             print("\n❌ Verification Failed: Missing OSRM data in DB")
             
        # Cleanup
        await db.users.delete_one({"email": student_email})
        await db.rides.delete_one({"id": ride["id"]})

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_pricing())
