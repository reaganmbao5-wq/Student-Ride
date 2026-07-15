# Production Hardening & Testing Removal Guide

During the development and testing phase, we introduced several tools, buttons, and "hacks" to simulate driver movement and test the system locally and on the physical devices without needing a real moving vehicle. 

**Before deploying this application to real users in production, you MUST remove the following items to secure the application.**

---

## 1. The "Simulation Mode" Toggle
We added a button in the Driver Dashboard that disables the phone's native GPS tracking so that the Python E2E script can inject fake coordinates without conflicting with the real phone GPS.

**Location**: `frontend/src/pages/DriverDashboard.jsx`

**What to remove**:
1. **The Button**: Delete the button block around line 650 that looks like this:
   ```jsx
   {isOnline && (
     <button
       onClick={() => setIsSimulating(!isSimulating)}
       className={`text-xs px-3 py-1.5 rounded-lg border transition-all shadow-sm ${isSimulating ... }`}
     >
       {isSimulating ? 'Simulation Mode: ON' : 'Simulation Mode: OFF'}
     </button>
   )}
   ```
2. **The State Variables**: Remove `const [isSimulating, setIsSimulating] = useState(false);` (around line 36).
3. **The Effect Hook**: Revert the `useEffect` on line 91 back to its normal state.
   *Currently it is*:
   ```jsx
   useEffect(() => {
     if (isOnline && !isWatching && !isSimulating) {
       startWatching();
     } else if ((!isOnline || isSimulating) && isWatching) {
       stopWatching();
     }
   }, [isOnline, isWatching, isSimulating, startWatching, stopWatching]);
   ```
   *Change it back to*:
   ```jsx
   useEffect(() => {
     if (isOnline && !isWatching) {
       startWatching();
     } else if (!isOnline && isWatching) {
       stopWatching();
     }
   }, [isOnline, isWatching, startWatching, stopWatching]);
   ```

---

## 2. Unsecured QA Injection Routes
To allow the Python scripts to control drivers, we added "test" API routes to the backend that bypass authentication and directly manipulate the database. Leaving these in production would allow ANYONE to move drivers around or accept trips on their behalf.

**Location**: `backend/server.py`

**What to remove**:
Search for the `@api_router` definitions that start with `/test/`. Delete the following routes entirely:
1. `@api_router.post("/test/inject_drivers")` (Around line 1550)
2. `@api_router.post("/test/accept_trip")` (Around line 1565)
3. `@api_router.get("/test/get_active_ride_for_simulation")` (Around line 1593)

---

## 3. WebSocket Disconnect "Offline" Hack (RECOMMENDED TO KEEP)
Initially, we had a strict rule that instantly marked a driver as `is_online: False` in the database whenever their WebSocket disconnected. We temporarily removed this because mobile devices frequently suspend WebSockets to save battery when the screen turns off, which was causing drivers to randomly drop offline. 

**Recommendation: Keep this fix.**
Mobile networks are flaky, and aggressively kicking drivers offline just because they switched apps or their screen locked is a bad user experience. Instead of reverting this, we recommend leaving it as-is and relying on a background task (like `BackgroundOrchestrator` in `server.py`) to properly time out drivers who haven't sent a location update in 10+ minutes.

**Location**: `backend/server.py` (Around line 3486)

**What it should stay as**:
```python
        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)
            # DO NOT set driver offline immediately. Mobile devices frequently suspend
            # WebSockets to save battery, and we shouldn't force them offline for a temporary blip.
            # A background task handles true timeouts.
```

---

## 4. The "I've Arrived" Proximity Bypass
- [ ] **Proximity Geofencing**: The logic that allows the driver to click "I've Arrived" from anywhere must be reverted. Enforce a 10m-20m radius check around the pickup/dropoff coordinates.
- [ ] **Offline Disconnect**: In `WebSocketContext.js` or `DriverDashboard.jsx`, revert the logic that prevents the driver from going offline if `isSimulating` is true. Ensure the `onclose` and heartbeat checks function properly.
- [ ] **Fraud Protection Delta**: In `backend/server.py` inside the `complete_ride` endpoint, restore the `delta < 60` check. It is currently lowered to `delta < 2` seconds to allow fast testing without raising "Cannot complete ride instantly" errors.

We updated `backend/server.py` to allow the ride to transition directly from `driver_accepted` straight to `driver_arrived`, entirely bypassing the "driving to pickup" logic and physical distance checks.

**Recommendation: Revert for Production.**
When hardening for real users, you must implement the geofencing logic in the app to hide/disable the "I've Arrived" button until `calculateDistance(driver_location, pickup_location) <= 20` meters. Additionally, the backend `VALID_TRANSITIONS` should be reverted to strictly enforce the physical flow.

