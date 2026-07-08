import asyncio
from server import db

async def main():
    await db.users.update_one(
        {"id": "70e1552c-f48e-4834-9c52-6c190bb57792"},
        {"$set": {"pending_penalty": 0}}
    )
    print("Penalty cleared!")

asyncio.run(main())
