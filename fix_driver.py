import re
with open('backend/test_scripts/test_state_machine.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''
        print(f"Driver token acquired.")
        
        # Inject driver profile since registration doesn't create it automatically
        driver_user = await db.users.find_one({"email": driver_email})
        driver_profile = await db.drivers.find_one({"user_id": driver_user["id"]})
        if not driver_profile:
            import uuid
            driver_doc = {
                "id": str(uuid.uuid4()),
                "user_id": driver_user["id"],
                "vehicle_make": "Toyota",
                "vehicle_model": "Corolla",
                "vehicle_color": "Silver",
                "vehicle_plate": "TEST-123",
                "vehicle_capacity": 4,
                "accepts_shared_rides": True,
                "is_approved": True,
                "vehicle_verified": True,
                "is_online": True,
                "wallet_balance": 100.0,
                "wallet_status": "active"
            }
            await db.drivers.insert_one(driver_doc)
        else:
            await db.drivers.update_one({"user_id": driver_user["id"]}, {"": {"is_approved": True, "is_online": True}})
        
        print("Test Driver profile injected and force-approved in DB.")
'''

content = content.replace('''
        print(f"Driver token acquired.")
        
        # Approve driver (requires DB hack for testing, or we just assume they can accept rides)
        # Wait, the driver must be approved! Let's do a quick DB update.
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_client = AsyncIOMotorClient(mongo_url)
        db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]
        await db.drivers.update_one({"user.email": driver_email}, {"": {"is_approved": True}})
        # The user_id is needed, let's just approve all drivers
        await db.drivers.update_many({}, {"": {"is_approved": True, "vehicle_verified": True}})
        print("Test Drivers force-approved in DB.")
'''.strip(), replacement.strip())

# also need to make sure db_client is still initialized, put it before stage 1
init_db = '''
    async with httpx.AsyncClient() as client:
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_client = AsyncIOMotorClient(mongo_url)
        db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]
        print("=== STAGE 1: Authentication ===")
'''

content = content.replace('''
    async with httpx.AsyncClient() as client:
        print("=== STAGE 1: Authentication ===")
'''.strip(), init_db.strip())

with open('backend/test_scripts/test_state_machine.py', 'w', encoding='utf-8') as f:
    f.write(content)
