import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
import uuid

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

API_URL = "http://localhost:8000/api"

async def verify_pricing_security():
    print("Verifying Server-Only Pricing Enforcement...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Setup Data
        student_email = f"student_pricing_{uuid.uuid4().hex[:6]}@test.com"
        password = "password123"

        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": student_email, "password": password, "name": "Price Tester", "phone": "999", "role": "student"
        })
        student_token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {student_token}"}

        # 2. Manipulated Request: Send tiny fare for long distance
        print("\n--- Testing Fare Manipulation ---")
        manipulated_ride_req = {
            "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "Start"},
            "dropoff_location": {"lat": -14.50, "lng": 28.50, "address": "End (Long way)"},
            # These should now be IGNORED by server (or cause 422 if strict). 
            # We want to ensure even if passed, they are ignored.
            "estimated_fare": 5.00,  
            "estimated_distance": 0.1, 
            "estimated_duration": 1 
        }
        
        # Note: If Pydantic is set to ignore extras, this passes. If forbid, it fails (which is also secure).
        # We check response.
        resp = await client.post(f"{API_URL}/rides/request", headers=headers, json=manipulated_ride_req)
        
        if resp.status_code == 422:
             print("✅ Server REJECTED request with extra manipulated fields (Strict Schema).")
             # Retrying with valid request to check OSRM
             valid_req = {
                "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "Start"},
                "dropoff_location": {"lat": -14.50, "lng": 28.50, "address": "End (Long way)"}
             }
             resp = await client.post(f"{API_URL}/rides/request", headers=headers, json=valid_req)
        
        if resp.status_code != 200:
            print(f"❌ Failed to request ride: {resp.text}")
            return
            
        ride = resp.json()
        server_fare = ride["fare"]
        server_dist = ride["verified_distance"]
        
        print(f"Client Sent Fare: {manipulated_ride_req['estimated_fare']}")
        print(f"Server Calc Fare: {server_fare}")
        
        if server_fare > 5.00 and server_dist > 0.1:
            print("✅ Server IGNORED client estimates and calculated real fare.")
        else:
            print("❌ ERROR: Server accepted manipulated fare/distance!")

        # 3. OSRM Fallhead Check (Hard to simulate without stopping OSRM, but verifying logic exists)
        # We can check if `route_source` is present
        print(f"Route Source: {ride.get('route_source')}")
        if ride.get('route_source') == 'osrm':
             print("✅ Used OSRM for calculation")
        else:
             print("⚠️ Used Fallback (Haversine) - This should be disallowed in strict mode if OSRM is required.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_pricing_security())
