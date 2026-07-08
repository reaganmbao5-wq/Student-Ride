import asyncio
from server import db

async def main():
    user = await db.users.find_one({"id": "70e1552c-f48e-4834-9c52-6c190bb57792"})
    print(user)

asyncio.run(main())
