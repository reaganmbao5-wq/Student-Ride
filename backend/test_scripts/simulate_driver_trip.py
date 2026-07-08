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
        # 1. Accept the ride
        print("Accepting ride via backdoor...")
        resp = await client.post("http://localhost:8000/api/test/accept_trip")
        data = resp.json()
        
        if data.get("status") != "accepted":
            print("No requested ride found!", data)
            return
            
        ride = data["ride"]
        pickup = ride["pickup_location"]
        pickup_lat, pickup_lng = pickup["lat"], pickup["lng"]
        print(f"Ride accepted! Pickup at {pickup_lat}, {pickup_lng}")
        
        # 2. Get route from 1km away to Pickup (Dynamic based on pickup)
        start_lat, start_lng = pickup_lat + 0.008, pickup_lng + 0.008
        print(f"Fetching OSRM route from {start_lat}, {start_lng} to {pickup_lat}, {pickup_lng}")
        
        osrm_url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{pickup_lng},{pickup_lat}?overview=full&geometries=geojson"
        route_resp = await client.get(osrm_url)
        route_data = route_resp.json()
        
        if route_data.get("code") != "Ok":
            print("OSRM Error:", route_data)
            return
            
        coordinates = route_data["routes"][0]["geometry"]["coordinates"]
        print(f"Got route with {len(coordinates)} coordinates.")
        
        # 3. Simulate driving
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
            
            # Post location to backend
            await client.post("http://localhost:8000/api/test/inject_drivers", json={"drivers": payload})
            print(f"Driving... {curr_lat:.5f}, {curr_lng:.5f} (Heading: {heading:.1f})")
            
            # Wait 1.5 seconds between points to simulate normal driving speed
            await asyncio.sleep(1.5)
            
        print("Driver has arrived at the pickup location!")
        
if __name__ == "__main__":
    asyncio.run(main())
