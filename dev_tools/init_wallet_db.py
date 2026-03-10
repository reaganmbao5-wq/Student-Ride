import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import logging

# Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WalletInit")

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')

if not MONGO_URL or not DB_NAME:
    logger.error("Missing MONGO_URL or DB_NAME in env")
    exit(1)

async def init_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    logger.info(f"Connected to {DB_NAME}")

    # 1. Create Indexes
    logger.info("Creating indexes for driver_wallet_transactions...")
    await db.driver_wallet_transactions.create_index("driver_id")
    await db.driver_wallet_transactions.create_index("type")
    await db.driver_wallet_transactions.create_index("timestamp")
    logger.info("Indexes created.")

    # 2. Update Existing Drivers
    logger.info("Checking existing drivers...")
    drivers = await db.drivers.find({}).to_list(None)
    
    updated_count = 0
    for driver in drivers:
        update_fields = {}
        
        if "wallet_balance" not in driver:
            update_fields["wallet_balance"] = 0.0
        if "wallet_status" not in driver:
            update_fields["wallet_status"] = "active"
        if "minimum_required_balance" not in driver:
            update_fields["minimum_required_balance"] = 50.0
        if "total_commission_due" not in driver:
            update_fields["total_commission_due"] = 0.0
        if "total_commission_paid" not in driver:
            update_fields["total_commission_paid"] = 0.0
            
        if update_fields:
            await db.drivers.update_one(
                {"id": driver["id"]},
                {"$set": update_fields}
            )
            updated_count += 1
            logger.info(f"Updated driver {driver['id']} with {list(update_fields.keys())}")
    
    logger.info(f"Finished. Updated {updated_count} drivers.")

if __name__ == "__main__":
    asyncio.run(init_db())
