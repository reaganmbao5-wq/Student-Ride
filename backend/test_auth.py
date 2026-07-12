import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        resp = await client.post("http://localhost:8000/api/auth/register", json={
            "email": "test_script_foo@test.com",
            "password": "password123",
            "name": "Test",
            "role": "student",
            "phone": "+26012345678"
        })
        print(resp.json())

asyncio.run(test())
