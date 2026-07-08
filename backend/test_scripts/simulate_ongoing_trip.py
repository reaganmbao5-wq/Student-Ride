import asyncio
import httpx
import time
import math

def calculate_bearing(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing = math.atan2(y, x)
    return (math.degrees(bearing) + 360) % 360

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Get the active ride
        resp = await client.get("http://localhost:8000/api/test/get_active_ride_for_simulation")
        if resp.status_code != 200:
            print("Failed to get ride", resp.text)
            return
            
        ride = resp.json()
        if not ride:
            print("No active ride found to simulate.")
            return
            
        print(f"Simulating ongoing trip for ride: {ride['id']}")
        
        # Hit arrived endpoint first if not ongoing
        if ride["status"] != "ongoing":
            print("Marking driver as arrived, then starting trip...")
            await client.post(f"http://localhost:8000/api/rides/{ride['id']}/status", json={"status": "driver_arrived", "driver_id": ride["driver_id"]})
            await asyncio.sleep(2)
            await client.post(f"http://localhost:8000/api/rides/{ride['id']}/status", json={"status": "ongoing", "driver_id": ride["driver_id"]})
        
        pickup = ride["pickup_location"]
        dropoff = ride["dropoff_location"]
        
        pickup_lat, pickup_lng = pickup["lat"], pickup["lng"]
        dropoff_lat, dropoff_lng = dropoff["lat"], dropoff["lng"]
        
        print(f"Fetching route from pickup {pickup_lat}, {pickup_lng} to dropoff {dropoff_lat}, {dropoff_lng}")
        
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{pickup_lng},{pickup_lat};{dropoff_lng},{dropoff_lat}?overview=full&geometries=geojson"
        route_resp = await client.get(osrm_url)
        route_data = route_resp.json()
        
        if route_data.get("code") != "Ok":
            print("OSRM Error:", route_data)
            return
            
        coordinates = route_data["routes"][0]["geometry"]["coordinates"]
        
        driver_id = "ghost-driver-0"
        
        for i in range(len(coordinates) - 1):
            curr_lng, curr_lat = coordinates[i]
            next_lng, next_lat = coordinates[i+1]
            
            heading = calculate_bearing(curr_lat, curr_lng, next_lat, next_lng)
            
            payload = {
                driver_id: {
                    "lat": curr_lat,
                    "lng": curr_lng,
                    "heading": heading
                }
            }
            
            await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
            print(f"Driving to destination... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
            
            await asyncio.sleep(1.5)
            
        print("Driver has reached the destination!")
        await client.post(f"http://localhost:8000/api/rides/{ride['id']}/status", json={"status": "completed", "driver_id": ride["driver_id"]})
        print("Trip completed.")
        
if __name__ == "__main__":
    asyncio.run(main())
