import logging
from typing import List, Dict, Any
from datetime import datetime, timezone
from backend.services.route_optimizer import RouteOptimizer

logger = logging.getLogger(__name__)

class DriverTripRebuilder:
    @staticmethod
    async def rebuild(driver_id: str, db) -> Dict[str, Any]:
        """
        Reconstructs the driver's active trip session cache from the rides collection.
        This ensures driver_trips is purely a projection, not the source of truth.
        """
        try:
            # 1. Get Driver Info
            driver_doc = await db.drivers.find_one({"id": driver_id})
            if not driver_doc:
                raise Exception("Driver not found")
            
            capacity = driver_doc.get("vehicle_capacity", 4)
            
            # Extract driver location for optimization
            driver_loc = driver_doc.get("current_location", {})
            driver_lat = driver_loc.get("lat", 0.0)
            driver_lng = driver_loc.get("lng", 0.0)
            
            # 2. Get all active rides for this driver
            # The active rides are what dictates the trip state.
            active_ride_states = [
                "driver_accepted", "driver_en_route_to_pickup", "driver_arrived",
                "passenger_boarding", "ride_started", "ongoing", "ride_in_progress"
            ]
            
            cursor = db.rides.find({"driver_id": driver_id, "status": {"$in": active_ride_states}})
            active_rides = await cursor.to_list(length=None)
            
            # 3. Calculate state and capacity
            occupied = 0
            reserved = 0
            route_queue = []
            active_ride_ids = []
            
            for ride in active_rides:
                active_ride_ids.append(ride["id"])
                
                # Assume 1 seat per ride for now, unless passengers field exists
                passengers = ride.get("passengers", 1)
                
                if ride["status"] in ["ride_started", "ongoing", "ride_in_progress"]:
                    occupied += passengers
                else:
                    reserved += passengers
                    
                # We need to rebuild the Stops.
                # In reality, this requires re-calling RouteOptimizer if we don't have it saved,
                # but for rebuilding, we'll append remaining stops based on ride status.
                
                # If not picked up, they need a pickup stop.
                if ride["status"] not in ["ride_started", "ongoing", "ride_in_progress"]:
                    route_queue.append({
                        "stop_id": f"stop_pickup_{ride['id']}",
                        "ride_id": ride['id'],
                        "student_id": ride['student_id'],
                        "stop_type": "pickup",
                        "sequence": len(route_queue) + 1,
                        "status": "pending",
                        "coordinates": ride.get("pickup", {})
                    })
                
                # Everyone needs a dropoff stop.
                route_queue.append({
                    "stop_id": f"stop_dropoff_{ride['id']}",
                    "ride_id": ride['id'],
                    "student_id": ride['student_id'],
                    "stop_type": "dropoff",
                    "sequence": len(route_queue) + 2, # Will be sorted by optimizer
                    "status": "pending",
                    "coordinates": ride.get("destination", {})
                })

            # 4. Optimize the route queue
            # If we have a valid driver location, pass it to the optimizer
            if driver_lat and driver_lng:
                route_queue = RouteOptimizer.optimize_queue(driver_lat, driver_lng, route_queue)

            state = "available"
            if occupied > 0:
                state = "driving_shared" # or driving_private depending on ride mode
            elif reserved > 0:
                state = "driving_to_pickup"

            trip_doc = {
                "driver_id": driver_id,
                "trip_version": 1, # Reset version on rebuild
                "state": state,
                "active_ride_ids": active_ride_ids,
                "route_queue": route_queue,
                "seat_reservations": [],
                "capacity": {
                    "total": capacity,
                    "occupied": occupied,
                    "reserved": reserved
                },
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
            
            # Update cache in DB
            await db.driver_trips.update_one(
                {"driver_id": driver_id},
                {"$set": trip_doc},
                upsert=True
            )
            
            return trip_doc
            
        except Exception as e:
            logger.error(f"Failed to rebuild trip for driver {driver_id}: {e}")
            return None
