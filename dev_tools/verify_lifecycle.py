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

async def verify_lifecycle():
    print("Verifying Strict Ride Lifecycle State Machine...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Setup Data - Create Student & Drivers
        student_email = f"student_lifecycle_{uuid.uuid4().hex[:6]}@test.com"
        driver1_email = f"driver1_lifecycle_{uuid.uuid4().hex[:6]}@test.com"
        driver2_email = f"driver2_lifecycle_{uuid.uuid4().hex[:6]}@test.com"
        password = "password123"

        # Register Student
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": student_email, "password": password, "name": "Geo Student", "phone": "111", "role": "student"
        })
        student_token = resp.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Register Driver 1
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": driver1_email, "password": password, "name": "Driver One", "phone": "222", "role": "driver"
        })
        driver1_token = resp.json()["access_token"]
        driver1_headers = {"Authorization": f"Bearer {driver1_token}"}
        await client.post(f"{API_URL}/drivers/register", headers=driver1_headers, json={
            "vehicle_type": "car", "plate_number": "D1-123", "vehicle_model": "Toyota", "vehicle_color": "Blue"
        })
        # Force approve driver 1 (requires direct DB access or hack, assuming manual approve normally, here we just try to register/use)
        # Actually need to approve driver to go online. Since we don't have direct DB access here easily without importing logic, 
        # let's assume we can use the driver token. Ride endpoints check `require_driver`.
        
        # Register Driver 2
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": driver2_email, "password": password, "name": "Driver Two", "phone": "333", "role": "driver"
        })
        driver2_token = resp.json()["access_token"]
        driver2_headers = {"Authorization": f"Bearer {driver2_token}"}
        await client.post(f"{API_URL}/drivers/register", headers=driver2_headers, json={
            "vehicle_type": "car", "plate_number": "D2-123", "vehicle_model": "Honda", "vehicle_color": "Red"
        })

        # 2. Request Ride
        print("\n--- Testing Ride Request ---")
        ride_req = {
            "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "Point A"},
            "dropoff_location": {"lat": -14.43, "lng": 28.46, "address": "Point B"},
            "estimated_fare": 50, "estimated_distance": 2, "estimated_duration": 5
        }
        resp = await client.post(f"{API_URL}/rides/request", headers=student_headers, json=ride_req)
        if resp.status_code != 200:
            print(f"❌ Failed to request ride: {resp.text}")
            return
        ride_id = resp.json()["id"]
        print(f"✅ Ride Requested: {ride_id}")

        # 3. Invalid Transition: Complete before Start (Should Fail)
        print("\n--- Testing Invalid Transition (Complete before Start) ---")
        # Need to assign driver first? No, complete usually requires driver. 
        # But if we try to complete as driver 1 without accepting...
        resp = await client.post(f"{API_URL}/rides/{ride_id}/complete", headers=driver1_headers)
        if resp.status_code == 404: # Current logic: ride not found or not your ride
             print("✅ Rejecting complete before accept (404/403 expected)")
        elif resp.status_code == 200:
             print("❌ ERROR: Allowed completion before accept!")
        else:
             print(f"ℹ️ Rejected with {resp.status_code} (Good)")

        # 4. Driver 1 Accepts Ride
        print("\n--- Testing Acceptance ---")
        resp = await client.post(f"{API_URL}/rides/{ride_id}/accept", headers=driver1_headers)
        if resp.status_code == 200:
            print("✅ Driver 1 Accepted Ride")
        else:
            print(f"❌ Driver 1 Failed to accept: {resp.text}")
            return

        # 5. Concurrent Accept: Driver 2 tries to accept (Should Fail)
        print("\n--- Testing Concurrent Accept (Driver 2) ---")
        resp = await client.post(f"{API_URL}/rides/{ride_id}/accept", headers=driver2_headers)
        if resp.status_code == 400:
            print("✅ Driver 2 Rejected (Ride already taken)")
        elif resp.status_code == 200:
            print("❌ ERROR: Driver 2 accepted an already taken ride!")
        else:
            print(f"ℹ️ Driver 2 response: {resp.status_code} (Check logic)")

        # 6. Invalid Transition: Start before Arrived (Strictness check)
        # Current logic might allow this. We want to enforce strictness.
        print("\n--- Testing Order (Start before Arrived) ---")
        resp = await client.post(f"{API_URL}/rides/{ride_id}/start", headers=driver1_headers)
        if resp.status_code == 200:
            print("⚠️ Allowed Start without Arrived (Current default behavior - will fix to be strict)")
            # Reset if possible? No, move forward.
        else:
            print(f"ℹ️ Response: {resp.status_code}")

        # If previous step succeeded, we are now ONGOING.
        # Let's assume we want to test Arrived -> Start properly next time.
        
        # 7. Complete Ride (Double Completion Check)
        print("\n--- Testing Double Completion ---")
        # First completion
        resp1 = await client.post(f"{API_URL}/rides/{ride_id}/complete", headers=driver1_headers)
        print(f"Completion 1: {resp1.status_code}")
        
        # Second completion
        resp2 = await client.post(f"{API_URL}/rides/{ride_id}/complete", headers=driver1_headers)
        print(f"Completion 2: {resp2.status_code}")

        if resp1.status_code == 200 and resp2.status_code != 200:
             print("✅ Double Completion Prevented")
        elif resp1.status_code == 200 and resp2.status_code == 200:
             print("❌ ERROR: Double Completion Allowed (Double Commission Deduction!)")
        
        print("\nLifecycle Verification Complete")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_lifecycle())
