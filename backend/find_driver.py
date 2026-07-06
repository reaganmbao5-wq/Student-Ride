import asyncio
from server import db

async def main():
    driver = await db.drivers.find_one({})
    if driver:
        print(f"Found driver: {driver['id']} user: {driver['user_id']}")
    else:
        print("No drivers found")

asyncio.run(main())
