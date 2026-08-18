import os
import sys
import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

load_dotenv('backend/.env')

from services.notification_service import NotificationService

async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "mulungushi_rides")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("[*] J RIDE NOTIFICATION PIPELINE INSPECTION & DISPATCH TEST")
    print("=" * 60)
    
    subscriptions = await db.push_subscriptions.find({}).to_list(100)
    print(f"Total Subscriptions Registered: {len(subscriptions)}")
    
    user_ids = []
    for idx, sub in enumerate(subscriptions, 1):
        u_id = sub.get("user_id")
        user_ids.append(u_id)
        role = sub.get("role")
        updated = sub.get("updated_at")
        endpoint = sub.get("subscription", {}).get("endpoint", "")
        endpoint_type = "FCM Native" if endpoint.startswith("FCM_TOKEN:") else "WebPush VAPID"
        
        user_doc = await db.users.find_one({"id": u_id})
        user_name = user_doc.get("name") if user_doc else "Unknown"
        user_email = user_doc.get("email") if user_doc else "Unknown"
        
        print(f"[{idx}] User: {user_name} ({user_email}) | Role: {role} | Type: {endpoint_type} | Updated: {updated}")
        print(f"    Endpoint: {endpoint[:60]}...")
    
    print("\n" + "=" * 60)
    print("[*] DISPATCHING TEST NOTIFICATIONS ACROSS ALL REGISTERED DEVICES")
    print("=" * 60)
    
    notifier = NotificationService(db)
    
    unique_users = list(set(user_ids))
    for target_user_id in unique_users:
        user_doc = await db.users.find_one({"id": target_user_id})
        user_name = user_doc.get("name", "User") if user_doc else "User"
        
        print(f"\n>> Sending Pipeline Tests to User: {user_name} (ID: {target_user_id})")
        
        # Test 1: Driver Accepted
        print("   [1/3] Dispatching 'driver_accepted' (Channel: ride_updates)...")
        res1 = await notifier.send(
            user_id=target_user_id,
            type="driver_accepted",
            payload={
                "title": "Driver on the way",
                "body": "Your driver accepted your ride and is heading your way.",
                "url": "/ride/test-verify",
                "channelId": "ride_updates"
            }
        )
        print(f"         Status: {'SUCCESS' if res1 else 'NO ACTIVE SUBSCRIPTION / FAILED'}")
        
        # Test 2: Driver Arrived (With Sound + Double Pulse)
        print("   [2/3] Dispatching 'driver_arrived' (Channel: ride_updates, Sound: YES)...")
        res2 = await notifier.send(
            user_id=target_user_id,
            type="driver_arrived",
            payload={
                "title": "Driver has arrived",
                "body": "Your driver is waiting at your pickup location.",
                "url": "/ride/test-verify",
                "channelId": "ride_updates"
            }
        )
        print(f"         Status: {'SUCCESS' if res2 else 'NO ACTIVE SUBSCRIPTION / FAILED'}")
        
        # Test 3: Admin Broadcast / Announcement
        print("   [3/3] Dispatching 'admin_broadcast' (Channel: admin_broadcast)...")
        res3 = await notifier.send(
            user_id=target_user_id,
            type="admin_broadcast",
            payload={
                "title": "J Ride System Update",
                "body": "J Ride notification pipeline verified successfully on this device.",
                "url": "/",
                "channelId": "admin_broadcast"
            }
        )
        print(f"         Status: {'SUCCESS' if res3 else 'NO ACTIVE SUBSCRIPTION / FAILED'}")

    # Check notification logs in DB
    recent_logs = await db.notification_logs.find({}).sort("_id", -1).to_list(15)
    print("\n" + "=" * 60)
    print(f"[*] RECENT NOTIFICATION DISPATCH LOGS ({len(recent_logs)} entries)")
    print("=" * 60)
    for log in recent_logs:
        print(f"- Type: {str(log.get('type')):<16} | Via: {str(log.get('sent_via')):<8} | Channel: {str(log.get('channel_id')):<16} | Title: {str(log.get('title'))}")

if __name__ == "__main__":
    asyncio.run(main())
