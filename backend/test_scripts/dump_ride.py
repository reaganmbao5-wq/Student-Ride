import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def run():
    url = "mongodb+srv://reaganmbao5:Wl7r8L2vjI5G43jD@cluster0.oouhe0w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    client = AsyncIOMotorClient(url)
    db = client['test']
    ride = await db.rides.find_one({}, sort=[('created_at', -1)])
    print("LATEST RIDE:")
    print(ride)

asyncio.run(run())
