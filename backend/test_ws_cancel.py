import asyncio
import os
import sys
import json
import httpx
import websockets

# Test student cancellation live WebSocket flow
BASE_URL = "http://localhost:8000/api"
WS_URL = "ws://localhost:8000/ws"

async def test_websocket_cancellation():
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # 1. Login Student
        student_res = await client.post("/auth/login", json={"email": "student_a@qa.com", "password": "password123"})
        if student_res.status_code != 200:
            print(f"Student login failed: {student_res.text}")
            return
        student_token = student_res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 2. Login Driver
        driver_res = await client.post("/auth/login", json={"email": "driver_a@qa.com", "password": "password123"})
        if driver_res.status_code != 200:
            print(f"Driver login failed: {driver_res.text}")
            return
        driver_token = driver_res.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}

        print("Logged in both Student and Driver successfully.")

        # 3. Connect Driver WebSocket
        driver_ws_url = f"{WS_URL}?token={driver_token}"
        async with websockets.connect(driver_ws_url) as driver_ws:
            print("Driver connected to WebSocket.")

            # 3.5 Clear any existing active rides for student
            try:
                active_res = await client.get("/rides/active", headers=student_headers)
                if active_res.status_code == 200 and active_res.json():
                    active_ride = active_res.json()
                    await client.post(f"/rides/{active_ride['id']}/cancel", headers=student_headers)
            except Exception as e:
                pass

            # 4. Student creates a ride request
            ride_req = {
                "pickup_location": {"lat": -14.428, "lng": 28.452, "latitude": -14.428, "longitude": 28.452, "address": "Hostels"},
                "dropoff_location": {"lat": -14.430, "lng": 28.455, "latitude": -14.430, "longitude": 28.455, "address": "Library"},
                "ride_mode": "private",
                "estimated_fare": 25.0
            }
            create_res = await client.post("/rides/request", json=ride_req, headers=student_headers)
            if create_res.status_code != 200:
                print(f"Ride creation failed: {create_res.text}")
                return
            ride = create_res.json()
            ride_id = ride["id"]
            print(f"Created ride {ride_id}")

            # 5. Driver accepts ride
            accept_res = await client.post(f"/rides/{ride_id}/accept", headers=driver_headers)
            print(f"Driver accepted ride: status {accept_res.status_code}")

            # Drain any initial websocket messages on driver_ws
            try:
                msg = await asyncio.wait_for(driver_ws.recv(), timeout=1.0)
                print(f"Driver WS initial msg received: {msg[:100]}")
            except asyncio.TimeoutError:
                pass

            # 6. Student cancels ride
            cancel_res = await client.post(f"/rides/{ride_id}/cancel", headers=student_headers)
            print(f"Student cancelled ride: status {cancel_res.status_code}, response: {cancel_res.json()}")

            # 7. Listen for instant WebSocket message on Driver WS
            try:
                ws_msg = await asyncio.wait_for(driver_ws.recv(), timeout=3.0)
                msg_data = json.loads(ws_msg)
                print(f"\nSUCCESS! Received instant WebSocket message on Driver portal: {msg_data}")
                assert msg_data.get("type") in ["ride_cancelled", "shared_ride_cancelled", "route_queue_update"], f"Unexpected msg type {msg_data.get('type')}"
                print("\nVERIFICATION PASSED: Driver received instant WebSocket cancellation notice!")
            except asyncio.TimeoutError:
                print("\nFAILURE: Timed out waiting for WebSocket message on Driver portal!")

if __name__ == "__main__":
    asyncio.run(test_websocket_cancellation())
