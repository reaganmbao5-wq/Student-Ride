import asyncio
import os
import json
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import firebase_admin
from firebase_admin import credentials, messaging
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

async def simulate():
    print("Connecting to DB...")
    mongo_url = os.getenv("MONGO_URL")
    print(f"MONGO_URL loaded: {mongo_url is not None}")
    client = AsyncIOMotorClient(mongo_url or "mongodb://localhost:27017")
    db = client.get_database(os.getenv("DB_NAME", "student_ride_db"))
    
    # Init Firebase
    print("Initializing Firebase...")
    cred_path = os.path.join(os.path.dirname(__file__), 'firebase-adminsdk.json')
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

    # Find the most recently updated push subscription with an FCM token
    cursor = db.push_subscriptions.find({"subscription.endpoint": {"$regex": "^FCM_TOKEN:"}}).sort("updated_at", -1).limit(1)
    subs = await cursor.to_list(length=1)
    
    if not subs:
        print("No native FCM subscriptions found in DB! Please login on the app and allow notifications first.")
        return
        
    sub = subs[0]
    fcm_token = sub["subscription"]["endpoint"].replace("FCM_TOKEN:", "")
    user_id = sub["user_id"]
    print(f"Found active FCM subscription for user {user_id}. Simulating ride...")
    
    # Simulate driver moving closer
    etas = [10, 8, 5, 2, 1]
    
    for eta in etas:
        print(f"Sending ETA: {eta} mins...")
        
        message_obj = messaging.Message(
            notification=messaging.Notification(
                title="Driver is approaching...",
                body=f"Your ride is arriving in {eta} minutes."
            ),
            android=messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    tag="live_tracking", # This is the magic key that overwrites the existing notification!
                    priority="high",
                    sound="default"
                )
            ),
            data={
                "type": "LIVE_TRACKING_UPDATE",
                "eta": str(eta)
            },
            token=fcm_token,
        )
        
        try:
            response = messaging.send(message_obj)
            print(f"Sent successfully! Message ID: {response}")
        except Exception as e:
            print(f"Failed to send: {e}")
            
        # Wait a few seconds before next update
        await asyncio.sleep(4)
        
    print("Simulation complete!")

if __name__ == "__main__":
    asyncio.run(simulate())