**Location**: `backend/server.py` (Around line 150)

**What it looks like now**:
```python
    "driver_accepted": ["driver_en_route_to_pickup", "driver_arrived", "cancelled"],
```

**If you want to revert to the old strict behavior**, restore it to:
```python
    "driver_accepted": ["driver_en_route_to_pickup", "cancelled"],
```

---

## 5. The Python Test Scripts Folder
We built several Python scripts to test the E2E flow. These are safe to leave in the repository (they aren't deployed to the React frontend or the FastAPI runtime), but they won't work in production once you remove the `/test/` routes above.

**Location**: 
- `backend/qa_env/simulate_physical.py`
- `backend/test_scripts/simulate_e2e_trip.py`
- `backend/test_scripts/simulate_roaming_drivers.py`

You can leave these folders as they serve as good references, or delete them if you want a fully clean repository.

---

## 6. The "Complete Ride" Proximity Bypass
To ensure the "Complete Ride" button was always visible and clickable during manual testing (regardless of where the script or fake GPS was), we forcefully modified `DriverDashboard.jsx` to show the "Complete Ride" button based simply on the ride's active status (`ongoing`, `ride_started`, `ride_in_progress`, `arriving_destination`). 

**Recommendation: Revert for Production.**
When hardening for real users, you must implement geographic proximity logic in the frontend so that the "Complete Ride" button ONLY appears or becomes clickable when the driver is within 10-20 meters of the actual dropoff location. The frontend should not just blindly trust the state machine.

**Location**: `frontend/src/pages/DriverDashboard.jsx` (Around line 556)

---

## 7. The Backend "Ride Completed" State Skip
Because our test app UI did not have separate buttons for all the intermediate states (`ride_in_progress` and `arriving_destination`), we modified the `VALID_TRANSITIONS` object in the backend to allow a driver to jump straight from `ride_started` or `ride_in_progress` directly to `ride_completed`. 

**Recommendation: Revert for Production.**
In production, the backend should enforce the strict, full lifecycle of the ride. A driver should have to sequentially hit `ride_started` -> `ride_in_progress` -> `arriving_destination` -> `ride_completed`. 

**Location**: `backend/server.py` (Around line 150)

**What it looks like now**:
```python
    "ride_started": ["ride_in_progress", "ride_completed", "completed"],
    "ongoing": ["completed", "arriving_destination"],
    "ride_in_progress": ["arriving_destination", "ride_completed"],
```

**If you want to revert to the old strict behavior**, restore it to:
```python
    "ride_started": ["ride_in_progress"],
    "ongoing": ["completed", "arriving_destination"],
    "ride_in_progress": ["arriving_destination"],
```

---

## 8. The Wallet Balance Offline Bypass
In production, if a driver completes a ride and the deducted commission causes their `wallet_balance` to drop below their `minimum_required_balance` (usually 50.0 Kwacha), the backend forces their account status to `RESTRICTED` and immediately kicks them offline (`is_online = False`). To prevent testers from randomly dropping offline after test rides without needing to constantly manually top-up their test wallet, we commented out this offline-kicking logic.

**Recommendation: Revert for Production.**
In production, drivers who fail to maintain the minimum wallet balance should indeed be kicked offline and blocked from accepting new rides until they top-up.

**Location**: `backend/server.py` (Inside the `complete_ride` function, around line 2266)

**What it looks like now**:
```python
    if new_balance < driver.get("minimum_required_balance", 50.0):
        wallet_status = WalletStatus.RESTRICTED.value
        # TEMPORARY: Do not force offline based on wallet balance for testing
        # is_still_online = False
```

**If you want to revert to the old strict behavior**, restore it to:
```python
    if new_balance < driver.get("minimum_required_balance", 50.0):
        wallet_status = WalletStatus.RESTRICTED.value
        is_still_online = False
```

---

### Summary Checklist for Launch Day:
- [ ] Remove `isSimulating` state and button from `DriverDashboard.jsx`
- [ ] Revert `startWatching` logic in `DriverDashboard.jsx`
- [ ] Implement distance checks (geofencing) for the "I've Arrived" button
- [ ] Implement distance checks (geofencing) for the "Complete Ride" button
- [ ] Revert `VALID_TRANSITIONS` in `server.py` to require physical flow for pickup
- [ ] Revert `VALID_TRANSITIONS` in `server.py` to require physical flow for dropoff
- [ ] Restore wallet balance offline constraint in `server.py`
- [ ] Delete `/test/inject_drivers` route in `server.py`
- [ ] Delete `/test/accept_trip` route in `server.py`
- [ ] Delete `/test/get_active_ride_for_simulation` route in `server.py`
- [ ] (Optional) Restore the strict WebSocket offline toggle in `server.py`
