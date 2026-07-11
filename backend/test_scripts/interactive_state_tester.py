import asyncio
import os
import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

async def toggle_state():
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[os.environ.get("DB_NAME", "mulungushi_rides")]
    
    driver_id = "ghost-driver-1"
    
    print("========================================")
    print("?? DRIVER STATE CONTROLLER ??")
    print("========================================")
    print(f"Targeting: {driver_id}")
    print("Type a command and press Enter to instantly update the database:")
    print("  1  -> Go BUSY (current_ride_id = fake-ride)")
    print("  2  -> Go ONLINE (current_ride_id = null)")
    print("  3  -> Set status to shared_ride")
    print("  4  -> Set status to private_ride")
    print("  q  -> Quit")
    
    while True:
        cmd = await asyncio.to_thread(input, "\nCommand (1/2/3/4/q): ")
        cmd = cmd.strip().lower()
        
        if cmd == "q":
            break
        elif cmd == "1":
            await db.drivers.update_one({"user_id": driver_id}, {"$set": {"current_ride_id": "fake-ride"}})
            print("? Driver is now BUSY (Hidden from standard search)")
        elif cmd == "2":
            await db.drivers.update_one({"user_id": driver_id}, {"$set": {"current_ride_id": None}})
            print("? Driver is now ONLINE (Visible)")
        elif cmd == "3":
            await db.drivers.update_one({"user_id": driver_id}, {"$set": {"status": "shared_ride"}})
            print("? Driver status set to SHARED_RIDE")
        elif cmd == "4":
            await db.drivers.update_one({"user_id": driver_id}, {"$set": {"status": "private_ride"}})
            print("? Driver status set to PRIVATE_RIDE")
        else:
            print("Invalid command.")

if __name__ == "__main__":
    asyncio.run(toggle_state())
