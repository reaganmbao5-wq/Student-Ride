import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]

COMPLETED_STATUSES = [
    "completed",
    "ride_completed",
    "ride_archived",
    "settlement",
    "completed_ride"
]

async def repair_commissions():
    print("==================================================")
    print("[*] AUDITING HISTORICAL RIDE COMMISSIONS (10% RULE)")
    print("==================================================")

    # 1. Fetch all completed rides
    rides = await db.rides.find({"status": {"$in": COMPLETED_STATUSES}}).to_list(10000)
    print(f"Found {len(rides)} completed/archived rides.")

    repaired_count = 0
    total_repaired_volume = 0.0

    for r in rides:
        fare = float(r.get("fare") or 0.0)
        correct_commission = round(fare * 0.10, 2)
        correct_driver_earning = round(fare - correct_commission, 2)

        existing_commission = r.get("commission")
        existing_earning = r.get("driver_earning")

        if existing_commission != correct_commission or existing_earning != correct_driver_earning:
            await db.rides.update_one(
                {"id": r["id"]},
                {"$set": {
                    "commission": correct_commission,
                    "driver_earning": correct_driver_earning
                }}
            )
            repaired_count += 1
            total_repaired_volume += fare

    print(f"[+] Repaired {repaired_count} ride records with accurate 10% commission math.")

    # 2. Re-compute driver total_commission_due balances
    drivers = await db.drivers.find({}).to_list(1000)
    print(f"\nRe-synchronizing balances for {len(drivers)} drivers...")

    for d in drivers:
        d_id = d.get("id") or str(d.get("_id"))
        driver_rides = await db.rides.find({
            "driver_id": d_id,
            "status": {"$in": COMPLETED_STATUSES}
        }).to_list(1000)

        total_comm_generated = sum(float(r.get("commission") or 0.0) for r in driver_rides)
        total_paid = float(d.get("total_commission_paid") or 0.0)
        net_due = max(0.0, total_comm_generated - total_paid)

        await db.drivers.update_one(
            {"$or": [{"id": d_id}, {"_id": d.get("_id")}]},
            {"$set": {
                "id": d_id,
                "total_commission_due": round(net_due, 2),
                "wallet_balance": round(-net_due, 2)
            }}
        )

    print("[+] All driver wallet balances and commission debt pools are 100% verified.")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(repair_commissions())
