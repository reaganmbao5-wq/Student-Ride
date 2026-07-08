import asyncio
import httpx

async def main():
    payload = {
        "ghost-driver-0": {
            "lat": -15.40720,
            "lng": 28.26871,
            "heading": 321.5
        }
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
        print(f"Status: {resp.status_code}")
        print(f"Body: {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
