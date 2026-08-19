import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def repair():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL'))
    db = client[os.getenv('DB_NAME', 'mulungushi_rides')]
    rides = await db.rides.find({}).to_list(5000)
    repaired = 0
    for r in rides:
        fare = float(r.get('fare') or 0.0)
        comm = float(r.get('commission') or 0.0)
        if fare > 0 and (comm == 0 or comm < (fare * 0.05)):
            correct_comm = round(fare * 0.10, 2)
            correct_driver_earning = round(fare - correct_comm, 2)
            await db.rides.update_one(
                {'_id': r['_id']},
                {'$set': {
                    'commission': correct_comm,
                    'driver_earning': correct_driver_earning
                }}
            )
            repaired += 1
            print(f"Repaired ride {r.get('id')}: fare=K{fare:.2f} -> comm=K{correct_comm:.2f}, driver=K{correct_driver_earning:.2f}")
    print(f"Total ride records permanently repaired: {repaired}")

if __name__ == '__main__':
    asyncio.run(repair())
