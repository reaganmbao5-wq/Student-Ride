
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

# Load env from backend/.env
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

async def init_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Initializing Pricing DB...")
    
    # 1. Create indexes
    await db.fixed_routes.create_index([("pickup_coordinates", "2dsphere")])
    await db.fixed_routes.create_index([("dropoff_coordinates", "2dsphere")])
    print("✅ Created fixed_routes indexes")
    
    # 2. logical check
    existing = await db.pricing_settings.find_one({})
    if not existing:
        default_settings = {
            "base_fare": 15.0,
            "per_km_rate": 5.0,
            "per_minute_rate": 2.0,
            "surge_multiplier": 1.0,
            "minimum_fare": 20.0,
            "updated_at": datetime.now(timezone.utc)
        }
        await db.pricing_settings.insert_one(default_settings)
        print("✅ Inserted default Pricing Settings")
    else:
        print("ℹ️ Pricing Settings already exist")

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(init_db())
