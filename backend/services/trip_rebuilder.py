import logging
import math
from typing import List, Dict, Any
from datetime import datetime, timezone
from backend.services.route_optimizer import RouteOptimizer
try:
    from backend.services.osrm_service import get_multi_waypoint_route
except ImportError:
    from services.osrm_service import get_multi_waypoint_route

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
            onboard_student_ids = set()
            
            for ride in active_rides:
                active_ride_ids.append(ride["id"])
                
                # Assume 1 seat per ride for now, unless passengers field exists
                passengers = ride.get("passengers", 1)
                
                if ride["status"] in ["ride_started", "ongoing", "ride_in_progress"]:
                    occupied += passengers
                    onboard_student_ids.add(ride["student_id"])
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
                        "coordinates": ride.get("pickup_location", {})
                    })
                
                # Everyone needs a dropoff stop.
                route_queue.append({
                    "stop_id": f"stop_dropoff_{ride['id']}",
                    "ride_id": ride['id'],
                    "student_id": ride['student_id'],
                    "stop_type": "dropoff",
                    "sequence": len(route_queue) + 2, # Will be sorted by optimizer
                    "status": "pending",
                    "coordinates": ride.get("dropoff_location", {})
                })

            # 4. Optimize the route queue
            # If we have a valid driver location, pass it to the optimizer
            if driver_lat and driver_lng:
                route_queue = RouteOptimizer.optimize_queue(driver_lat, driver_lng, route_queue, onboard_student_ids)

            state = "available"
            if occupied > 0:
                state = "driving_shared" # or driving_private depending on ride mode
            elif reserved > 0:
                state = "driving_to_pickup"

            # PASSENGER_COLORS palette matching Driver Dashboard exactly
            PASSENGER_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444']
            
            # Map each ride_id to a specific color index from active_rides
            active_ride_ids_list = [r["id"] for r in active_rides]
            def get_color_for_ride(r_id):
                if not r_id: return '#3b82f6'
                try:
                    idx = active_ride_ids_list.index(r_id)
                    return PASSENGER_COLORS[idx % len(PASSENGER_COLORS)]
                except ValueError:
                    return '#3b82f6'

            # Build full Driver Route Segments first (Driver is single source of truth)
            driver_waypoints = []
            if driver_lat and driver_lng:
                driver_waypoints.append({"lat": driver_lat, "lng": driver_lng, "ride_id": "driver"})
            for st in route_queue:
                st_c = st.get("coordinates", {})
                if st_c and "lat" in st_c and "lng" in st_c:
                    driver_waypoints.append({"lat": st_c["lat"], "lng": st_c["lng"], "ride_id": st.get("ride_id"), "stop_id": st.get("stop_id")})

            full_driver_segments = []
            for i in range(len(driver_waypoints) - 1):
                orig = driver_waypoints[i]
                dest = driver_waypoints[i+1]
                leg_color = get_color_for_ride(dest.get("ride_id"))
                leg_geo = []
                try:
                    leg_geo = await get_multi_waypoint_route([orig, dest])
                except Exception as ex:
                    logger.error(f"Leg route error {orig}->{dest}: {ex}")
                if leg_geo:
                    full_driver_segments.append({
                        "rideId": f"seg-{i}",
                        "geometry": leg_geo,
                        "color": leg_color,
                        "status": "active"
                    })

            # 5. Build Passenger-Specific Briefings and Route Projections (Phase X.1 Passive Consumer Architecture)
            passenger_briefings = {}
            try:
                for ride in active_rides:
                    s_id = ride["student_id"]
                    r_id = ride["id"]
                    r_status = ride.get("status", "")

                    # Determine student target stop
                    is_onboard = r_status in ["ride_started", "ongoing", "ride_in_progress"]
                    target_stop_id = f"stop_dropoff_{r_id}" if is_onboard else f"stop_pickup_{r_id}"
                    
                    # Find index of target stop in optimized route_queue
                    target_idx = -1
                    for idx, stop in enumerate(route_queue):
                        if stop.get("stop_id") == target_stop_id:
                            target_idx = idx
                            break

                    if target_idx != -1:
                        stops_remaining = target_idx
                        is_next_stop = (target_idx == 0)

                        # Check distance from driver to target stop for arrival detection
                        target_stop = route_queue[target_idx]
                        target_coords = target_stop.get("coordinates", {})
                        dist_km = 999.0
                        if driver_lat and driver_lng and target_coords.get("lat") and target_coords.get("lng"):
                            lat1, lon1 = math.radians(driver_lat), math.radians(driver_lng)
                            lat2, lon2 = math.radians(target_coords["lat"]), math.radians(target_coords["lng"])
                            dlat = lat2 - lat1
                            dlon = lon2 - lon1
                            a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
                            dist_km = 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

                        is_arrived = (r_status == "driver_arrived") or (is_next_stop and dist_km <= 0.05)

                        # Priority Engine Briefing Generation (Commit 5ecff37 preserved)
                        if is_arrived:
                            if is_onboard:
                                briefing_text = "Driver has arrived at your destination!"
                            else:
                                briefing_text = "Driver has arrived at your pickup!"
                        elif is_next_stop:
                            if is_onboard:
                                briefing_text = "Heading to your destination"
                            else:
                                briefing_text = "Driver is approaching your pickup point"
                        else:
                            if stops_remaining == 1:
                                if is_onboard:
                                    briefing_text = "1 stop remaining before your destination"
                                else:
                                    briefing_text = "1 stop remaining before your pickup"
                            else:
                                if is_onboard:
                                    briefing_text = f"{stops_remaining} stops remaining before your destination"
                                else:
                                    briefing_text = f"{stops_remaining} stops remaining before your pickup"

                        # Extract intermediate stops prior to and including student's target stop for Privacy Shield visualization
                        intermediate_stops = []
                        for i in range(target_idx + 1):
                            st = route_queue[i]
                            st_c = st.get("coordinates", {})
                            if st_c and "lat" in st_c and "lng" in st_c:
                                is_my_stop = (i == target_idx)
                                label = "My Destination" if (is_my_stop and is_onboard) else ("My Pickup" if is_my_stop else f"Stop {i+1}")
                                intermediate_stops.append({
                                    "stop_id": st.get("stop_id"),
                                    "stop_type": st.get("stop_type", "pickup"),
                                    "lat": st_c["lat"],
                                    "lng": st_c["lng"],
                                    "label": label,
                                    "is_my_stop": is_my_stop,
                                    "color": get_color_for_ride(st.get("ride_id"))
                                })

                        # CLIP DRIVER ROUTE SEGMENTS AT MY STOP (target_idx)
                        student_segments = full_driver_segments[:target_idx + 1]

                        # Concatenate geometries of clipped segments for backwards compatibility
                        student_geo = []
                        for seg in student_segments:
                            student_geo.extend(seg["geometry"])
                        
                        if not student_geo:
                            student_geo = ride.get("verified_geometry", [])

                        passenger_briefings[s_id] = {
                            "ride_id": r_id,
                            "student_id": s_id,
                            "briefing_text": briefing_text,
                            "stops_remaining": stops_remaining,
                            "is_next_stop": is_next_stop,
                            "intermediate_stops": intermediate_stops,
                            "route_segments": student_segments,
                            "route_geometry": student_geo
                        }
            except Exception as pb_err:
                logger.error(f"Error constructing passenger briefings in trip_rebuilder: {pb_err}")

            trip_doc = {
                "driver_id": driver_id,
                "trip_version": 1, # Reset version on rebuild
                "state": state,
                "active_ride_ids": active_ride_ids,
                "route_queue": route_queue,
                "passenger_briefings": passenger_briefings,
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
