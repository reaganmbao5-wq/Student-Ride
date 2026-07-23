import asyncio
import os
import math
import argparse
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def interpolate_points(start_lat, start_lng, end_lat, end_lng, step_meters=150):
    total_dist = haversine(start_lat, start_lng, end_lat, end_lng)
    if total_dist <= step_meters:
        return [[end_lng, end_lat]]
    
    num_steps = int(total_dist // step_meters)
    points = []
    for i in range(1, num_steps + 1):
        fraction = i / num_steps
        lat = start_lat + (end_lat - start_lat) * fraction
        lng = start_lng + (end_lng - start_lng) * fraction
        points.append([lng, lat])
    return points

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

async def get_route(client, start_coords, end_coords):
    start_lat, start_lng = start_coords["lat"], start_coords["lng"]
    end_lat, end_lng = end_coords["lat"], end_coords["lng"]
    
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    raw_coords = None
    try:
        route_resp = await client.get(osrm_url, timeout=5.0)
        if route_resp.status_code == 200:
            data = route_resp.json()
            if data.get("routes"):
                raw_coords = data["routes"][0]["geometry"]["coordinates"]
    except Exception as e:
        print(f"[SIMULATION] OSRM query network exception ({e}). Utilizing fallback points.")
        
    if not raw_coords:
        raw_coords = [[start_lng, start_lat], [end_lng, end_lat]]
        
    # Smooth out route_coords by interpolating between each OSRM point
    smooth_coords = [[start_lng, start_lat]]
    for i in range(len(raw_coords) - 1):
        p1_lng, p1_lat = raw_coords[i]
        p2_lng, p2_lat = raw_coords[i+1]
        smooth_coords.extend(interpolate_points(p1_lat, p1_lng, p2_lat, p2_lng, step_meters=150))
        
    return smooth_coords

async def inject_location(client, backend_url, driver_user_id, lat, lng, heading):
    payload = {
        driver_user_id: {
            "lat": lat,
            "lng": lng,
            "heading": heading
        }
    }
    try:
        await client.post(f"{backend_url}/api/test/inject_drivers", json={"drivers": payload}, timeout=10.0)
    except Exception as ex:
        print(f"[SIMULATION] Inject location network retry: {ex}")

async def wait_for_driver_action(db, driver_id, current_stop_id, prompt):
    print(f"\n=====================================")
    print(f"[ACTION REQUIRED] {prompt}")
    print(f"Waiting for you to click the button on the Driver Dashboard...")
    print(f"=====================================")
    
    while True:
        trip = await db.driver_trips.find_one({"driver_id": driver_id})
        queue = trip.get("route_queue", []) if trip else []
        
        if not queue or queue[0]["stop_id"] != current_stop_id:
            print("[SIMULATION] Detected driver action on the dashboard! Resuming driving...\n")
            break
            
        await asyncio.sleep(1.5)

async def dynamic_driver_loop(db, client, backend_url, driver_id, driver_user_id, scenario):
    driver_profile = await db.drivers.find_one({"id": driver_id})
    current_loc = driver_profile.get("current_location", {"lat": -14.3980, "lng": 28.4410})
    print(f"\n[INFO] Driver simulation started. Initial Location: {current_loc}")
    
    soft_deviations = set()
    hard_deviations = set()
    wrong_turns = set()

    while True:
        trip = await db.driver_trips.find_one({"driver_id": driver_id})
        queue = trip.get("route_queue", []) if trip else []
        
        if not queue:
            print("Queue is empty. Waiting for you to ACCEPT a ride via the Dashboard...")
            await asyncio.sleep(2)
            continue
            
        next_stop = queue[0]
        stop_id = next_stop["stop_id"]
        target_lat = next_stop["coordinates"]["lat"]
        target_lng = next_stop["coordinates"]["lng"]
        
        # Scenario Manipulations
        if scenario == "3" and len(queue) > 1 and stop_id not in hard_deviations: # Hard Deviation
            # Find the NEXT pickup in the queue to force the driver there
            next_pickup = None
            for idx in range(1, len(queue)):
                if queue[idx]["stop_type"] == "pickup":
                    next_pickup = queue[idx]
                    break
            
            if next_pickup:
                target_lat = next_pickup["coordinates"]["lat"]
                target_lng = next_pickup["coordinates"]["lng"]
                print(f"\n[SIMULATION] HARD DEVIATION: Skipping {stop_id} to drive to next pickup {next_pickup['stop_id']}!")
                hard_deviations.add(stop_id)
            
        elif scenario == "2" and stop_id not in soft_deviations: # Soft Deviation
            # Instead of changing the final target, we'll just apply an offset to the start location
            # to make the driver appear parallel to the route, triggering a soft recalculation.
            current_loc["lat"] += 0.0008
            current_loc["lng"] += 0.0008
            print("\n[SIMULATION] SOFT DEVIATION: Starting from an offset position to trigger polyline shift!")
            soft_deviations.add(stop_id)
            
        elif scenario == "9": # Custom Simulation
            offset = float(input("Enter custom offset for deviation (e.g., 0.0001): "))
            target_lat += offset
            target_lng += offset

        # Get route to target
        route_coords = await get_route(client, current_loc, {"lat": target_lat, "lng": target_lng})
        
        reached_target = False
        
        for i in range(1, len(route_coords)):
            curr_lng, curr_lat = route_coords[i]
            heading = calculate_bearing(current_loc["lat"], current_loc["lng"], curr_lat, curr_lng)
            
            await inject_location(client, backend_url, driver_user_id, curr_lat, curr_lng, heading)
            current_loc = {"lat": curr_lat, "lng": curr_lng}
            
            # Print status
            stop_label = next_stop["stop_type"].upper()
            print(f"Driving to {stop_label}... {curr_lat:.5f}, {curr_lng:.5f} (Queue Length: {len(queue)})")
            
            # Check distance to target
            dist = haversine(curr_lat, curr_lng, target_lat, target_lng)
            if dist < 30: # Arrived within 30 meters
                reached_target = True
                break
                
            # Wrong Turn Scenario
            if scenario == "4" and i == len(route_coords) // 2 and stop_id not in wrong_turns:
                wrong_turns.add(stop_id)
                print("\n[SIMULATION] WRONG TURN: Diverging from normal route for 5 steps!")
                for _ in range(5):
                    curr_lat += 0.0005
                    curr_lng -= 0.0002
                    await inject_location(client, backend_url, driver_user_id, curr_lat, curr_lng, heading)
                    print(f"Off-route... {curr_lat:.5f}, {curr_lng:.5f}")
                    await asyncio.sleep(0.1)
                print("[SIMULATION] Returning to route recalculation...")
                break # Break out to recalculate route from new diverged location
                
            # Dynamic Queue Checking (Mid-route Cancellations, Shared Rides, Reordering)
            trip_check = await db.driver_trips.find_one({"driver_id": driver_id})
            new_queue = trip_check.get("route_queue", []) if trip_check else []
            if not new_queue or new_queue[0]["stop_id"] != next_stop["stop_id"]:
                print("\n[SIMULATION] Queue changed mid-route! (Cancellation or Shared Ride detected). Recalculating...")
                break # Break to re-evaluate the new queue
                
            await asyncio.sleep(0.1)
            
        # If we reached the target, pause and wait for the driver to click the app button
        if reached_target:
            # Re-fetch queue to ensure we prompt for the correct stop (Hard deviations might reorder the queue!)
            trip_check = await db.driver_trips.find_one({"driver_id": driver_id})
            latest_queue = trip_check.get("route_queue", []) if trip_check else []
            
            if not latest_queue:
                print("\nQueue is empty after arriving.")
                break
                
            actual_next_stop = latest_queue[0]
            
            if actual_next_stop["stop_type"] == "pickup":
                prompt = f"Arrived at PICKUP for Ride: {actual_next_stop['ride_id']}.\nPlease click 'I've Arrived' and 'Start Ride' in the Driver Dashboard."
            else:
                prompt = f"Arrived at DROPOFF for Ride: {actual_next_stop['ride_id']}.\nPlease click 'Complete Ride' in the Driver Dashboard."
                
            await wait_for_driver_action(db, driver_id, actual_next_stop["stop_id"], prompt)

async def main():
    print("=================================")
    print("      MASTER ROUTE TESTER")
    print("=================================")
    print("1. Normal Route")
    print("2. Soft Deviation")
    print("3. Hard Deviation")
    print("4. Wrong Turn")
    print("5. Shared Ride / Multiple / Cancellation Testing")
    print("9. Custom Simulation")
    print("10. Exit")
    print("=================================")
    
    scenario = input("Select a scenario to test (1-10): ")
    if scenario == "10":
        return
        
    email = input("Enter driver's email (e.g., driver@test.com): ")

    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_client = AsyncIOMotorClient(mongo_url)
    db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]

    driver_user = await db.users.find_one({"email": email})
    if not driver_user:
        print(f"Driver with email {email} not found!")
        return

    driver_user_id = driver_user["id"]
    driver_profile = await db.drivers.find_one({"user_id": driver_user_id})
    if not driver_profile:
        print("Driver profile not found!")
        return
        
    driver_id = driver_profile["id"]
    backend_url = os.environ.get("BACKEND_URL", "https://student-ride-backend-manual.onrender.com")
    
    print(f"[OK] Loaded Driver: {driver_user['name']}")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        await dynamic_driver_loop(db, client, backend_url, driver_id, driver_user_id, scenario)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nExiting Master Route Tester.")
