import asyncio
import httpx
import time
import math
import random

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

async def drive_route(client, route_coords, driver_id="ghost-driver-0"):
    for i in range(len(route_coords) - 1):
        curr_lng, curr_lat = route_coords[i]
        next_lng, next_lat = route_coords[i+1]
        
        heading = calculate_bearing(curr_lat, curr_lng, next_lat, next_lng)
        
        payload = {
            driver_id: {
                "lat": curr_lat,
                "lng": curr_lng,
                "heading": heading
            }
        }
        
        # Post location to backend
        await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
        print(f"Driving... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
        
        # Wait 1.5 seconds between points to simulate normal driving speed
        await asyncio.sleep(1.5)

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("Waiting for a ride to be requested...")
        ride = None
        while True:
            resp = await client.get("http://localhost:8000/api/test/get_active_ride_for_simulation")
            data = resp.json()
            if data and data.get("status") == "requested":
                ride = data
                break
            await asyncio.sleep(2)
            
        print("Ride requested! ID:", ride["id"])
        pickup = ride["pickup_location"]
        dropoff = ride["dropoff_location"]
        pickup_lat, pickup_lng = pickup["lat"], pickup["lng"]
        dropoff_lat, dropoff_lng = dropoff["lat"], dropoff["lng"]
        
        # 1. Roam idly around pickup for 5-10 seconds
        print("Simulating idle drivers around pickup...")
        driver_id = "ghost-driver-0"
        idle_lat, idle_lng = pickup_lat + 0.005, pickup_lng + 0.005
        
        for _ in range(5):
            idle_lat += random.uniform(-0.0002, 0.0002)
            idle_lng += random.uniform(-0.0002, 0.0002)
            payload = {
                driver_id: {"lat": idle_lat, "lng": idle_lng, "heading": random.uniform(0, 360)},
                "ghost-driver-1": {"lat": pickup_lat - 0.004, "lng": pickup_lng - 0.004, "heading": 10},
                "ghost-driver-2": {"lat": pickup_lat + 0.006, "lng": pickup_lng - 0.003, "heading": 90}
            }
            await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
            await asyncio.sleep(1.5)
            
        # 2. Accept trip
        print("Accepting ride via backdoor...")
        resp = await client.post("http://localhost:8000/api/test/accept_trip")
        data = resp.json()
        if data.get("status") != "accepted":
            print("Failed to accept ride!")
            return
            
        # 3. Drive to Pickup
        print(f"Fetching OSRM route to pickup: {pickup_lat}, {pickup_lng}")
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{idle_lng},{idle_lat};{pickup_lng},{pickup_lat}?overview=full&geometries=geojson"
        route_resp = await client.get(osrm_url)
        pickup_route = route_resp.json()["routes"][0]["geometry"]["coordinates"]
        
        print("Driving to pickup...")
        await drive_route(client, pickup_route, driver_id)
        
        # 4. Arrive and Start Ride
        print("Driver has arrived! Waiting 3 seconds for passenger...")
        await client.post("http://localhost:8000/api/test/update_trip_status", json={"ride_id": ride["id"], "status": "driver_arrived"})
        await asyncio.sleep(3)
        
        print("Passenger boarded. Starting ride...")
        await client.post("http://localhost:8000/api/test/update_trip_status", json={"ride_id": ride["id"], "status": "ongoing"})
        await asyncio.sleep(1)
        
        # 5. Drive to Destination
        print(f"Fetching OSRM route to destination: {dropoff_lat}, {dropoff_lng}")
        osrm_url_dest = f"http://router.project-osrm.org/route/v1/driving/{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}?overview=full&geometries=geojson"
        route_dest_resp = await client.get(osrm_url_dest)
        dest_route = route_dest_resp.json()["routes"][0]["geometry"]["coordinates"]
        
        print("Driving to destination...")
        await drive_route(client, dest_route, driver_id)
        
        # 6. Complete
        print("Arrived at destination! Completing ride.")
        await client.post("http://localhost:8000/api/test/update_trip_status", json={"ride_id": ride["id"], "status": "completed"})
        
        print("E2E Simulation Finished Successfully!")

if __name__ == "__main__":
    asyncio.run(main())
