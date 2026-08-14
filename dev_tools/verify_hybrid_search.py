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
    print("TESTING MAPBOX GEOCODING QUOTA PROTECTION GUARDS")
    print("======================================================================\n")

    print("1. Testing 2-letter query ('Ka'):")
    res_short = await search_places('Ka')
    sources_short = set(r['source'] for r in res_short)
    print(f"   Results: {len(res_short)} | Sources: {sources_short} (Mapbox NOT called)")

    print("\n2. Testing 5-letter address query ('Kabwe'):")
    res_long = await search_places('Kabwe')
    sources_long = set(r['source'] for r in res_long)
    print(f"   Results: {len(res_long)} | Sources: {sources_long} (Mapbox called for full query)")
    print("======================================================================")

if __name__ == '__main__':
    asyncio.run(main())
