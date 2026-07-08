import asyncio
from server import db, create_token
async def main():
    user = await db.users.find_one({"role": "student"})
    if user:
        token = create_token(user["id"], user["role"])
        print(f"TOKEN={token}")
    else:
        print("No student found.")
asyncio.run(main())
