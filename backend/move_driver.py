import asyncio
import os
import random
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def simulate_movement():
    print("Connecting to DB...")
    mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_database(os.getenv("DB_NAME", "student_ride_db"))
    
    # Get the first active driver
    driver = await db.drivers.find_one({})
    if not driver:
        print("No driver found in the database. Please register a driver first.")
        return
        
    print(f"Simulating movement for Driver: {driver['user_id']}")
    
    # Starting coordinates (e.g. Lusaka)
    current_lat = driver.get('latitude', -15.3875)
    current_lng = driver.get('longitude', 28.3228)
    
    print("Simulation started! Check your Student Dashboard map.")
    
    for i in range(20):
        # Move slightly north-east
        current_lat += 0.0001
        current_lng += 0.0001
        
        # Approximate heading for North-East
        heading = 45 
        
        await db.drivers.update_one(
            {"_id": driver["_id"]},
            {"$set": {
                "latitude": current_lat, 
                "longitude": current_lng,
                "heading": heading
            }}
        )
        print(f"[{i+1}/20] Moved to: {current_lat:.5f}, {current_lng:.5f}")
        
        # Wait 2 seconds before the next move
        await asyncio.sleep(2)
        
    print("Simulation complete.")

if __name__ == "__main__":
    asyncio.run(simulate_movement())
