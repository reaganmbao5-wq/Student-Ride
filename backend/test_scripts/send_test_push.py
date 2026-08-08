import asyncio
import os
import json
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestPushScript")

async def send_test_push_notifications():
    print("=" * 60)
    print("MULU RIDES - LIVE PUSH NOTIFICATION TESTER")
    print("=" * 60)

    mongo_url = os.getenv("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.getenv("DB_NAME", "student_ride_db")
    print(f"Connecting to MongoDB database: {db_name}...")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Import notification service
    import sys
    sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
    from services.notification_service import NotificationService

    notification_svc = NotificationService(db)

    # Fetch subscriptions
    cursor = db.push_subscriptions.find({})
    subscriptions = await cursor.to_list(length=50)

    if not subscriptions:
        print("[X] NO ACTIVE PUSH SUBSCRIPTIONS FOUND IN DATABASE!")
        print("Solution: Open the Mulu Rides web app or APK, log in, and click 'Enable Notifications'.")
        return

    print(f"[OK] Found {len(subscriptions)} registered push subscription(s) in DB!")

    # Unique users
    user_ids = list(set(sub["user_id"] for sub in subscriptions))

    for uid in user_ids:
        print(f"\n[Dispatching] Test push notification to user ID: {uid}...")
        payload = {
            "title": "DRIVER HAS ARRIVED!",
            "body": "Your driver is waiting at your pickup location! (Custom intense pocket vibration alert)",
            "url": "/",
            "icon": "/logo192.png",
            "badge": "/favicon-32x32.png",
            "tag": "driver_arrived"
        }

        success = await notification_svc.send(
            user_id=uid,
            type="driver_arrived",
            payload=payload
        )

        if success:
            print(f"[SUCCESS] Push notification & custom vibration sent to user {uid}!")
        else:
            print(f"[Notice] Failed to dispatch push to user {uid}. Check VAPID/FCM credentials.")

    print("\n" + "=" * 60)
    print("Push Test Completed! Check your phone/browser screen now.")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(send_test_push_notifications())
