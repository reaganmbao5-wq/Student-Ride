import asyncio
from server import db

async def main():
    # Find the most recent requested ride
    ride = await db.rides.find_one({"status": "accepted"}, sort=[("created_at", -1)])
    
    if not ride:
        ride = await db.rides.find_one({"status": "requested"}, sort=[("created_at", -1)])
    
    if not ride:
        print("No rides found!")
        return
        
    # Update it to accepted and assign a REAL driver
    await db.rides.update_one(
        {"_id": ride["_id"]},
        {
            "$set": {
                "status": "accepted",
                "driver_id": "f294d7f5-8463-475e-bde4-9491065548fd"
            }
        }
    )
    
    print(f"Ride {ride['_id']} accepted with real driver!")

asyncio.run(main())
