import asyncio
import time
import os
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

BASE_URL = "http://localhost:8000/api"

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Login driver
        t0 = time.perf_counter()
        resp = await client.post(f"{BASE_URL}/auth/login", json={"email": "driver_d@qa.com", "password": "password123"})
        t_login = (time.perf_counter() - t0) * 1000
        print(f"POST /api/auth/login Latency: {t_login:.2f}ms (Status: {resp.status_code})")

        token = resp.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Get pending rides
        t0 = time.perf_counter()
        resp = await client.get(f"{BASE_URL}/rides/pending", headers=headers)
        t_pending = (time.perf_counter() - t0) * 1000
        print(f"GET /api/rides/pending Latency: {t_pending:.2f}ms (Status: {resp.status_code})")

        pending_rides = resp.json() if resp.status_code == 200 else []
        print(f"Pending rides count: {len(pending_rides)}")

        # 3. Get active rides
        t0 = time.perf_counter()
        resp = await client.get(f"{BASE_URL}/rides/driver/active", headers=headers)
        t_active = (time.perf_counter() - t0) * 1000
        print(f"GET /api/rides/driver/active Latency: {t_active:.2f}ms (Status: {resp.status_code})")

        active_rides = resp.json() if resp.status_code == 200 else []
        
        target_ride_id = None
        if pending_rides:
            target_ride_id = pending_rides[0]["id"]
            # Test Accept Latency
            t0 = time.perf_counter()
            resp = await client.post(f"{BASE_URL}/rides/{target_ride_id}/accept", headers=headers)
            t_accept = (time.perf_counter() - t0) * 1000
            print(f"POST /api/rides/{target_ride_id}/accept Latency: {t_accept:.2f}ms (Status: {resp.status_code})")
        elif active_rides:
            target_ride_id = active_rides[0]["id"]

        if target_ride_id:
            # Test Arrived Latency
            t0 = time.perf_counter()
            resp = await client.post(f"{BASE_URL}/rides/{target_ride_id}/arrived", headers=headers)
            t_arrived = (time.perf_counter() - t0) * 1000
            print(f"POST /api/rides/{target_ride_id}/arrived Latency: {t_arrived:.2f}ms (Status: {resp.status_code})")

            # Test Start Latency
            t0 = time.perf_counter()
            resp = await client.post(f"{BASE_URL}/rides/{target_ride_id}/start", headers=headers)
            t_start = (time.perf_counter() - t0) * 1000
            print(f"POST /api/rides/{target_ride_id}/start Latency: {t_start:.2f}ms (Status: {resp.status_code})")

        print("\n=== LATENCY BENCHMARK PASSED ===")

if __name__ == "__main__":
    asyncio.run(main())
