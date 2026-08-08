import asyncio
import os
import sys
import json
import httpx

BASE_URL = "http://localhost:8000/api"

async def test_rating_flow():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Login Student A & Driver A
        student_res = await client.post("/auth/login", json={"email": "student_a@qa.com", "password": "password123"})
        student_token = student_res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}

        driver_res = await client.post("/auth/login", json={"email": "driver_a@qa.com", "password": "password123"})
        driver_token = driver_res.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}

        print("Logged in Student A and Driver A.")

        # 2. Cancel existing active rides if any
        try:
            act = await client.get("/rides/active", headers=student_headers)
            if act.status_code == 200 and act.json():
                await client.post(f"/rides/{act.json()['id']}/cancel", headers=student_headers)
        except Exception:
            pass

        # 4. Create ride and mark status as completed for test
        ride_req = {
            "pickup_location": {"lat": -14.428, "lng": 28.452, "latitude": -14.428, "longitude": 28.452, "address": "Hostels"},
            "dropoff_location": {"lat": -14.430, "lng": 28.455, "latitude": -14.430, "longitude": 28.455, "address": "Library"},
            "ride_mode": "private",
            "estimated_fare": 25.0
        }
        req_res = await client.post("/rides/request", json=ride_req, headers=student_headers)
        assert req_res.status_code == 200, f"Request failed: {req_res.text}"
        ride = req_res.json()
        ride_id = ride["id"]
        print(f"Created ride {ride_id}")

        # Mark ride as completed in DB to test rate endpoint
        from dotenv import load_dotenv
        load_dotenv("backend/.env")
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db_name = os.environ.get("DB_NAME", "mulungushi_rides")
        db = mongo_client[db_name]
        await db.rides.update_one({"id": ride_id}, {"$set": {"status": "ride_completed", "driver_id": "qa_driver_a"}})

        # 5. Rate the ride (5 stars + review)
        rate_payload = {
            "rating": 5,
            "review": "Awesome, smooth and safe driver!"
        }
        rate_res = await client.post(f"/rides/{ride_id}/rate", json=rate_payload, headers=student_headers)
        print(f"Rate ride status: {rate_res.status_code}, response: {rate_res.text}")

        assert rate_res.status_code == 200, f"Rating submission failed: {rate_res.text}"
        assert rate_res.json().get("status") == "rated", f"Unexpected response {rate_res.json()}"
        print("\nVERIFICATION PASSED: Review & rating submitted successfully without errors!")

if __name__ == "__main__":
    asyncio.run(test_rating_flow())
