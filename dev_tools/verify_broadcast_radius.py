import asyncio
import sys
import os
import json
import httpx
from pathlib import Path
from dotenv import load_dotenv
import websockets

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

API_URL = "http://localhost:8000/api"
WS_URL = "ws://localhost:8000/ws"

# Fix for Windows Unicode output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import time

async def create_driver(client, name, email_prefix, lat, lng):
    timestamp = int(time.time())
    email = f"{email_prefix}_{timestamp}@test.com"
    try:
        await client.post(f"{API_URL}/auth/register", json={
            "email": email, "password": "password123", "name": name, "phone": "555-0000", "role": "driver"
        })
    except:
        pass
    
    await asyncio.sleep(1)
    resp = await client.post(f"{API_URL}/auth/login", json={"email": email, "password": "password123"})
    if resp.status_code != 200:
        print(f"Login failed for {name}: {resp.text}")
        return None, None
        
    token = resp.json().get("access_token")
    user_id = resp.json()["user"]["id"]
    
    # Update location
    async with websockets.connect(f"{WS_URL}?token={token}") as ws:
        await ws.send(json.dumps({
            "type": "location_update",
            "location": {"lat": lat, "lng": lng}
        }))
        # Go online
        await client.post(f"{API_URL}/drivers/toggle-online", headers={"Authorization": f"Bearer {token}"})
        
    return token, user_id

async def verify_broadcast_radius():
    print("Verifying Broadcast Radius...")
    async with httpx.AsyncClient() as client:
        # Create Driver A (Close - 1km away)
        # Campus center approx (-29.0, 30.0) -> 1km is approx 0.01 deg lat
        token_a, id_a = await create_driver(client, "Driver Close", "driver_close", -29.01, 30.01)
        print(f"✅ Driver A (Close) created: {id_a}")
        
        # Create Driver B (Far - 15km away)
        token_b, id_b = await create_driver(client, "Driver Far", "driver_far", -29.15, 30.15)
        print(f"✅ Driver B (Far) created: {id_b}")
        
        # Connect both to WS to listen for requests
        async with websockets.connect(f"{WS_URL}?token={token_a}") as ws_a, \
                   websockets.connect(f"{WS_URL}?token={token_b}") as ws_b:
                   
            # Create Student and Request Ride
            print("Student requesting ride at (-29.0, 30.0)...")
            timestamp_s = int(time.time())
            email_s = f"student_broadcast_{timestamp_s}@test.com"
            try:
                await client.post(f"{API_URL}/auth/register", json={
                    "email": email_s, "password": "password123", "name": "Student B", "phone": "555-STU", "role": "student"
                })
            except:
                pass
            
            await asyncio.sleep(1)
            resp_s = await client.post(f"{API_URL}/auth/login", json={"email": email_s, "password": "password123"})
            if resp_s.status_code != 200:
                print(f"Student login failed: {resp_s.text}")
                return
            
            token_s = resp_s.json().get("access_token")
            
            # Request Ride
            req_payload = {
                "pickup_location": {"lat": -29.0, "lng": 30.0, "address": "Campus Center"},
                "dropoff_location": {"lat": -29.05, "lng": 30.05, "address": "Dorms"}
            }
            await client.post(f"{API_URL}/rides/request", json=req_payload, headers={"Authorization": f"Bearer {token_s}"})
            
            # Check who gets the message
            print("Listening for broadcast...")
            
            try:
                msg_a = await asyncio.wait_for(ws_a.recv(), timeout=5.0)
                print(f"✅ Driver A received: {msg_a[:50]}...")
            except asyncio.TimeoutError:
                print("❌ Driver A DID NOT receive message (Expected success)")
                
            try:
                msg_b = await asyncio.wait_for(ws_b.recv(), timeout=2.0)
                print(f"❌ Driver B received: {msg_b[:50]}... (Should not have!)")
            except asyncio.TimeoutError:
                print("✅ Driver B sent NO message (Expected success)")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_broadcast_radius())
