import sys
import os
import asyncio

# Ensure backend import path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from server import search_places

async def main():
    print("======================================================================")
    print("TESTING HYBRID SEARCH BAR (LOCAL PLACES.DB + MAPBOX GEOCODING API)")
    print("======================================================================\n")

    queries = ["Main Gate", "Kabwe", "Hungry Lion"]
    for q in queries:
        print(f"Searching query: '{q}'...")
        results = await search_places(q=q)
        print(f"Total Results: {len(results)}")
        for i, item in enumerate(results[:5], 1):
            source_tag = item.get("source", "db").upper()
            print(f"  [{i}] [{source_tag}] {item['display_name']} ({item['lat']}, {item['lon']})")
        print("-" * 70)

if __name__ == '__main__':
    asyncio.run(main())
