import logging
import math
from typing import List, Dict, Any
from datetime import datetime, timezone
try:
    from backend.services.route_optimizer import RouteOptimizer
except ImportError:
    from services.route_optimizer import RouteOptimizer
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

            # Fetch previous trip doc for last-valid route preservation
            prev_trip = await db.driver_trips.find_one({"driver_id": driver_id})
            prev_briefings = prev_trip.get("passenger_briefings", {}) if prev_trip else {}
            prev_driver_segments = prev_trip.get("full_driver_segments", []) if prev_trip else []

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
                
                # HARDENING RULE: Only accept detailed road geometries (len > 2).
                # Never accept 2-point straight lines if detailed cached geometry is available.
                # If OSRM fails and cache fails, fallback to straight line to guarantee segment array integrity.
                if not leg_geo or len(leg_geo) <= 2:
                    if i < len(prev_driver_segments) and prev_driver_segments[i].get("geometry") and len(prev_driver_segments[i]["geometry"]) > 2:
                        leg_geo = prev_driver_segments[i]["geometry"]
                    else:
                        leg_geo = None
                
                if leg_geo and len(leg_geo) > 2:
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
                    dropoff_idx = -1
                    for idx, stop in enumerate(route_queue):
                        if stop.get("stop_id") == target_stop_id:
                            target_idx = idx
                        if stop.get("stop_id") == f"stop_dropoff_{r_id}":
                            dropoff_idx = idx

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

                        # ==================================================
                        # PHASE X.3: STOP SYNCHRONIZATION ENGINE
                        # Pure calculation engine. Computes exact states.
                        # ==================================================
                        x3_state = "UNKNOWN"
                        stop_0 = route_queue[0] if route_queue else None
                        stop_0_coords = stop_0.get("coordinates", {}) if stop_0 else {}
                        dist_stop0_km = 999.0
                        if driver_lat and driver_lng and stop_0_coords.get("lat") and stop_0_coords.get("lng"):
                            lat1, lon1 = math.radians(driver_lat), math.radians(driver_lng)
                            lat2, lon2 = math.radians(stop_0_coords["lat"]), math.radians(stop_0_coords["lng"])
                            dlat = lat2 - lat1
                            dlon = lon2 - lon1
                            a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
                            dist_stop0_km = 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

                        is_stop0_arrived = (r_status == "driver_arrived") or (dist_stop0_km <= 0.05)

                        if is_arrived:
                            x3_state = "DRIVER_ARRIVED_MY_DROPOFF" if is_onboard else "DRIVER_ARRIVED_MY_PICKUP"
                        elif is_next_stop:
                            x3_state = "HEADING_TO_MY_DROPOFF" if is_onboard else "HEADING_TO_MY_PICKUP"
                        else:
                            # Driver is heading to or arrived at an intermediate stop prior to passenger's stop
                            stop_0_type = stop_0.get("stop_type", "pickup") if stop_0 else "pickup"
                            if stop_0_type == "pickup":
                                x3_state = "DRIVER_ARRIVED_OTHER_PICKUP" if is_stop0_arrived else "DRIVER_EN_ROUTE_OTHER_PICKUP"
                            else:
                                x3_state = "DRIVER_ARRIVED_OTHER_DROPOFF" if is_stop0_arrived else "DRIVER_EN_ROUTE_OTHER_DROPOFF"

                        # ==================================================
                        # PHASE X.2: PASSENGER BRIEFING ENGINE (FROZEN DICTIONARY & PINNED STATES)
                        # Pure display engine. Maps X.3 state to frozen display strings & 6s rotation items.
                        # ZERO generic fallbacks allowed.
                        # ==================================================
                        X2_STATE_TEXTS = {
                            "DRIVER_ARRIVED_MY_DROPOFF": "Driver has arrived at your destination!",
                            "DRIVER_ARRIVED_MY_PICKUP": "Driver has arrived at your pickup!",
                            "HEADING_TO_MY_DROPOFF": "Heading to your destination.",
                            "HEADING_TO_MY_PICKUP": "Driver is approaching your pickup point.",
                            "DRIVER_EN_ROUTE_OTHER_PICKUP": "Driver is approaching another pickup.",
                            "DRIVER_ARRIVED_OTHER_PICKUP": "Driver is picking up another student.",
                            "DRIVER_EN_ROUTE_OTHER_DROPOFF": "Driver is on the way to another student's destination.",
                            "DRIVER_ARRIVED_OTHER_DROPOFF": "Driver is dropping off another student.",
                        }

                        briefing_text = X2_STATE_TEXTS.get(x3_state, "Driver accepted your ride.")
                        is_pinned = x3_state in ["DRIVER_ARRIVED_MY_PICKUP", "DRIVER_ARRIVED_MY_DROPOFF"]

                        # Build rotation carousel messages for X.2 (6-second intervals)
                        stop_label_type = "destination" if is_onboard else "pickup"
                        
                        carousel_messages = []
                        if is_pinned:
                            carousel_messages = [briefing_text]
                        elif stops_remaining == 0:
                            # Frozen Dictionary Rule: Never display "0 stops remaining". Display "You are the next stop."
                            carousel_messages = ["You are the next stop.", briefing_text, "Shared Ride"] if len(active_rides) > 1 else ["You are the next stop.", briefing_text]
                        else:
                            stops_count_str = f"1 stop remaining before your {stop_label_type}." if stops_remaining == 1 else f"{stops_remaining} stops remaining before your {stop_label_type}."
                            carousel_messages = [stops_count_str, briefing_text, "Shared Ride"] if len(active_rides) > 1 else [stops_count_str, briefing_text]

                        # Extract intermediate stops prior to and including student's final dropoff
                        intermediate_stops = []
                        if dropoff_idx != -1:
                            for i in range(dropoff_idx + 1):
                                st = route_queue[i]
                                st_c = st.get("coordinates", {})
                                if st_c and "lat" in st_c and "lng" in st_c:
                                    is_my_pickup = (st.get("stop_id") == f"stop_pickup_{r_id}")
                                    is_my_dropoff = (st.get("stop_id") == f"stop_dropoff_{r_id}")
                                    label = "My Destination" if is_my_dropoff else ("My Pickup" if is_my_pickup else f"Stop {i+1}")
                                    intermediate_stops.append({
                                        "stop_id": st.get("stop_id"),
                                        "stop_type": st.get("stop_type", "pickup"),
                                        "lat": st_c["lat"],
                                        "lng": st_c["lng"],
                                        "label": label,
                                        "is_my_stop": is_my_pickup or is_my_dropoff,
                                        "color": get_color_for_ride(st.get("ride_id"))
                                    })

                        # CLIP DRIVER ROUTE SEGMENTS AT MY FINAL DESTINATION (dropoff_idx)
                        student_segments = []
                        if dropoff_idx != -1:
                            student_segments = full_driver_segments[:dropoff_idx + 1]

                        # Concatenate geometries of clipped segments for backwards compatibility
                        student_geo = []
                        for seg in student_segments:
                            student_geo.extend(seg["geometry"])
                        
                        # Preserve last valid student route if current en-route update returned no valid geometry
                        prev_student_briefing = prev_briefings.get(s_id, {})
                        if not student_geo or len(student_geo) <= 2:
                            if prev_student_briefing.get("route_geometry") and len(prev_student_briefing["route_geometry"]) > 2:
                                student_geo = prev_student_briefing["route_geometry"]
                                student_segments = prev_student_briefing.get("route_segments", [])

                        if not student_geo:
                            student_geo = ride.get("verified_geometry", [])

                        passenger_briefings[s_id] = {
                            "ride_id": r_id,
                            "student_id": s_id,
                            "x3_state": x3_state,
                            "is_pinned": is_pinned,
                            "briefing_text": briefing_text,
                            "carousel_messages": carousel_messages,
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
                "full_driver_segments": full_driver_segments,
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
