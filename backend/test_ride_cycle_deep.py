import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

from services.trip_rebuilder import DriverTripRebuilder
from services.route_optimizer import RouteOptimizer
from services.osrm_service import get_multi_waypoint_route, get_route, calculate_eta

async def run_deep_verification():
    print("=" * 70)
    print("STARTING DEEP RIDE CYCLE ARCHITECTURE VERIFICATION")
    print("=" * 70)
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'mulungushi_rides')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[db_name]
    
    test_run_id = str(uuid.uuid4())[:8]
    print(f"Connected to MongoDB: {db_name} (Run ID: {test_run_id})")

    # =========================================================================
    # SCENARIO 1: PRIVATE RIDE ROUTE SEGMENTS & ACTIVE LEG ISOLATION
    # =========================================================================
    print("\n--- [SCENARIO 1]: PRIVATE RIDE ROUTE INTEGRITY & ACTIVE LEG ISOLATION ---")
    
    driver_id = f"test-driver-{test_run_id}"
    student_id = f"test-student-{test_run_id}"
    ride_id = f"test-ride-{test_run_id}"
    
    # Campus coordinates
    driver_loc = {"lat": -14.4050, "lng": 28.2800} # Near Graduation Square
    pickup_loc = {"lat": -14.4087, "lng": 28.2849, "address": "Mulungushi Main Campus"}
    dropoff_loc = {"lat": -14.4420, "lng": 28.4500, "address": "Kabwe Town Center"}
    
    # 1. Create test driver profile
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "id": driver_id,
            "user_id": f"user-{driver_id}",
            "is_online": True,
            "is_approved": True,
            "vehicle_type": "car",
            "vehicle_model": "Toyota Vitz",
            "plate_number": "AG4690",
            "vehicle_color": "Blue",
            "vehicle_capacity": 4,
            "current_location": driver_loc,
            "location": {"type": "Point", "coordinates": [driver_loc["lng"], driver_loc["lat"]]}
        }},
        upsert=True
    )
    
    # 2. Create private ride in 'driver_accepted' state
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "id": ride_id,
            "student_id": student_id,
            "driver_id": driver_id,
            "status": "driver_accepted",
            "ride_mode": "private",
            "passenger_count": 1,
            "pickup_location": pickup_loc,
            "dropoff_location": dropoff_loc,
            "fare": 50.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # 3. Rebuild Driver Trip
    trip = await DriverTripRebuilder.rebuild(driver_id, db)
    assert trip is not None, "Trip rebuilding failed!"
    
    full_driver_segments = trip.get("full_driver_segments", [])
    print(f"Driver Route Segments generated: {len(full_driver_segments)} segments")
    assert len(full_driver_segments) == 2, f"Expected 2 segments (Driver->Pickup and Pickup->Dropoff), got {len(full_driver_segments)}"
    
    seg0 = full_driver_segments[0]
    seg1 = full_driver_segments[1]
    
    print(f"   - Segment 0 (Approach Leg): {len(seg0['geometry'])} points | isActiveLeg: {seg0.get('isActiveLeg')}")
    print(f"   - Segment 1 (Destination Leg): {len(seg1['geometry'])} points | isActiveLeg: {seg1.get('isActiveLeg')}")
    
    assert seg0.get("isActiveLeg") == True, "Segment 0 MUST be tagged as active approach leg!"
    assert seg1.get("isActiveLeg") == False, "Segment 1 MUST NOT be active while driver is en-route to pickup!"
    
    # 4. Check Student Briefing & Route Geometry
    briefings = trip.get("passenger_briefings", {})
    assert student_id in briefings, "Student briefing missing from trip!"
    student_briefing = briefings[student_id]
    
    print(f"Passenger Briefing Generated:")
    print(f"   - Briefing Text: \"{student_briefing['briefing_text']}\"")
    print(f"   - Stops Remaining: {student_briefing['stops_remaining']}")
    print(f"   - Route Geometry Total Points: {len(student_briefing['route_geometry'])}")
    print(f"   - Route Segments Count: {len(student_briefing['route_segments'])}")
    
    assert len(student_briefing["route_segments"]) == 2, "Student should receive both segments in approach phase"
    assert student_briefing["route_segments"][0].get("isActiveLeg") == True, "Student Leg 0 must be active"
    assert student_briefing["route_segments"][1].get("isActiveLeg") == False, "Student Leg 1 must be future"
    
    # 5. Transition to 'driver_arrived' & 'ride_started'
    print("\n--- [TRANSITION]: PASSENGER BOARDING & RIDE STARTED ---")
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": "ride_started"}}
    )
    
    trip_started = await DriverTripRebuilder.rebuild(driver_id, db)
    started_segments = trip_started.get("full_driver_segments", [])
    print(f"Started Trip Segments: {len(started_segments)} segment(s)")
    assert len(started_segments) == 1, f"Expected 1 segment after pickup (Pickup->Dropoff), got {len(started_segments)}"
    
    active_seg = started_segments[0]
    print(f"   - Active Leg (Pickup -> Dropoff): {len(active_seg['geometry'])} points | isActiveLeg: {active_seg.get('isActiveLeg')}")
    assert active_seg.get("isActiveLeg") == True, "Active destination leg MUST be tagged isActiveLeg: True after ride start!"
    
    started_briefing = trip_started["passenger_briefings"][student_id]
    print(f"   - Briefing Text: \"{started_briefing['briefing_text']}\"")
    assert started_briefing["stops_remaining"] == 0, "Destination is the next immediate stop!"

    # Complete Scenario 1 Ride
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": "completed"}})

    # =========================================================================
    # SCENARIO 2: SHARED RIDE WITH 2 PASSENGERS (MULTI-STOP SEQUENCING)
    # =========================================================================
    print("\n--- [SCENARIO 2]: SHARED RIDE MULTI-PASSENGER ROUTING ---")
    
    student_a_id = f"student-A-{test_run_id}"
    student_b_id = f"student-B-{test_run_id}"
    ride_a_id = f"ride-A-{test_run_id}"
    ride_b_id = f"ride-B-{test_run_id}"
    
    pickup_a = {"lat": -14.4087, "lng": 28.2849, "address": "Campus Hostels"}
    dropoff_a = {"lat": -14.4300, "lng": 28.3500, "address": "Off-Campus Boarding 1"}
    
    pickup_b = {"lat": -14.4100, "lng": 28.2900, "address": "Campus Library"}
    dropoff_b = {"lat": -14.4400, "lng": 28.4000, "address": "Off-Campus Boarding 2"}
    
    # Create 2 concurrent shared rides assigned to same driver
    await db.rides.update_one(
        {"id": ride_a_id},
        {"$set": {
            "id": ride_a_id, "student_id": student_a_id, "driver_id": driver_id,
            "status": "driver_accepted", "ride_mode": "shared", "passenger_count": 1,
            "pickup_location": pickup_a, "dropoff_location": dropoff_a, "fare": 20.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    await db.rides.update_one(
        {"id": ride_b_id},
        {"$set": {
            "id": ride_b_id, "student_id": student_b_id, "driver_id": driver_id,
            "status": "driver_accepted", "ride_mode": "shared", "passenger_count": 1,
            "pickup_location": pickup_b, "dropoff_location": dropoff_b, "fare": 25.0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    shared_trip = await DriverTripRebuilder.rebuild(driver_id, db)
    shared_queue = shared_trip.get("route_queue", [])
    print(f"Optimized Route Queue Stops: {len(shared_queue)} stops")
    for idx, stop in enumerate(shared_queue):
        print(f"   [{idx+1}] {stop['stop_type'].upper()} for {stop['ride_id']} (Seq: {stop['sequence']})")
        
    assert len(shared_queue) == 4, f"Expected 4 stops in route queue (Pickup A, Pickup B, Dropoff A, Dropoff B), got {len(shared_queue)}"
    
    shared_briefings = shared_trip.get("passenger_briefings", {})
    assert student_a_id in shared_briefings, "Student A briefing missing"
    assert student_b_id in shared_briefings, "Student B briefing missing"
    
    briefing_a = shared_briefings[student_a_id]
    briefing_b = shared_briefings[student_b_id]
    
    print(f"Passenger A Briefing: \"{briefing_a['briefing_text']}\" (Stops Left: {briefing_a['stops_remaining']})")
    print(f"Passenger B Briefing: \"{briefing_b['briefing_text']}\" (Stops Left: {briefing_b['stops_remaining']})")
    
    # Clean up test records
    await db.rides.delete_many({"id": {"$in": [ride_id, ride_a_id, ride_b_id]}})
    await db.drivers.delete_one({"id": driver_id})
    await db.driver_trips.delete_one({"driver_id": driver_id})
    
    print("\n" + "=" * 70)
    print("ALL DEEP RIDE CYCLE ASSERTIONS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_deep_verification())
