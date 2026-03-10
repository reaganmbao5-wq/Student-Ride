import httpx
import asyncio
import sys

API_URL = "http://localhost:8000/api"

async def debug_auth():
    async with httpx.AsyncClient() as client:
        email = "debug_driver_1@test.com"
        print(f"Registering {email}...")
        try:
            resp = await client.post(f"{API_URL}/auth/register", json={
                "email": email, "password": "password123", "name": "Debug Driver", "phone": "555-999", "role": "driver"
            })
            print(f"Register status: {resp.status_code}")
            print(f"Register response: {resp.text}")
        except Exception as e:
            print(f"Register failed: {e}")

        print(f"Logging in {email}...")
        resp = await client.post(f"{API_URL}/auth/login", json={"email": email, "password": "password123"})
        print(f"Login status: {resp.status_code}")
        print(f"Login response: {resp.text}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_auth())
