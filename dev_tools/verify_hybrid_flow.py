
import asyncio
import sys
import os
from pathlib import Path
import httpx
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')
API_URL = "http://localhost:8000/api"

async def setup_ride_for_browser():
    print("--- Setting up Ride for Browser Verification ---")
    
    async with httpx.AsyncClient() as client:
        # 1. Login Student
        res = await client.post(f"{API_URL}/auth/login", json={
            "email": "browser_student@test.com", "password": "student123"
        })
        student_token = res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        # 2. Login Driver
        res = await client.post(f"{API_URL}/auth/login", json={
            "email": "neon_driver@test.com", "password": "driver123"
        })
        driver_token = res.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # 3. Create Request (Matching Fixed Route)
        # Pickup: Test Pickup (From Admin step) -> Center?
        # Fixed Route logic uses minimal distance.
        # I need coordinates that match the fixed route created by Admin.
        # Admin: Created via map click.
        # I don't know EXACT coords. 
        # BUT, I can Create a NEW Fixed Route via API first to be sure!
        
        # 3a. Create Fixed Route via API (Admin)
        res = await client.post(f"{API_URL}/auth/login", json={
            "email": "superadmin@rides.com", "password": "admin123"
        })
        admin_token = res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Ensure previous routes are clear or ignored?
        # Create a specific one.
        fixed_route = {
            "pickup_name": "Hybrid Pickup",
            "dropoff_name": "Hybrid Dropoff",
            "pickup_coordinates": {"type": "Point", "coordinates": [28.5, -14.5]},
            "dropoff_coordinates": {"type": "Point", "coordinates": [28.6, -14.6]},
            "tolerance_radius_meters": 500, # Generous
            "fixed_price": 75.0,
            "is_active": True
        }
        await client.post(f"{API_URL}/admin/fixed-routes", headers=admin_headers, json=fixed_route)
        print("✅ Created Fixed Route 'Hybrid' (K75.00)")
        
        # 4. Request Ride
        ride_req = {
            "pickup_location": {"lat": -14.5, "lng": 28.5, "address": "Hybrid Pickup"},
            "dropoff_location": {"lat": -14.6, "lng": 28.6, "address": "Hybrid Dropoff"},
            "estimated_fare": 0, "estimated_distance": 0, "estimated_duration": 0
        }
        res = await client.post(f"{API_URL}/rides/request", headers=student_headers, json=ride_req)
        if res.status_code != 200:
            print(f"❌ Params failed: {res.text}")
            return
            
        ride = res.json()
        print(f"✅ Ride Requested. Fare: {ride['fare']} (Expected: 75.0)")
        
        # 5. Accept Ride
        res = await client.post(f"{API_URL}/rides/{ride['id']}/accept", headers=driver_headers)
        if res.status_code == 200:
            print("✅ Driver Accepted Ride (Neon Green)")
        else:
            print(f"❌ Accept Failed: {res.text}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(setup_ride_for_browser())
