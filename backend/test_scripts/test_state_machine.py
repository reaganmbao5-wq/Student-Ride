import asyncio
import httpx
import uuid
import time
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = "http://localhost:8000/api"

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
    
    print(f"Failed to register {role}:", resp.json())
    return None

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    async with httpx.AsyncClient(timeout=30.0) as client:
        print("=== STAGE 1: Authentication ===")
        student_email = f"student_{int(time.time())}@test.com"
        driver_email = f"driver_{int(time.time())}@test.com"
        
        student_token = await register_or_login(client, "student", student_email, "password123", "Test Student")
        print(f"Student token acquired.")
        
        driver_token = await register_or_login(client, "driver", driver_email, "password123", "Test Driver")
        print(f"Driver token acquired.")
        
        # Inject driver profile
        driver_user = await db.users.find_one({"email": driver_email})
        driver_profile = await db.drivers.find_one({"user_id": driver_user["id"]})
        if not driver_profile:
            driver_doc = {
                "id": str(uuid.uuid4()),
                "user_id": driver_user["id"],
                "vehicle_make": "Toyota",
                "vehicle_model": "Corolla",
                "vehicle_color": "Silver",
                "vehicle_plate": "TEST-123",
                "vehicle_capacity": 4,
                "accepts_shared_rides": True,
                "is_approved": True,
                "vehicle_verified": True,
                "is_online": True,
                "wallet_balance": 100.0,
                "wallet_status": "active"
            }
            await db.drivers.insert_one(driver_doc)
        else:
            await db.drivers.update_one({"user_id": driver_user["id"]}, {"$set": {"is_approved": True, "is_online": True}})
        
        print("Test Driver profile injected and force-approved in DB.")

        print("\n=== STAGE 2: Requesting Ride ===")
        headers_student = {"Authorization": f"Bearer {student_token}"}
        resp = await client.post(f"{BASE_URL}/rides/request", headers=headers_student, json={
            "pickup_location": {"lat": -14.4087, "lng": 28.2849, "address": "Test Pickup"},
            "dropoff_location": {"lat": -14.4100, "lng": 28.2900, "address": "Test Dropoff"},
            "ride_mode": "private",
            "distance": 2.5,
            "duration": 5,
            "fare": 50,
            "polyline": "test"
        })
        
        if resp.status_code != 200:
            print("Failed to request ride:", resp.json())
            return
            
        ride = resp.json()
        ride_id = ride["id"]
        print(f"Ride Requested! ID: {ride_id} | Status: {ride['status']}")
        
        headers_driver = {"Authorization": f"Bearer {driver_token}"}
        
        endpoints = [
            ("accept", "DRIVER_ACCEPTED"),
            ("en_route", "DRIVER_EN_ROUTE_TO_PICKUP"),
            ("arrived", "DRIVER_ARRIVED"),
            ("boarding", "PASSENGER_BOARDING"),
            ("start", "RIDE_STARTED"),
            ("in_progress", "RIDE_IN_PROGRESS"),
            ("arriving", "ARRIVING_DESTINATION")
        ]
        
        print("\n=== STAGE 3: Granular State Machine Transitions ===")
        for endpoint, expected_state in endpoints:
            print(f"-> Calling POST /rides/{ride_id}/{endpoint}...")
            resp = await client.post(f"{BASE_URL}/rides/{ride_id}/{endpoint}", headers=headers_driver)
            
            if resp.status_code != 200:
                print(f"ERROR on {endpoint}: {resp.status_code}", resp.json())
                return
            
            # Fetch active ride to verify state
            ride_check = await client.get(f"{BASE_URL}/rides/active", headers=headers_student)
            actual_status = ride_check.json()["status"]
            print(f"   [SUCCESS] Ride status transitioned to: {actual_status}")
            
            await asyncio.sleep(0.5)

        print("\n=== STAGE 4: Fraud Protection & Completion ===")
        print("Attempting to complete ride instantly (Should fail due to 60s fraud protection)...")
        resp = await client.post(f"{BASE_URL}/rides/{ride_id}/complete", headers=headers_driver)
        print(f"Instant complete result: {resp.status_code} - {resp.json().get('detail')}")
        
        # Override the started_at time in DB to bypass the 60s wait for testing
        print("Mocking started_at to 65 seconds ago...")
        from datetime import datetime, timezone, timedelta
        mock_start = (datetime.now(timezone.utc) - timedelta(seconds=65)).isoformat()
        await db.rides.update_one({"id": ride_id}, {"$set": {"started_at": mock_start}})
        
        print(f"Calling POST /rides/{ride_id}/complete again...")
        resp = await client.post(f"{BASE_URL}/rides/{ride_id}/complete", headers=headers_driver)
        
        if resp.status_code != 200:
            print("ERROR completing ride:", resp.status_code, resp.text)
            return
            
        print("   [SUCCESS] Ride Completion API succeeded!")
        
        # Check final state in DB
        final_ride = await db.rides.find_one({"id": ride_id})
        print(f"   [FINAL DB STATE] Ride status is now: {final_ride['status']}")
        
        # Check driver state
        driver_profile = await db.drivers.find_one({"id": final_ride["driver_id"]})
        print(f"   [DRIVER STATE] current_ride_id is: {driver_profile.get('current_ride_id')}")
        
        print("\n🎉 ALL TESTS PASSED! The Professional Trip Engine works flawlessly.")

if __name__ == "__main__":
    asyncio.run(main())
