import os
import json
from pywebpush import webpush, WebPushException
import logging
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, messaging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
try:
    if not firebase_admin._apps:
        cred_path = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully.")
        else:
            logger.warning(f"Firebase Service Account file not found at {cred_path}")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db):
        self.db = db
        self.vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
        self.vapid_subject = os.environ.get("VAPID_SUBJECT")

    async def save_subscription(self, user_id: str, role: str, subscription_info: dict, device_info: dict = None):
        """Save a new push subscription or update existing one for a user"""
        subscription = {
            "user_id": user_id,
            "role": role,
            "subscription": subscription_info,
            "device_info": device_info or {},
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        # Upsert based on endpoint to avoid duplicates
        await self.db.push_subscriptions.update_one(
            {"subscription.endpoint": subscription_info.get("endpoint")},
            {"$set": subscription},
            upsert=True
        )
        logger.info(f"Saved push subscription for user {user_id}")

    async def send(self, user_id: str, type: str, payload: dict):
        """Send a push notification to all active subscriptions for a user"""
        if not self.vapid_private_key:
            logger.warning("VAPID_PRIVATE_KEY not set. Cannot send push notifications.")
            return False

        # Prepare message
        message = {
            "type": type,
            "payload": payload
        }
        
        # Get all subscriptions for user
        cursor = self.db.push_subscriptions.find({"user_id": user_id})
        subscriptions = await cursor.to_list(length=10)
        
        if not subscriptions:
            logger.info(f"No push subscriptions found for user {user_id}")
            return False

        success_count = 0
        for sub in subscriptions:
            try:
                sub_info = sub["subscription"]
                endpoint = sub_info.get("endpoint", "")
                
                if endpoint.startswith("FCM_TOKEN:"):
                    # Handle Native FCM Push Notification
                    fcm_token = endpoint.replace("FCM_TOKEN:", "")
                    
                    # For advanced "Live Tracking" we use data payloads.
                    # This allows the frontend Capacitor app to intercept it silently and
                    # update an ongoing persistent notification (Live Activity).
                    message_obj = messaging.Message(
                        data={
                            "type": type,
                            "payload": json.dumps(payload),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        },
                        token=fcm_token,
                    )
                    
                    response = messaging.send(message_obj)
                    logger.info(f"FCM Notification sent successfully to {user_id}: {response}")
                    success_count += 1
                else:
                    # Handle standard Web Push (VAPID)
                    if not self.vapid_private_key:
                        logger.warning("VAPID_PRIVATE_KEY not set for Web Push.")
                        continue
                        
                    webpush(
                        subscription_info=sub_info,
                        data=json.dumps(message),
                        vapid_private_key=self.vapid_private_key,
                        vapid_claims={
                            "sub": self.vapid_subject
                        }
                    )
                    success_count += 1
                    
            except WebPushException as ex:
                logger.error(f"WebPush error sending to {user_id}: {repr(ex)}")
                # If subscription is expired/invalid (410, 404), remove it
                if ex.response is not None and ex.response.status_code in [404, 410]:
                    await self.db.push_subscriptions.delete_one({"_id": sub["_id"]})
                    logger.info(f"Removed invalid push subscription for user {user_id}")
            except Exception as e:
                logger.error(f"Error sending push notification to {user_id}: {e}")

        return success_count > 0
