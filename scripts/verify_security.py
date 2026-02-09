import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
import time

ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR / 'backend'))
load_dotenv(ROOT_DIR / 'backend' / '.env')

API_URL = "http://localhost:8000/api"

# Fix for Windows Unicode output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

async def verify_rate_limiting():
    print("Verifying Rate Limiting...")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Test Login Rate Limit (e.g., 5 per minute)
        print("\n--- Testing Login Rate Limit ---")
        email = "rate_limit_test@example.com"
        password = "password123"
        
        # Ensure user exists (or not, rate limit should trigger anyway)
        # We'll just spam login attempts
        
        start_time = time.time()
        count = 0
        blocked = False
        
        for i in range(20):
            resp = await client.post(f"{API_URL}/auth/login", json={"email": email, "password": password})
            print(f"Attempt {i+1}: {resp.status_code}")
            
            if resp.status_code == 429:
                print("✅ Rate limit triggered (429 Too Many Requests)")
                blocked = True
                break
            count += 1
            
        if not blocked:
            print("❌ Rate limit NOT triggered after 20 attempts")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_rate_limiting())
