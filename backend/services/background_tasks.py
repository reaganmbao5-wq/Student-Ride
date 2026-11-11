import asyncio
import logging
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


def _short_place(loc: dict, default_label: str = "Campus") -> str:
    if not isinstance(loc, dict):
        return default_label
    raw = loc.get("name") or loc.get("address") or default_label
    parts = [p.strip() for p in str(raw).split(",") if p.strip()]
    if not parts:
        return default_label
    return ", ".join(parts[:2]) if len(parts) > 1 else parts[0]


class BackgroundOrchestrator:
    """
    Manages background tasks for timeouts, unassigned ride alerts, weekly admin digests, and seat expiry.
    """
    def __init__(self, db, event_bus, notify_admins_fn=None):
        self.db = db
        self.event_bus = event_bus
        self.notify_admins_fn = notify_admins_fn
        self.is_running = False

    async def start(self):
        self.is_running = True
        asyncio.create_task(self._timeout_loop())
        logger.info("Background Orchestrator started.")

    def stop(self):
        self.is_running = False
        logger.info("Background Orchestrator stopped.")

    async def _timeout_loop(self):
        while self.is_running:
            try:
                await self._expire_stale_requests()
                await self._release_expired_seats()
                await self._check_unassigned_rides()
                await self._check_weekly_summary()
            except Exception as e:
                logger.error(f"Error in BackgroundOrchestrator loop: {e}")
            await asyncio.sleep(60)  # Run every 60 seconds

    async def _expire_stale_requests(self):
        """Expire ride requests that have been waiting > 10 minutes."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        # Reserved for stale request expiry
        pass

    async def _release_expired_seats(self):
        """Releases reserved seats that have expired (abandoned bookings)."""
        now = datetime.now(timezone.utc).isoformat()

        await self.db.driver_trips.update_many(
            {"seat_reservations.expiry_time": {"$lt": now}},
            {
                "$pull": {
                    "seat_reservations": {"expiry_time": {"$lt": now}}
                }
            }
        )

    async def _check_unassigned_rides(self):
        """Alerts admins once if a requested ride has been waiting 5+ minutes with no driver assigned."""
        if not self.notify_admins_fn:
            return

        now = datetime.now(timezone.utc)
        five_min_ago = (now - timedelta(minutes=5)).isoformat()
        thirty_min_ago = (now - timedelta(minutes=30)).isoformat()

        waiting_rides = await self.db.rides.find({
            "status": "requested",
            "created_at": {"$lte": five_min_ago, "$gte": thirty_min_ago},
            "admin_unassigned_notified": {"$ne": True}
        }).to_list(50)

        for ride in waiting_rides:
            res = await self.db.rides.update_one(
                {"id": ride["id"], "admin_unassigned_notified": {"$ne": True}},
                {"$set": {"admin_unassigned_notified": True}}
            )
            if res.modified_count == 0:
                continue

            student = await self.db.users.find_one({"id": ride.get("student_id")}, {"name": 1})
            student_name = (student.get("name") if student else None) or ride.get("student_name") or "A passenger"
            pickup_label = _short_place(ride.get("pickup_location"), "pickup")
            dropoff_label = _short_place(ride.get("dropoff_location"), "destination")

            await self.notify_admins_fn(
                event_type="unassigned_ride_warning",
                title="Ride Waiting for Driver",
                body=f"{student_name}'s request from {pickup_label} to {dropoff_label} has been waiting 5 minutes with no driver assigned.",
                url="/admin/rides",
                tag=f"unassigned-ride-{ride['id']}"
            )

    async def _check_weekly_summary(self):
        """Sends a weekly summary notification to admins every Sunday at 18:00 CAT (UTC+2)."""
        if not self.notify_admins_fn:
            return

        cat_tz = timezone(timedelta(hours=2))
        now_cat = datetime.now(cat_tz)

        # Sunday is weekday() == 6; trigger at or after 18:00 CAT
        if now_cat.weekday() != 6 or now_cat.hour < 18:
            return

        iso_year, iso_week, _ = now_cat.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"

        counter_doc = await self.db.settings.find_one({"type": "admin_notification_counters"}) or {}
        if counter_doc.get("last_weekly_summary_week") == week_key:
            return

        await self.db.settings.update_one(
            {"type": "admin_notification_counters"},
            {"$set": {"last_weekly_summary_week": week_key}},
            upsert=True
        )

        cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        requested_count = await self.db.rides.count_documents({"created_at": {"$gte": cutoff_iso}})
        completed_rides = await self.db.rides.find(
            {
                "status": {"$in": ["completed", "ride_completed", "settlement", "ride_archived"]},
                "created_at": {"$gte": cutoff_iso}
            },
            {"commission": 1, "fare": 1}
        ).to_list(5000)

        completed_count = len(completed_rides)
        weekly_commission = sum(
            float(r.get("commission")) if r.get("commission") is not None else (float(r.get("fare", 0.0)) * 0.10)
            for r in completed_rides
        )
        new_users_count = await self.db.users.count_documents({
            "created_at": {"$gte": cutoff_iso},
            "is_archived": {"$ne": True}
        })

        await self.notify_admins_fn(
            event_type="weekly_summary",
            title="Weekly Summary",
            body=f"This week: {completed_count} completed rides ({requested_count} requested), {new_users_count} new users, and K{weekly_commission:.2f} in platform commission.",
            url="/admin",
            tag=f"weekly-summary-{week_key}"
        )
