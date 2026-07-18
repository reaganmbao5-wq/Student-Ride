import asyncio
import os
import sys
from dotenv import load_dotenv
import requests

async def run_test():
    load_dotenv('.env')
    
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
    
    user_a = await db.users.find_one({'email': 'driver_a@qa.com'})
    
    import jwt
    from datetime import datetime, timedelta
    
    SECRET_KEY = os.environ.get('JWT_SECRET', 'test_secret')
    ALGORITHM = "HS256"
    expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode = {'sub': user_a['id'], "exp": expire}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        r1 = requests.get('http://127.0.0.1:5000/api/rides/pending', headers=headers)
        print('PENDING:', r1.status_code, len(r1.json()) if r1.status_code == 200 else r1.text)
        
        r2 = requests.get('http://127.0.0.1:5000/api/rides/active', headers=headers)
        if r2.status_code == 200:
            print('ACTIVE:', r2.status_code, "ID:", r2.json()['id'] if r2.json() else "None")
        else:
            print('ACTIVE ERROR:', r2.status_code, r2.text)
    except Exception as e:
        print('Connection failed', e)

asyncio.run(run_test())
