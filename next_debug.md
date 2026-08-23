# 🛠️ Next Debug & Refinement Specification

---

## 1. 🎥 Student Camera 3D Stabilization & Dynamic Zoom Redesign

### **Root Cause Diagnosis**
In `StudentDashboard.jsx`, the active ride camera mode was dynamically governed by:
```javascript
const stopsRemaining = passengerBriefing?.stops_remaining || 0;
const isPriorStopsActive = isSharedRide && stopsRemaining > 0;

if (activeRide.status === 'requested' || isPriorStopsActive) {
  cameraMode = CAMERA_MODES.OVERVIEW; // 👈 2D Flat Bounds-Fitting Overview (pitch: 0, bearing: 0)
} else {
  cameraMode = CAMERA_MODES.FOLLOW_DRIVER; // 👈 3D 45° Pitch Follow Camera
}
```

1. **Initial Snap to 2D**:
   - On ride accept, `passengerBriefing` is initially hydrating. `stopsRemaining` defaults to `0`, entering 3D `FOLLOW_DRIVER`.
   - Once the server briefing arrives (~1.5–2s later) with `stops_remaining > 0` (driver visiting other stops first), `isPriorStopsActive` flips to `true`, forcing the camera into `CAMERA_MODES.OVERVIEW` (flat 2D bounding box).
2. **Switching Bounces with 2+ Passengers**:
   - Every periodic recalculation or location update re-evaluates `stops_remaining`, causing rapid bouncing between 2D and 3D perspectives.

### **Required Redesign (100% 3D — Zero 2D during Active Rides)**
* **No 2D Transitions**: Once a ride is accepted (`driver_accepted`, `driver_en_route_to_pickup`, `driver_arrived`, `ongoing`, etc.), the camera must **strictly stay in 3D Follow Mode (`CAMERA_MODES.FOLLOW_DRIVER`)** with a 45° pitch tilt at all times.
* **Dual 3D Zoom Hierarchy**:
  - **Case A (Student is Next Stop — `is_next_stop === true` / `stops_remaining === 0`)**:
    - Tight 3D student follow perspective (**Zoom ~17.8**, 45° tilt, following vehicle heading).
  - **Case B (Driver is Serving Other Passengers First — `stops_remaining > 0`)**:
    - Wider 3D follow perspective (**Zoom ~15.5**, 45° tilt, following vehicle heading) to visualize approaching route context without flattening into 2D.
* **Instant Detection**:
  - Driven by backend `passengerBriefing.is_next_stop` (`route_queue[0].student_id === my_id`), updating instantly over WebSocket when stop order changes.

---

## 2. 🛣️ Multi-Passenger Route Stabilization & Ghost Line Elimination

### **Root Cause Diagnosis**
1. **Frontend vs Backend Route Calculation Clash**:
   - In `DriverDashboard.jsx`, a client-side watchdog runs `fetchRoutes()` (calling Mapbox API in-browser on GPS shifts).
   - Simultaneously, backend `trip_rebuilder.py` computes multi-segment Mapbox directions on `update_driver_location` and broadcasts them via WebSocket.
   - When 2+ passengers are active, both systems calculate 3–4 legs concurrently, overwriting route geometry arrays every 2–3 seconds and triggering constant re-renders.
2. **Double Slicing (Deleted Routes Reappearing Behind Vehicle)**:
   - Backend `trip_rebuilder.py` produces the active leg (`seg-0`) already originating from the driver's live GPS point.
   - Frontend `PlatformMap.jsx` / `RouteEngine.jsx` ALSO applies `turf.lineSlice` using the driver's location.
   - Slight timing latency between WebSocket GPS and route geometry results in slicing an already-sliced geometry, momentarily drawing deleted route segments behind the driver.
3. **Dynamic Segment Key Churn**:
   - Route legs are keyed by array index (`seg-0`, `seg-1`). As stops are completed or reordered, keys change index, destroying and re-mounting Mapbox source layers instead of smoothly animating coordinates.

### **Required Fixes**
* **Single Source of Truth for Routing**:
  - Consolidate route geometry generation to backend `trip_rebuilder.py` / `trip_manager.py`. Disable competing client-side multi-leg recalculation loops.
* **Coordinate-Level Slicing Isolation**:
  - Ensure only the active leg is dynamically clipped to the vehicle's position, and future legs remain completely intact without duplicate slicing.
* **Stable Route Segment Keys**:
  - Key route legs by stable stop IDs (e.g. `stop_pickup_<ride_id>`, `stop_dropoff_<ride_id>`) rather than transient array indexes (`seg-0`, `seg-1`) to prevent Mapbox layer re-creation flickering.

---

## 3. 🔄 Real-Time Stop Synchronization Architecture

* **Instant Broadcast on Acceptance**:
  - When the driver accepts a new passenger while already on an active trip, recompute the full route queue and dispatch `trip_updated` / `ride_updated` broadcasts to all active passengers simultaneously.
* **Zero Delay State Hydration**:
  - Immediately reflect stop position updates (`is_next_stop`, `stops_remaining`, dynamic 3D zoom adjustment) across all connected student sessions without requiring manual page refresh or route reloading delays.
