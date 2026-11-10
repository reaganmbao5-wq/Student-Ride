import os
import json
import base64
import asyncio
from pywebpush import webpush, WebPushException
import logging
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, messaging, exceptions
from google.auth import exceptions as google_auth_exceptions

logger = logging.getLogger(__name__)


def _init_firebase():
    """Initialize Firebase Admin SDK from env var JSON/Base64 or fallback local key file."""
    if firebase_admin._apps:
        return True
    try:
        raw_env = (
            os.environ.get("FIREBASE_CREDENTIALS_JSON")
            or os.environ.get("FIREBASE_CREDENTIALS_BASE64")
            or ""
        ).strip()

        if raw_env:
            if not raw_env.startswith("{"):
                raw_env = base64.b64decode(raw_env).decode("utf-8")
            cred_dict = json.loads(raw_env)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized from environment variable.")
            return True

        cred_path = os.path.join(os.path.dirname(__file__), '..', 'firebase-adminsdk.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized from firebase-adminsdk.json.")
            return True

        logger.warning(
            "Firebase credentials not configured: neither FIREBASE_CREDENTIALS_JSON env var nor %s exists.",
            cred_path,
        )
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return False


class NotificationService:
    def __init__(self, db):
        self.db = db
        self.vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
        self.vapid_subject = os.environ.get("VAPID_SUBJECT") or "mailto:reaganmbao5@gmail.com"
        _init_firebase()

    async def save_subscription(self, user_id: str, role: str, subscription_info: dict, device_info: dict = None):
        """Save a new push subscription or refresh existing one for a user"""
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
        logger.info(f"Saved/Refreshed push subscription for user {user_id}")

    async def send(self, user_id: str, type: str, payload: dict):
        """
        Send a push notification across native FCM and WebPush per J Ride Implementation Specifications.
        Data-only payload architecture guarantees full client control over channels, vibrations and sounds.
        """
        # Determine Notification Channel
        channel_id = payload.get("channelId") or payload.get("channel_id")
        if not channel_id:
            if type in ["driver_accepted", "driver_arrived", "new_ride_request", "ride_started", "ride_completed", "ride_cancelled"]:
                channel_id = "ride_updates"
            elif type in ["chat_message", "new_message"]:
                channel_id = "chat_messages"
            elif type in ["emergency_sos", "emergency_alert"]:
                channel_id = "emergency_sos"
            elif type in ["admin_broadcast", "broadcast"]:
                channel_id = "admin_broadcast"
            else:
                channel_id = "account_security"

        # Specification-Compliant Titles & Copies
        title = payload.get("title")
        body = payload.get("body") or payload.get("message")

        if not title:
            if type == "driver_accepted":
                title = "Driver on the way"
                body = body or "Your driver accepted your ride and is heading your way."
            elif type == "driver_arrived":
                title = "Driver has arrived"
                body = body or "Your driver is waiting at your pickup location."
            elif type == "new_ride_request":
                title = "New ride request"
                body = body or "Pickup near your location. Tap to view."
            elif type == "ride_started":
                title = "Ride started"
                body = body or "You are on your way to the destination."
            elif type == "ride_completed":
                title = "Ride complete"
                body = body or "You've arrived at your destination."
            elif type == "ride_cancelled":
                title = "Ride cancelled"
                body = body or "The ride was cancelled."
            elif type in ["emergency_sos", "emergency_alert"]:
                title = "Emergency alert"
                body = body or "An emergency alert was triggered."
            elif type in ["chat_message", "new_message"]:
                title = payload.get("sender_name", "New message")
                body = body or "You have a new message."
            else:
                title = "J Ride"
                body = body or "You have a new update."

        # Hardware Vibration Signatures
        vibe_pattern = [0, 200]
        sound_setting = None
        if type == 'driver_arrived':
            vibe_pattern = [0, 300, 150, 300]
            sound_setting = 'default'
        elif type == 'ride_cancelled':
            vibe_pattern = [0, 300]
            sound_setting = 'default'
        elif type in ['emergency_sos', 'emergency_alert']:
            vibe_pattern = [0, 500, 200, 500, 200, 500]
            sound_setting = 'default'
        elif type == 'driver_accepted' or type == 'ride_started':
            vibe_pattern = [0, 200]
        elif type == 'ride_completed':
            vibe_pattern = [0, 150, 100, 150]
        elif type == 'chat_message':
            vibe_pattern = [0, 150]

        message = {
            "type": type,
            "payload": {
                **payload,
                "title": title,
                "body": body,
                "channelId": channel_id,
                "vibePattern": vibe_pattern,
                "tag": f"j_ride_{type}"
            }
        }
        
        # Get all subscriptions for user
        cursor = self.db.push_subscriptions.find({"user_id": user_id})
        subscriptions = await cursor.to_list(length=10)
        
        if not subscriptions:
            logger.info(f"No push subscriptions found for user {user_id}")
            return False

        vapid_private_key = self.vapid_private_key or os.environ.get("VAPID_PRIVATE_KEY")
        vapid_subject = self.vapid_subject or os.environ.get("VAPID_SUBJECT") or "mailto:reaganmbao5@gmail.com"

        success_count = 0
        for sub in subscriptions:
            try:
                sub_info = sub["subscription"]
                endpoint = sub_info.get("endpoint", "")
                
                if endpoint.startswith("FCM_TOKEN:"):
                    if not _init_firebase():
                        logger.error(f"Cannot send FCM push to {user_id}: Firebase Admin SDK is not initialized.")
                        continue

                    # Handle Native FCM Push Notification
                    fcm_token = endpoint.replace("FCM_TOKEN:", "")
                    priority = 'high' if channel_id in ['ride_updates', 'emergency_sos'] else 'normal'

                    # Data-only + Android configuration for full channel and vibration control
                    message_obj = messaging.Message(
                        notification=messaging.Notification(
                            title=title,
                            body=body,
                        ),
                        android=messaging.AndroidConfig(
                            priority=priority,
                            notification=messaging.AndroidNotification(
                                channel_id=channel_id,
                                sound=sound_setting,
                                default_vibrate_timings=False,
                                vibrate_timings_millis=vibe_pattern,
                                icon="ic_stat_notification",
                                color="#F5A623",
                                tag=f"j_ride_{type}"
                            )
                        ),
                        data={
                            "type": str(type),
                            "channel_id": str(channel_id),
                            "title": str(title),
                            "body": str(body),
                            "payload": json.dumps(message["payload"]),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        },
                        token=fcm_token,
                    )
                    
                    try:
                        response = await asyncio.to_thread(messaging.send, message_obj)
                        logger.info(f"FCM System Notification sent successfully to {user_id}: {response}")
                        success_count += 1
                        
                        # Record log entry
                        await self.db.notification_logs.insert_one({
                            "user_id": user_id,
                            "role": sub.get("role", "user"),
                            "type": type,
                            "channel_id": channel_id,
                            "title": title,
                            "body": body,
                            "sent_via": "FCM",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                    except (messaging.UnregisteredError, messaging.SenderIdMismatchError) as token_err:
                        logger.warning(f"FCM token expired/mismatched for user {user_id} ({token_err}). Purging dead subscription.")
                        await self.db.push_subscriptions.delete_one({"_id": sub["_id"]})
                    except google_auth_exceptions.RefreshError as auth_err:
                        # Server service-account credentials issue — never delete user subscriptions
                        logger.error(f"Firebase OAuth credential error sending to {user_id} (check FIREBASE_CREDENTIALS_JSON): {auth_err}")
                    except exceptions.InvalidArgumentError as arg_err:
                        err_str = str(arg_err).lower()
                        logger.error(f"Firebase invalid argument for user {user_id}: {arg_err}")
                        if "registration token" in err_str or "not a valid fcm registration token" in err_str:
                            await self.db.push_subscriptions.delete_one({"_id": sub["_id"]})
                    except exceptions.FirebaseError as f_err:
                        err_str = str(f_err).lower()
                        logger.error(f"Firebase error for user {user_id}: {f_err}")
                        if "requested entity was not found" in err_str or "unregistered" in err_str:
                            await self.db.push_subscriptions.delete_one({"_id": sub["_id"]})
                    except Exception as ex:
                        logger.error(f"Unexpected FCM send error for {user_id}: {ex}")

                else:
                    # Handle standard Web Push (VAPID)
                    if not vapid_private_key:
                        logger.warning("VAPID_PRIVATE_KEY not set for Web Push.")
                        continue
                        
                    try:
                        await asyncio.to_thread(
                            webpush,
                            subscription_info=sub_info,
                            data=json.dumps(message),
                            vapid_private_key=vapid_private_key,
                            vapid_claims={
                                "sub": vapid_subject
                            }
                        )
                        success_count += 1
                        
                        # Record log entry
                        await self.db.notification_logs.insert_one({
                            "user_id": user_id,
                            "role": sub.get("role", "user"),
                            "type": type,
                            "channel_id": channel_id,
                            "title": title,
                            "body": body,
                            "sent_via": "WebPush",
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })
                    except WebPushException as ex:
                        logger.error(f"WebPush error sending to {user_id}: {repr(ex)}")
                        # Only purge on 404/410 (subscription permanently gone/expired), never on 401/403 VAPID auth errors
                        if ex.response is not None and ex.response.status_code in [404, 410]:
                            await self.db.push_subscriptions.delete_one({"_id": sub["_id"]})
                            logger.info(f"Purged dead web push subscription for user {user_id} (status: {ex.response.status_code})")
                    except Exception as webpush_err:
                        logger.error(f"Unexpected WebPush send error for {user_id}: {webpush_err}")

            except Exception as e:
                logger.error(f"Error sending push notification to {user_id}: {e}")

        return success_count > 0
