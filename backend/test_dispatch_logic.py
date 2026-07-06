import asyncio
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

# Using the same database connection as server.py
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client.student_ride_db

from server import get_driver_active_state, RideStatus, RideMode

async def run_tests():
    print("Starting Dispatch Logic Tests...")
    
    # Setup Fake Driver
    driver_id = f"test-driver-{uuid.uuid4()}"
    
    # 1. Test Empty State
    state = await get_driver_active_state(driver_id)
    assert state["active_passengers"] == 0, f"Expected 0, got {state['active_passengers']}"
    assert state["has_private"] == False, "Expected False"
    assert state["has_shared"] == False, "Expected False"
    print("[OK] Empty State passed")
    
    # 2. Add 1 Shared Ride (Passenger Count 2)
    ride1_id = f"test-ride-{uuid.uuid4()}"
    await db.rides.insert_one({
        "id": ride1_id,
        "driver_id": driver_id,
        "status": RideStatus.ACCEPTED.value,
        "ride_mode": RideMode.SHARED.value,
        "passenger_count": 2
    })
    
    state = await get_driver_active_state(driver_id)
    assert state["active_passengers"] == 2, f"Expected 2, got {state['active_passengers']}"
    assert state["has_private"] == False, "Expected False"
    assert state["has_shared"] == True, "Expected True"
    print("[OK] 1 Shared Ride passed")
    
    # 3. Add 1 Private Ride (Passenger Count 1)
    ride2_id = f"test-ride-{uuid.uuid4()}"
    await db.rides.insert_one({
        "id": ride2_id,
        "driver_id": driver_id,
        "status": RideStatus.ONGOING.value,
        "ride_mode": RideMode.PRIVATE.value,
        "passenger_count": 1
    })
    
    state = await get_driver_active_state(driver_id)
    assert state["active_passengers"] == 3, f"Expected 3, got {state['active_passengers']}"
    assert state["has_private"] == True, "Expected True"
    assert state["has_shared"] == True, "Expected True"
    print("[OK] Mixed Rides passed")
    
    # Cleanup
    await db.rides.delete_many({"driver_id": driver_id})
    print("[OK] Cleanup completed")
    print("All dispatch logic helper tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(run_tests())
