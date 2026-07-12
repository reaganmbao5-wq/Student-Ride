import re
with open('backend/server.py', 'r', encoding='utf-8') as f:
    content = f.read()

complete_old = '''    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_COMPLETED.value)

    # ATOMIC UPDATE
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"": {"status": RideStatus.RIDE_COMPLETED.value, "completed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition or double update.")'''

complete_new = '''    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_COMPLETED.value)

    # 1. COMPLETED STATE
    now = datetime.now(timezone.utc).isoformat()
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"": {"status": RideStatus.RIDE_COMPLETED.value, "completed_at": now}},
        return_document=True
    )
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition or double update.")
         
    # 2. SETTLEMENT STATE
    await db.rides.update_one({"id": ride_id}, {"": {"status": RideStatus.SETTLEMENT.value}})
    '''

content = content.replace(complete_old, complete_new)

# Now find the end of the wallet update to add ARCHIVED state
wallet_old = '''        }
    )
    
    # Log transaction'''

wallet_new = '''        }
    )
    
    # 3. ARCHIVED STATE
    await db.rides.update_one({"id": ride_id}, {"": {"status": RideStatus.RIDE_ARCHIVED.value}})
    ride["status"] = RideStatus.RIDE_ARCHIVED.value
    
    # Log transaction'''

content = content.replace(wallet_old, wallet_new)

with open('backend/server.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("Complete ride updated!")
