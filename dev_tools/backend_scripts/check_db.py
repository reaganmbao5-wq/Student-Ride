import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def check_db():
    try:
        mongo_url = os.environ.get('MONGO_URL')
        if not mongo_url:
            print("❌ MONGO_URL not found in environment variables")
            return

        print(f"Testing connection to: {mongo_url.split('@')[-1]}") # Print only host part for security
        
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        
        # specific to motor: verify connection by retrieving server info
        info = await client.server_info()
        
        print("✅ Database Connection Successful!")
        print(f"   Server version: {info.get('version')}")
        
        # Check if database exists/can be accessed
        db_name = os.environ.get('DB_NAME', 'test_db')
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"   Database '{db_name}' accessible. Collections: {len(collections)}")
        
    except Exception as e:
        print(f"❌ Database Connection Failed: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
