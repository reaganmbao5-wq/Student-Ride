import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Patch accept_ride
    accept_old1 = """    # Check if ride exists and get its mode
    target_ride = await db.rides.find_one({"id": ride_id, "status": RideStatus.REQUESTED.value})
    if not target_ride:
        # Give detailed reason if it's not found or taken
        existing = await db.rides.find_one({"id": ride_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Ride not found")
        raise HTTPException(status_code=400, detail="Ride already taken or cancelled")"""
    
    accept_new1 = """    # Check if ride exists and get its mode
    target_ride = await db.rides.find_one({"id": ride_id})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    validate_ride_transition(target_ride.get("status"), RideStatus.DRIVER_ACCEPTED.value)"""
    
    content = content.replace(accept_old1, accept_new1)

    accept_old2 = """    # ATOMIC UPDATE: Only update if status is REQUESTED
    now = datetime.now(timezone.utc).isoformat()
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "status": RideStatus.REQUESTED.value},
        {"$set": {
            "driver_id": driver["id"],
            "status": RideStatus.ACCEPTED.value,
            "accepted_at": now
        }},"""
    
    accept_new2 = """    # ATOMIC UPDATE: State verified above
    now = datetime.now(timezone.utc).isoformat()
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "status": target_ride["status"]},
        {"$set": {
            "driver_id": driver["id"],
            "status": RideStatus.DRIVER_ACCEPTED.value,
            "accepted_at": now
        }},"""
    
    content = content.replace(accept_old2, accept_new2)

    # 2. Patch driver_arrived
    arrived_old = """    # ATOMIC UPDATE: Only update if status is ACCEPTED and assigned to this driver
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.ACCEPTED.value
        },
        {"$set": {"status": RideStatus.DRIVER_ARRIVED.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        raise HTTPException(status_code=400, detail="Invalid transition. Ride must be ACCEPTED and assigned to you.")"""
        
    arrived_new = """    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.DRIVER_ARRIVED.value)

    # ATOMIC UPDATE
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.DRIVER_ARRIVED.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        raise HTTPException(status_code=400, detail="Invalid transition or double update.")"""
        
    content = content.replace(arrived_old, arrived_new)

    # 3. Patch start_ride
    start_old = """    # ATOMIC UPDATE: Only update if status is DRIVER_ARRIVED and assigned to this driver
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.DRIVER_ARRIVED.value
        },
        {"$set": {
            "status": RideStatus.ONGOING.value,
            "started_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition. Ride must be in DRIVER_ARRIVED state.")"""
         
    start_new = """    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_STARTED.value)

    # ATOMIC UPDATE
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {
            "status": RideStatus.RIDE_STARTED.value,
            "started_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition or double update.")"""
         
    content = content.replace(start_old, start_new)

    # 4. Patch complete_ride
    complete_old = """    # ATOMIC UPDATE: Only update if status is ONGOING and assigned to this driver
    # This prevents double completion and double deduction
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.ONGOING.value
        },
        {"$set": {"status": RideStatus.COMPLETED.value, "completed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition. Ride must be ONGOING.")"""
         
    complete_new = """    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_COMPLETED.value)

    # ATOMIC UPDATE
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.RIDE_COMPLETED.value, "completed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition or double update.")"""
         
    content = content.replace(complete_old, complete_new)

    # 5. Insert new endpoints after /rides/{ride_id}/complete
    new_endpoints = """
@api_router.post("/rides/{ride_id}/en_route")
async def driver_en_route(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    await manager.send_personal_message({
        "type": "ride_state_changed",
        "state": RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "en_route_to_pickup"}

@api_router.post("/rides/{ride_id}/boarding")
async def passenger_boarding(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.PASSENGER_BOARDING.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.PASSENGER_BOARDING.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    await manager.send_personal_message({
        "type": "ride_state_changed",
        "state": RideStatus.PASSENGER_BOARDING.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "passenger_boarding"}

@api_router.post("/rides/{ride_id}/in_progress")
async def ride_in_progress(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_IN_PROGRESS.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.RIDE_IN_PROGRESS.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    await manager.send_personal_message({
        "type": "ride_state_changed",
        "state": RideStatus.RIDE_IN_PROGRESS.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "ride_in_progress"}

@api_router.post("/rides/{ride_id}/arriving")
async def arriving_destination(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.ARRIVING_DESTINATION.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.ARRIVING_DESTINATION.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    await manager.send_personal_message({
        "type": "ride_state_changed",
        "state": RideStatus.ARRIVING_DESTINATION.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "arriving_destination"}
"""
    
    # We find where complete_ride ends to insert these new endpoints
    insert_marker = '@api_router.post("/rides/{ride_id}/cancel")'
    content = content.replace(insert_marker, new_endpoints + "\n" + insert_marker)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Patch applied.")

if __name__ == "__main__":
    patch_file('backend/server.py')
