import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
import websockets
import uuid
import json

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

API_URL = "http://localhost:8000/api"
WS_URL = "ws://localhost:8000/ws"

async def verify_websocket_security():
    print("Verifying WebSocket Security...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Setup User
        email = f"ws_user_{uuid.uuid4().hex[:6]}@test.com"
        password = "password123"
        resp = await client.post(f"{API_URL}/auth/register", json={
            "email": email, "password": password, "name": "WS User", "phone": "555", "role": "student"
        })
        token = resp.json()["access_token"]
        user_id = resp.json()["user"]["id"]

        # 2. Test Connection WITHOUT Token (Should Fail)
        print("\n--- Testing No Token ---")
        try:
            # Note: We changed endpoint to /ws (or /ws/{user_id} with query param?)
            # Plan is to use /ws?token=...
            # But existing was /ws/{user_id}
            # If we change to /ws, we must update this test.
            # Assuming I will change it to /ws?token=TOKEN
            async with websockets.connect(f"{WS_URL}") as ws:
                print("❌ Connected without token (Should verify auth)")
        except websockets.exceptions.InvalidStatusCode as e:
            print(f"✅ Rejected without token: {e.status_code}")
        except Exception as e:
             # Connection might close immediately
             print(f"✅ Connection failed/closed: {type(e).__name__}")

        # 3. Test Connection WITH Token (Should Succeed)
        print("\n--- Testing With Token ---")
        try:
            async with websockets.connect(f"{WS_URL}?token={token}") as ws:
                print("✅ Connected with valid token")
                
                # Test Ping/Pong
                await ws.send(json.dumps({"type": "ping"}))
                response = await asyncio.wait_for(ws.recv(), timeout=2.0)
                print(f"Response: {response}")
                if "pong" in response:
                    print("✅ Ping/Pong verified")
                    
        except Exception as e:
            print(f"❌ Failed with valid token: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_websocket_security())
