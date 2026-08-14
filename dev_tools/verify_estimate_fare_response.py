import sys
import os
import asyncio

# Ensure backend import path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from server import estimate_fare

async def main():
    print("======================================================================")
    print("TESTING ESTIMATE FARE PAYLOAD WITH MAPBOX INTELLIGENT TRAFFIC ETA")
    print("======================================================================\n")

    dummy_user = {"id": "test_user_1", "email": "test@test.com", "role": "student"}
    payload = {
        "pickup": {"lat": -14.294646, "lng": 28.549662},
        "dropoff": {"lat": -14.441372, "lng": 28.449307}
    }

    res = await estimate_fare(payload, user=dummy_user)
    print("Estimate Fare Response Payload:")
    print(f"   verified_distance: {res.get('verified_distance')} km")
    print(f"   verified_duration: {res.get('verified_duration')} min")
    print(f"   duration_min: {res.get('duration_min')} min")
    print(f"   duration: {res.get('duration')} min")
    print(f"   eta_text: {res.get('eta_text')}")
    print(f"   eta_seconds: {res.get('eta_seconds')} s")
    print(f"   Private Fare: K{res['private']['estimated_fare']:.2f}")
    print(f"   Shared Fare: K{res['shared']['estimated_fare']:.2f}")
    print("======================================================================")

if __name__ == '__main__':
    asyncio.run(main())
