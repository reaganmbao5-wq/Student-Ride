import asyncio
import os
import sys
import uvicorn
import httpx
import websockets
import json
import time
from threading import Thread

# Setup local testing
os.environ['MONGO_URL'] = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0'
os.environ['DB_NAME'] = 'mulungushi_rides_test'
os.environ['JWT_SECRET'] = 'test-secret'

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def run_server():
    from server import app
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

async def wait_for_server():
    async with httpx.AsyncClient() as client:
        for _ in range(30):
            try:
                resp = await client.get('http://127.0.0.1:8000/')
                if resp.status_code in [200, 404]:
                    return True
            except:
                pass
            await asyncio.sleep(1)
    return False

async def main():
    print("[FORENSIC] Live Execution Started")
    
    # We will clear DB using sync PyMongo to avoid Motor loop conflicts
    from pymongo import MongoClient
    client_sync = MongoClient(os.environ['MONGO_URL'])
    db_sync = client_sync[os.environ['DB_NAME']]
    
    print("[FORENSIC] Cleaning MongoDB...")
    db_sync.rides.delete_many({})
    db_sync.users.delete_many({})
    db_sync.drivers.delete_many({})
    
    # 2. Seed Users
    print("[FORENSIC] Seeding Student, Driver A, Driver B...")
    student_id = "student_1"
    driver_a_id = "driver_a"
    driver_b_id = "driver_b"
    
    import datetime
    now_str = datetime.datetime.utcnow().isoformat()
    db_sync.users.insert_many([
        {"id": student_id, "role": "student", "name": "Test Student", "email": "student@test.com", "phone": "+26000", "created_at": now_str},
        {"id": driver_a_id, "role": "driver", "name": "Driver A", "email": "drivera@test.com", "phone": "+26001", "created_at": now_str},
        {"id": driver_b_id, "role": "driver", "name": "Driver B", "email": "driverb@test.com", "phone": "+26002", "created_at": now_str}
    ])
    db_sync.drivers.insert_many([
        {"id": "d_a", "user_id": driver_a_id, "accepts_shared_rides": True, "is_online": True, "vehicle_capacity": 4, "current_location": {"lat": -15.4167, "lng": 28.2833}},
        {"id": "d_b", "user_id": driver_b_id, "accepts_shared_rides": True, "is_online": True, "vehicle_capacity": 4, "current_location": {"lat": -15.4168, "lng": 28.2834}}
    ])
    
    # We will simulate the frontend actions using API
    import jwt
    def create_token(payload):
        to_encode = payload.copy()
        to_encode.update({"exp": time.time() + 3600})
        return jwt.encode(to_encode, os.environ['JWT_SECRET'], algorithm="HS256")
        
    token_student = create_token({"sub": student_id, "role": "student"})
    token_a = create_token({"sub": driver_a_id, "role": "driver"})
    token_b = create_token({"sub": driver_b_id, "role": "driver"})
    
    headers_student = {"Authorization": f"Bearer {token_student}"}
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000/api") as client:
        # Student creates shared ride
        print("\n[FORENSIC] Student requests a shared ride...")
        ride_req = {
            "pickup_location": {"lat": -15.4167, "lng": 28.2833, "address": "A"},
            "dropoff_location": {"lat": -15.4168, "lng": 28.2834, "address": "B"},
            "ride_mode": "shared",
            "passenger_count": 1
        }
        res = await client.post("/rides/request", json=ride_req, headers=headers_student)
        ride_id = res.json().get("id")
        print(f"[FORENSIC] Ride created: {ride_id}")
        
        print("\n[FORENSIC] Driver B calls /rides/pending BEFORE acceptance...")
        res = await client.get("/rides/pending", headers=headers_b)
        pending_before = res.json()
        print(f"[FORENSIC] Pending Rides Count: {len(pending_before)}")
        ride_in_pending = any(r.get("id") == ride_id for r in pending_before)
        print(f"[FORENSIC] Is ride in pending? {ride_in_pending}")
        
        print("\n[FORENSIC] Connecting WebSocket for Driver B...")
        uri_b = f"ws://127.0.0.1:8000/ws?token={token_b}"
        ws_b = await websockets.connect(uri_b)
        print("[FORENSIC] Driver B WebSocket connected.")
        
        print("\n[FORENSIC] Driver A accepts the ride...")
        res = await client.post(f"/rides/{ride_id}/accept", headers=headers_a)
        print(f"[FORENSIC] Accept Response: {res.status_code} - {res.text}")
        
        print("\n[FORENSIC] Checking MongoDB state after acceptance...")
        ride_db = db_sync.rides.find_one({"id": ride_id})
        print(f"[FORENSIC] DB Ride Status: {ride_db.get('status')}, Driver ID: {ride_db.get('driver_id')}")
        
        print("\n[FORENSIC] Waiting for Driver B WebSocket message...")
        try:
            while True:
                msg = await asyncio.wait_for(ws_b.recv(), timeout=3.0)
                msg_data = json.loads(msg)
                if msg_data.get("type") == "shared_ride_accepted_by_other":
                    print(f"[FORENSIC] Driver B Received WS Message: {msg_data}")
                    break
        except asyncio.TimeoutError:
            print("[FORENSIC] ERROR: Driver B did not receive WS message!")
            
        print("\n[FORENSIC] Driver B calls /rides/pending AFTER acceptance...")
        res = await client.get("/rides/pending", headers=headers_b)
        pending_after = res.json()
        print(f"[FORENSIC] Pending Rides Count: {len(pending_after)}")
        ride_in_pending_after = any(r.get("id") == ride_id for r in pending_after)
        print(f"[FORENSIC] Is ride in pending? {ride_in_pending_after}")
        if ride_in_pending_after:
            print("[FORENSIC] HTTP Response includes the ride. THIS IS A BACKEND BUG.")
        else:
            print("[FORENSIC] HTTP Response does NOT include the ride. THIS IS A FRONTEND BUG.")
            
        await ws_b.close()
        
    print("\n[FORENSIC] Live Execution Complete. Generating report.")
    sys.exit(0)

if __name__ == "__main__":
    t = Thread(target=run_server, daemon=True)
    t.start()
    
    # We run our async logic in a fresh loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    if loop.run_until_complete(wait_for_server()):
        loop.run_until_complete(main())
    else:
        print("[FORENSIC] Server failed to start.")
        sys.exit(1)
