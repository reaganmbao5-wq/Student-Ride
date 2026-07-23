import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client['mulungushi_rides']
    
    s11 = await db.users.find_one({"email": "student11@qa.com"})
    s12 = await db.users.find_one({"email": "student12@qa.com"})
    
    ids_to_delete = []
    if s11: ids_to_delete.append(s11['id'])
    if s12: ids_to_delete.append(s12['id'])
    
    if ids_to_delete:
        res = await db.rides.delete_many({"student_id": {"$in": ids_to_delete}})
        print(f"Deleted {res.deleted_count} rides.")
        
    await db.users.update_one({"email": "binahsmarthome@gmail.com"}, {"$set": {"current_capacity": 4}})
    print("Capacity reset.")

if __name__ == "__main__":
    asyncio.run(main())
