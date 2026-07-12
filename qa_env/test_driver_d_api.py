import asyncio
import aiohttp

async def test_driver_d_login():
    async with aiohttp.ClientSession() as session:
        # Step 1: Login
        login_resp = await session.post('http://localhost:8000/api/auth/login', json={
            'email': 'driver_d@qa.com',
            'password': 'password123'
        })
        login_data = await login_resp.json()
        print(f'Login status: {login_resp.status}')
        print(f'Login response: {login_data}')
        
        if login_resp.status != 200:
            print('Login FAILED')
            return

        token = login_data.get('access_token')
        print(f'Token obtained: {bool(token)}')

        # Step 2: Get /drivers/me
        me_resp = await session.get(
            'http://localhost:8000/api/drivers/me',
            headers={'Authorization': f'Bearer {token}'}
        )
        me_data = await me_resp.json()
        print(f'/drivers/me status: {me_resp.status}')
        if me_resp.status == 200:
            print(f'/drivers/me is_approved: {me_data.get("is_approved")}')
            print(f'/drivers/me is_online: {me_data.get("is_online")}')
            print(f'/drivers/me vehicle_capacity: {me_data.get("vehicle_capacity")}')
            print('Driver D /drivers/me SUCCESS')
        else:
            print(f'/drivers/me ERROR: {me_data}')

asyncio.run(test_driver_d_login())
