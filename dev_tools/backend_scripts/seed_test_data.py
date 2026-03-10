"""
Seed Test Data Script for Mulungushi Rides
Run this to populate the database with test accounts and sample data
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

# Test Credentials
TEST_ACCOUNTS = {
    "student": {
        "email": "student@test.com",
        "password": "student123",
        "name": "Test Student",
        "phone": "+260971234567",
        "role": "student"
    },
    "driver": {
        "email": "driver@test.com",
        "password": "driver123",
        "name": "Test Driver",
        "phone": "+260971234568",
        "role": "driver",
        "vehicle": {
            "vehicle_type": "car",
            "plate_number": "ABC 1234",
            "vehicle_model": "Toyota Corolla",
            "vehicle_color": "White"
        }
    },
    "admin": {
        "email": "admin@test.com",
        "password": "admin123",
        "name": "Test Admin",
        "phone": "+260971234569",
        "role": "admin"
    },
    "super_admin": {
        "email": "reaganmbao5@gmail.com",
        "password": "superadmin123",
        "name": "Reagan Mbao",
        "phone": "+260971234570",
        "role": "super_admin"
    }
}

# Sample Destinations
SAMPLE_DESTINATIONS = [
    {
        "name": "Mulungushi University",
        "address": "Great North Road, Kabwe",
        "latitude": -14.4387,
        "longitude": 28.2849,
        "estimated_fare": 15.0,
        "base_price": 15.0,
        "estimated_distance_km": 3.0,
        "is_active": True
    },
    {
        "name": "Kabwe Town Center",
        "address": "Independence Avenue, Kabwe",
        "latitude": -14.4467,
        "longitude": 28.4467,
        "estimated_fare": 25.0,
        "base_price": 25.0,
        "estimated_distance_km": 5.0,
        "is_active": True
    },
    {
        "name": "Great North Mall",
        "address": "Great North Road, Kabwe",
        "latitude": -14.4287,
        "longitude": 28.4567,
        "estimated_fare": 30.0,
        "base_price": 30.0,
        "estimated_distance_km": 7.0,
        "is_active": True
    }
]

async def seed_database():
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🌱 Seeding test data...")
    
    # Clear existing test data
    print("  Clearing existing test accounts...")
    await db.users.delete_many({"email": {"$in": [acc["email"] for acc in TEST_ACCOUNTS.values()]}})
    
    # Create test users
    print("  Creating test users...")
    user_ids = {}
    for role, account in TEST_ACCOUNTS.items():
        user_id = str(uuid.uuid4())
        user_ids[role] = user_id
        
        hashed_password = bcrypt.hashpw(account["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        user_doc = {
            "id": user_id,
            "email": account["email"],
            "password": hashed_password,
            "name": account["name"],
            "phone": account["phone"],
            "role": account["role"],
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        print(f"    ✓ Created {role}: {account['email']}")
    
    # Create driver profile
    print("  Creating driver profile...")
    driver_account = TEST_ACCOUNTS["driver"]
    driver_id = str(uuid.uuid4())
    driver_doc = {
        "id": driver_id,
        "user_id": user_ids["driver"],
        "vehicle_type": driver_account["vehicle"]["vehicle_type"],
        "plate_number": driver_account["vehicle"]["plate_number"],
        "vehicle_model": driver_account["vehicle"]["vehicle_model"],
        "vehicle_color": driver_account["vehicle"]["vehicle_color"],
        "is_approved": True,  # Pre-approve for testing
        "is_online": False,
        "is_available": True,
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.drivers.insert_one(driver_doc)
    print(f"    ✓ Driver profile created and APPROVED")
    
    # Create sample destinations
    print("  Creating sample destinations...")
    await db.destinations.delete_many({})  # Clear existing
    for dest in SAMPLE_DESTINATIONS:
        dest_doc = {
            "id": str(uuid.uuid4()),
            **dest,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.destinations.insert_one(dest_doc)
        print(f"    ✓ Added destination: {dest['name']}")
    
    print("\n✅ Test data seeded successfully!")
    print("\n📋 TEST CREDENTIALS:")
    print("=" * 60)
    for role, account in TEST_ACCOUNTS.items():
        print(f"\n{role.upper().replace('_', ' ')}:")
        print(f"  Email: {account['email']}")
        print(f"  Password: {account['password']}")
        if role == "driver":
            print(f"  Status: APPROVED & READY TO GO ONLINE")
    print("\n" + "=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
