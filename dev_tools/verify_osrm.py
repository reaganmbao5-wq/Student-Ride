import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))

from services.osrm_service import get_route

async def verify_osrm():
    print("Verifying OSRM Integration...")
    
    # Coordinates for Mulungushi University region (approximate endpoints)
    # Great North Road area
    pickup = (-14.4450, 28.4480) 
    drop = (-14.4200, 28.4600)
    
    print(f"Pickup: {pickup}")
    print(f"Drop: {drop}")
    
    result = await get_route(pickup[0], pickup[1], drop[0], drop[1])
    
    print("\n--- Route Result ---")
    print(f"Source: {result['source']}")
    print(f"Distance: {result['distance_km']:.2f} km")
    print(f"Duration: {result['duration_minutes']:.2f} min")
    print(f"Geometry Points: {len(result['geometry'])}")
    
    if result['source'] == 'osrm':
        if result['distance_km'] > 0 and result['duration_minutes'] > 0 and len(result['geometry']) > 0:
            print("\n✅ OSRM Verification PASSED")
        else:
            print("\n❌ OSRM Verification FAILED: Invalid data")
    else:
        print("\n⚠️ OSRM Failed, used Fallback. Check internet connection or OSRM status.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_osrm())
