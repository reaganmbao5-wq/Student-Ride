import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
load_dotenv('backend/.env')

from services.notification_service import NotificationService

async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "mulungushi_rides")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    notifier = NotificationService(db)
    
    print("[*] SEARCHING FOR USER 'jaey' / 'jaeyv' IN DATABASE...")
    users = await db.users.find({
        "$or": [
            {"name": {"$regex": "jaey|reagan", "$options": "i"}},
            {"email": {"$regex": "jaey|reagan", "$options": "i"}}
        ]
    }).to_list(20)
    
    if not users:
        print("No exact user found with jaey/reagan. Listing all recent users:")
        all_users = await db.users.find({}).sort("_id", -1).to_list(10)
        users = all_users
        
    for u in users:
        u_id = u.get("id")
        u_name = u.get("name")
        u_email = u.get("email")
        u_role = u.get("role")
        print(f"\nTarget User: {u_name} ({u_email}) | ID: {u_id} | Role: {u_role}")
        
        subs = await db.push_subscriptions.find({"user_id": u_id}).to_list(10)
        print(f"  Push Subscriptions: {len(subs)}")
        for s in subs:
            ep = s.get("subscription", {}).get("endpoint", "")
            print(f"   - {ep[:60]}...")
            
        if subs:
            print(f"  -> Sending custom test message to {u_name}...")
            
            # Send 1: Chat message style
            res1 = await notifier.send(
                user_id=u_id,
                type="chat_message",
                payload={
                    "sender_name": "Jaey V",
                    "message": "Hello Jaey! This is a live test message from J Ride.",
                    "url": "/ride/test-chat",
                    "channelId": "chat_messages"
                }
            )
            print(f"     Chat Message Send Status: {'SUCCESS' if res1 else 'FAILED'}")
            
            # Send 2: Driver arrived alert
            res2 = await notifier.send(
                user_id=u_id,
                type="driver_arrived",
                payload={
                    "title": "Driver has arrived",
                    "body": "Your J Ride driver is waiting at the pickup location.",
                    "url": "/ride/test",
                    "channelId": "ride_updates"
                }
            )
            print(f"     Driver Arrived Send Status: {'SUCCESS' if res2 else 'FAILED'}")

if __name__ == "__main__":
    asyncio.run(main())
