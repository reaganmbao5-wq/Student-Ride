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

async def verify_commission():
    print("Verifying Atomic Commission & Daily Settlement...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Setup Data
        student_email = f"student_comm_{uuid.uuid4().hex[:6]}@test.com"
        driver_email = f"driver_comm_{uuid.uuid4().hex[:6]}@test.com"
        admin_email = "admin@example.com" # Assuming this exists or we register one
        password = "password123"

        # Register Users
        # Student
        await client.post(f"{API_URL}/auth/register", json={
            "email": student_email, "password": password, "name": "Comm Student", "phone": "111", "role": "student"
        })
        resp = await client.post(f"{API_URL}/auth/login", json={"email": student_email, "password": password})
        student_token = resp.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # Driver
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": driver_email, "password": password, "name": "Comm Driver", "phone": "222", "role": "driver"
        })
        if resp.status_code == 200:
             driver_token = resp.json()["access_token"]
        else:
             # Try login if exists
             resp = await client.post(f"{API_URL}/auth/login", json={"email": driver_email, "password": password})
             driver_token = resp.json()["access_token"]
             
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Ensure driver profile exists
        await client.post(f"{API_URL}/drivers/register", headers=driver_headers, json={
            "vehicle_type": "car", "plate_number": "C-123", "vehicle_model": "Toyota", "vehicle_color": "Blue"
        })
        
        # Approve driver and topup (so they can be online/complete rides)
        # We need admin token. Assuming Super Admin exists or we created one.
        # Let's try registering a new super admin to be safe
        sa_email = f"superadmin_{uuid.uuid4().hex[:6]}@test.com"
        await client.post(f"{API_URL}/auth/register", json={
            "email": sa_email, "password": password, "name": "Super Admin", "phone": "000", "role": "super_admin"
        })
        resp = await client.post(f"{API_URL}/auth/login", json={"email": sa_email, "password": password})
        admin_token = resp.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Get driver ID
        resp = await client.get(f"{API_URL}/drivers/me", headers=driver_headers)
        driver_id = resp.json()["id"]
        
        # Topup wallet to avoid restriction (needs admin)
        await client.post(f"{API_URL}/admin/drivers/{driver_id}/topup", headers=admin_headers, json={
            "amount": 100.0, "description": "Test Topup"
        })
        
        # Improve driver approval logic here if needed, but for now topup enables wallet status.
        # We also need is_approved=True. Since we can't easily set it via API without admin endpoints we might have missed...
        # Wait, does `topup` approve? No.
        # Let's assume registration is enough for the purpose of this test or we can hack usage.
        # Actually `start_ride` checks driver profile. `toggle-online` checks approval.
        # If we can't toggle online, we can't receive broadcast, BUT we can bypass broadcast and just ACCEPT if we have ID.
        # `accept_ride` only checks `driver` exists in DB.

        # 2. Complete a Ride to Generate Commission
        print("\n--- Generating Commission ---")
        # Request
        ride_req = {
            "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "A"},
            "dropoff_location": {"lat": -14.43, "lng": 28.46, "address": "B"}
        }
        resp = await client.post(f"{API_URL}/rides/request", headers=student_headers, json=ride_req)
        ride_id = resp.json()["id"]
        
        # Accept -> Arrive -> Start -> Complete
        await client.post(f"{API_URL}/rides/{ride_id}/accept", headers=driver_headers)
        await client.post(f"{API_URL}/rides/{ride_id}/arrived", headers=driver_headers)
        await client.post(f"{API_URL}/rides/{ride_id}/start", headers=driver_headers)
        await client.post(f"{API_URL}/rides/{ride_id}/complete", headers=driver_headers)
        
        # Check Commission Due
        resp = await client.get(f"{API_URL}/drivers/me", headers=driver_headers)
        driver_data = resp.json()
        due_before = driver_data["total_commission_due"]
        print(f"Commission Due Before Settlement: {due_before}")
        
        if due_before <= 0:
             print("❌ Error: No commission generated!")
             return

        # 3. Run Daily Settlement
        print("\n--- Running Daily Settlement ---")
        resp = await client.post(f"{API_URL}/admin/settlement/daily", headers=admin_headers)
        if resp.status_code == 404:
             print("⚠️ Endpoint not implemented yet (Expected for baseline)")
             return
        elif resp.status_code != 200:
             print(f"❌ Failed to run settlement: {resp.text}")
             return
        
        result = resp.json()
        print(f"Settlement Result: {result}")
        
        # 4. Verify Result
        resp = await client.get(f"{API_URL}/drivers/me", headers=driver_headers)
        driver_data = resp.json()
        due_after = driver_data["total_commission_due"]
        paid_after = driver_data["total_commission_paid"]
        
        print(f"Commission Due After: {due_after}")
        print(f"Commission Paid After: {paid_after}")
        
        if due_after == 0 and paid_after >= due_before:
             print("✅ Settlement Successful: Due reset to 0, Paid increased.")
        else:
             print("❌ Settlement Failed!")

        # 5. Idempotency Check
        print("\n--- Testing Idempotency (Run again) ---")
        resp = await client.post(f"{API_URL}/admin/settlement/daily", headers=admin_headers)
        result2 = resp.json()
        print(f"Replica Result: {result2}")
        
        resp = await client.get(f"{API_URL}/drivers/me", headers=driver_headers)
        driver_data_2 = resp.json()
        
        if driver_data_2["total_commission_due"] == 0 and driver_data_2["total_commission_paid"] == paid_after:
             print("✅ Idempotency Verified: No double counting.")
        else:
             print("❌ Idempotency Failed!")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_commission())
