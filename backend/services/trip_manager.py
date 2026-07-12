import logging
from datetime import datetime, timezone
from typing import Dict, Any

from .trip_rebuilder import DriverTripRebuilder

logger = logging.getLogger(__name__)

class DriverTripManager:
    """
    Orchestrates the active trip session for a driver.
    Maintains the route_queue and increments trip_version.
    """
    
    @staticmethod
    async def get_trip(driver_id: str, db) -> Dict[str, Any]:
        """Gets current trip cache or rebuilds it if missing."""
        trip = await db.driver_trips.find_one({"driver_id": driver_id})
        if not trip:
            trip = await DriverTripRebuilder.rebuild(driver_id, db)
        return trip

    @staticmethod
    async def update_trip(driver_id: str, updates: Dict[str, Any], db) -> Dict[str, Any]:
        """
        Applies updates to the trip and atomically increments the version.
        Ensures optimistic synchronization.
        """
        updates["last_updated"] = datetime.now(timezone.utc).isoformat()
        
        result = await db.driver_trips.find_one_and_update(
            {"driver_id": driver_id},
            {
                "$set": updates,
                "$inc": {"trip_version": 1}
            },
            return_document=True
        )
        return result

    @staticmethod
    async def handle_ride_accepted(driver_id: str, ride_id: str, db):
        """Called when a driver accepts a new ride."""
        # This will be wired to the event bus
        logger.info(f"DriverTripManager processing ride accepted: Driver {driver_id}, Ride {ride_id}")
        
        # We force a rebuild or update the queue via RouteOptimizer here.
        # For Phase 3.2.6.X, simply rebuilding handles the base addition safely.
        await DriverTripRebuilder.rebuild(driver_id, db)
        
    @staticmethod
    async def complete_stop(driver_id: str, stop_id: str, db):
        """Marks a stop as complete and transitions to the next."""
        trip = await DriverTripManager.get_trip(driver_id, db)
        if not trip:
            return
            
        queue = trip.get("route_queue", [])
        for stop in queue:
            if stop["stop_id"] == stop_id:
                stop["status"] = "completed"
                break
                
        # Update DB
        await DriverTripManager.update_trip(driver_id, {"route_queue": queue}, db)
