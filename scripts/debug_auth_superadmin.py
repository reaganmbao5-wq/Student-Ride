import httpx
import asyncio
import sys

API_URL = "http://localhost:8000/api"

async def debug_auth():
    async with httpx.AsyncClient() as client:
        email = "Reaganmbao5@gmail.com"
        password = "superadmin123" 
        print(f"Logging in {email}...")
        try:
            resp = await client.post(f"{API_URL}/auth/login", json={"email": email, "password": password})
            print(f"Login status: {resp.status_code}")
            if resp.status_code == 200:
                print("Login SUCCESS")
            else:
                print(f"Login FAILED: {resp.text}")
        except Exception as e:
            print(f"Login failed: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_auth())
