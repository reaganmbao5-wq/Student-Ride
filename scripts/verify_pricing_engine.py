
import asyncio
import sys
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import uuid
from datetime import datetime, timezone
import httpx

# Add backend to path
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))

from server import calculate_haversine_distance

from dotenv import load_dotenv

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

if not MONGO_URL:
    # Load env from backend/.env if not in os.environ
    load_dotenv(ROOT_DIR / '.env')
    MONGO_URL = os.environ.get("MONGO_URL")
    DB_NAME = os.environ.get("DB_NAME")

async def verify_pricing():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("\n--- Verifying Pricing Engine ---")
    
    # 1. Verify Pricing Settings
    settings = await db.pricing_settings.find_one({})
    if settings:
        print("✅ Pricing Settings initialized:")
        print(f"   Base: {settings['base_fare']}, /km: {settings['per_km_rate']}, /min: {settings['per_minute_rate']}")
        print(f"   Surge: {settings['surge_multiplier']}, Min: {settings['minimum_fare']}")
    else:
        print("❌ Pricing Settings MISSING!")
        return

    # 2. Create a Test Fixed Route
    # Main Gate -> Admin Block (Approximate)
    pickup_coords = {"type": "Point", "coordinates": [28.4480, -14.4450]} # LNG, LAT
    dropoff_coords = {"type": "Point", "coordinates": [28.4600, -14.4200]}
    
    route_id = str(uuid.uuid4())
    fixed_route = {
        "id": route_id,
        "pickup_name": "Main Gate",
        "dropoff_name": "Admin Block",
        "pickup_coordinates": pickup_coords,
        "dropoff_coordinates": dropoff_coords,
        "tolerance_radius_meters": 500, # Large tolerance for testing
        "fixed_price": 5.0, # Very cheap fixed price to distinguish from dynamic
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.fixed_routes.delete_many({"pickup_name": "Main Gate"}) # Cleanup
    await db.fixed_routes.insert_one(fixed_route)
    print(f"✅ Created Test Fixed Route (Price: {fixed_route['fixed_price']})")
    
    # 3. Request Ride MATCHING the route
    async with httpx.AsyncClient(timeout=30.0) as http:
        # We need a valid token. Let's assume we can get one or just test the calculation function if we import it?
        # Better to test the endpoint to ensure integration is correct.
        # But we need to login. I'll login as a student.
        
        # Register/Login
        email = f"test_student_{uuid.uuid4().hex[:6]}@example.com"
        password = "password123"
        await http.post("http://localhost:8000/api/auth/register", json={
            "email": email, "password": password, "name": "Test Student", "phone": "0970000000", "role": "student"
        })
        login_res = await http.post("http://localhost:8000/api/auth/login", json={"email": email, "password": password})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print("\n--- Testing Fixed Route Match ---")
        req_data = {
            "pickup_location": {"lat": -14.4450, "lng": 28.4480, "address": "Gate"},
            "dropoff_location": {"lat": -14.4200, "lng": 28.4600, "address": "Admin"}
        }
        res = await http.post("http://localhost:8000/api/rides/request", json=req_data, headers=headers)
        
        if res.status_code == 200:
            ride = res.json()
            fare = ride["fare"]
            print(f"Requested Fare: {fare}")
            if fare == fixed_route["fixed_price"]:
                print("✅ Fixed Route Applied Correctly!")
            else:
                print(f"❌ Failed! Expected {fixed_route['fixed_price']}, got {fare}")
        else:
            print(f"❌ Ride Request Failed: {res.text}")

    # 4. Request Ride NOT matching (Dynamic)
    print("\n--- Testing Dynamic Pricing ---")
    async with httpx.AsyncClient() as http:
        # Far away points
        req_data = {
            "pickup_location": {"lat": -14.4450, "lng": 28.4480, "address": "Gate"},
            "dropoff_location": {"lat": -14.5000, "lng": 28.5000, "address": "Far Away"} # 10km+ away
        }
        res = await http.post("http://localhost:8000/api/rides/request", json=req_data, headers=headers)
        
        if res.status_code == 200:
            ride = res.json()
            fare = ride["fare"]
            print(f"Dynamic Fare: {fare}")
            
            # Expected roughly: Base(15) + Dist(~8km * 5) + Time(~10min * 2) = ~15+40+20 = ~75
            # Just check it's not the fixed price and > min_fare
            if fare > settings["minimum_fare"] and fare != fixed_route["fixed_price"]:
                 print("✅ Dynamic Pricing Active (Logic check passed)")
            else:
                 print(f"⚠️ Unexpected Fare: {fare}")
        else:
            print(f"❌ Ride Request Failed: {res.text}")
            
    # 5. Test Minimum Fare
    print("\n--- Testing Minimum Fare ---")
    async with httpx.AsyncClient() as http:
        # Very short trip
        req_data = {
            "pickup_location": {"lat": -14.4450, "lng": 28.4480, "address": "Gate"},
            "dropoff_location": {"lat": -14.4451, "lng": 28.4481, "address": "Near Gate"} # Tiny distance
        }
        res = await http.post("http://localhost:8000/api/rides/request", json=req_data, headers=headers)
        
        if res.status_code == 200:
            ride = res.json()
            fare = ride["fare"]
            print(f"Short Trip Fare: {fare}")
            
            if fare == settings["minimum_fare"]:
                 print(f"✅ Minimum Fare Enforced ({fare})")
            else:
                 print(f"❌ Failed! Expected Min {settings['minimum_fare']}, got {fare}")

    # Cleanup
    await db.fixed_routes.delete_one({"id": route_id})
    print("\nPricing Engine Verification Complete.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_pricing())
