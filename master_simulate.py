import asyncio
import os
import sys
import math
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('backend/.env')
TARGET_API = "https://student-ride-backend-manual.onrender.com/api"
MONGO_URL = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0'

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

async def drive_route(client, driver_user_id, start_coords, end_coords, db, target_ride_id, current_active_ride_count):
    start_lat, start_lng = start_coords["lat"], start_coords["lng"]
    end_lat, end_lng = end_coords["lat"], end_coords["lng"]
    
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}?overview=full&geometries=geojson"
    try:
        route_resp = await client.get(osrm_url)
        route_coords = route_resp.json()["routes"][0]["geometry"]["coordinates"]
    except Exception as e:
        print("Failed to get OSRM route, falling back to straight line.")
        route_coords = [[start_lng, start_lat], [end_lng, end_lat]]

    for i in range(len(route_coords) - 1):
        # Fetch current rides to check if user accepted a new ride OR cancelled one
        current_rides = await db.rides.find({
            "driver_id": driver_user_id.split('_')[0] if "_" not in driver_user_id else driver_user_id, # Safely querying
        }).to_list(None)
        
        # Count rides that are active (not completed/ended/cancelled)
        active_count = len([r for r in current_rides if r['status'] not in ["completed", "ended", "cancelled", "declined"]])
        
        # If the number of rides changed, the user accepted a new student! Recalculate!
        if active_count != current_active_ride_count:
            print(f"🔄 Detected a change in passengers! Recalculating GPS Route...")
            return {"lat": route_coords[i][1], "lng": route_coords[i][0]} # Return current stopped location

        curr_lng, curr_lat = route_coords[i]
        next_lng, next_lat = route_coords[i+1]
        heading = calculate_bearing(curr_lat, curr_lng, next_lat, next_lng)
        
        payload = {
            driver_user_id: {
                "lat": curr_lat,
                "lng": curr_lng,
                "heading": heading
            }
        }
        
        await client.post(f"{TARGET_API}/test/inject_drivers", json={"drivers": payload})
        print(f"   🚗 Driving... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
        await asyncio.sleep(1.5)
        
    return {"lat": end_lat, "lng": end_lng}

async def master_simulate():
    print("========================================")
    print("   PHYSICAL DRIVING SIMULATOR")
    print("========================================")
    
    driver_id = "qa_driver_a"
    if "--driver" in sys.argv:
        driver_idx = sys.argv.index("--driver")
        driver_id = sys.argv[driver_idx + 1]

    client_db = AsyncIOMotorClient(MONGO_URL)
    db = client_db['mulungushi_rides']

    print(f"\n[1/2] Fetching Target Driver ({driver_id})...")
    driver = await db.drivers.find_one({"user_id": driver_id}) or await db.drivers.find_one({"id": driver_id})
    if not driver:
        # Check by email or name
        u = await db.users.find_one({"email": driver_id, "role": "driver"}) or await db.users.find_one({"name": driver_id, "role": "driver"})
        if u: driver = await db.drivers.find_one({"user_id": u["id"]})

    if not driver:
        print(f"❌ Driver {driver_id} not found in database!")
        return
        
    print(f"✅ Found Driver!")
    
    print("\n[2/2] Starting Physical Driving Loop...")
    print("👉 GO TO YOUR APP, REQUEST RIDES, ACCEPT THEM, TOGGLE 'SIMULATION MODE', AND WATCH!")
    
    current_driver_location = driver.get("current_location", {"lat": -14.400, "lng": 28.280})
    
    async with httpx.AsyncClient(timeout=60.0) as http_client:
        while True:
            # Fetch active rides for this driver
            rides = await db.rides.find({
                "driver_id": driver["id"], 
                "status": {"$nin": ["completed", "ended", "cancelled", "declined"]}
            }).to_list(None)
            
            if not rides:
                print("⏳ Waiting for you to accept rides...")
                await asyncio.sleep(3)
                continue
                
            # If any ride is arrived/boarding, the driver is stopped, waiting for user click
            waiting_on_user = any(r['status'] in ['driver_arrived', 'passenger_boarding'] for r in rides)
            if waiting_on_user:
                print("🛑 Arrived! Waiting for you to click 'Start Ride' in the app...")
                await asyncio.sleep(3)
                continue

            # Identify valid destinations
            targets = []
            
            # 1. Pickups (for rides accepted but not picked up yet)
            pickups = [r for r in rides if r['status'] in ['accepted', 'driver_accepted']]
            for p in pickups:
                dist = haversine(current_driver_location['lat'], current_driver_location['lng'], p['pickup_location']['lat'], p['pickup_location']['lng'])
                targets.append({"type": "pickup", "ride": p, "loc": p['pickup_location'], "dist": dist})
                
            # 2. Dropoffs (for rides currently inside vehicle)
            dropoffs = [r for r in rides if r['status'] in ['ongoing', 'ride_started', 'ride_in_progress']]
            for d in dropoffs:
                dist = haversine(current_driver_location['lat'], current_driver_location['lng'], d['dropoff_location']['lat'], d['dropoff_location']['lng'])
                targets.append({"type": "dropoff", "ride": d, "loc": d['dropoff_location'], "dist": dist})
                
            if not targets:
                await asyncio.sleep(2)
                continue
                
            # Pick the closest target (basic Greedy TSP algorithm)
            targets.sort(key=lambda x: x['dist'])
            best_target = targets[0]
            
            t_type = best_target['type']
            t_addr = best_target['loc'].get('address', 'Unknown')
            t_ride = best_target['ride']
            
            # For logging purposes
            student_name = t_ride.get('student', {}).get('name', 'Student')
            if student_name == 'Student':
                 student_doc = await db.users.find_one({"id": t_ride['student_id']})
                 if student_doc:
                     student_name = student_doc.get('name', 'Student')

            if t_type == "pickup":
                print(f"\n🚙 Routing to PICKUP: {student_name} at {t_addr}")
            else:
                print(f"\n🚙 Routing to DROPOFF: {student_name} at {t_addr}")
                
            # Actually drive the route
            # Pass the current active ride count to detect changes while driving
            active_ride_count = len(rides)
            new_location = await drive_route(http_client, driver["user_id"], current_driver_location, best_target['loc'], db, t_ride['id'], active_ride_count)
            
            # Update driver location to wherever they stopped
            current_driver_location = new_location
            
            # Did we reach the destination, or did we recalculate because of a new passenger?
            if haversine(new_location['lat'], new_location['lng'], best_target['loc']['lat'], best_target['loc']['lng']) < 0.001:
                # We actually arrived!
                if t_type == "pickup":
                    print(f"\n🛑 ARRIVED AT PICKUP! Please click 'I've Arrived' and 'Start Ride' in the app.")
                else:
                    print(f"\n✅ ARRIVED AT DROPOFF! Please click 'Complete Ride' in the app.")
            
            # Small buffer
            await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(master_simulate())
