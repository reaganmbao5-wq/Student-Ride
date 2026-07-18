import asyncio
import os
import sys
from dotenv import load_dotenv

def run_test():
    load_dotenv('.env')
    os.environ['PYTHONPATH'] = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.environ['PYTHONPATH'])
    
    from fastapi.testclient import TestClient
    from server import app, db
    
    # We need to mock the get_current_user dependency
    from server import get_current_user, require_driver
    
    async def get_id():
        user = await db.users.find_one({'email': 'driver_a@qa.com'})
        return user['id']
        
    user_id = asyncio.run(get_id())
    
    async def mock_require_driver():
        user = await db.users.find_one({'id': user_id})
        return {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role']
        }
        
    app.dependency_overrides[require_driver] = mock_require_driver
    app.dependency_overrides[get_current_user] = mock_require_driver
    
    client = TestClient(app)
    
    r1 = client.get('/api/rides/pending')
    print("PENDING STATUS:", r1.status_code)
    if r1.status_code != 200:
        print("PENDING ERROR:", r1.text)
    else:
        print("PENDING DATA:", len(r1.json()))
        
    r2 = client.get('/api/rides/active')
    print("ACTIVE DRIVER STATUS:", r2.status_code)
    if r2.status_code != 200:
        print("ACTIVE ERROR:", r2.text)
    else:
        print("ACTIVE DATA:", r2.json()['id'] if r2.json() else "None")

run_test()
