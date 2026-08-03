# AGENTS.md - Workspace Rules

## 🔒 LOCKED STABLE MODULES & STRICT USER PERMISSION REQUIREMENT

The following core modules are **LOCKED AND STABLE**:
1. **Ride Lifecycle & Driver Acceptance**: `driver_arrived`, `start_ride`, `complete_ride`, `accept_ride`, `DriverTripRebuilder`.
2. **Driver UI Lifecycle Controls**: `DriverDashboard.jsx` (Zero-flicker optimistic UI locks).
3. **Route & Map Engines**: `RouteEngine.jsx`, `RouteRenderer.jsx`, `PlatformMap.jsx`, `RideMap.jsx`, `RouteCache.js`.
4. **Camera & Zoom Control**: `CameraEngine.jsx`, `ZoomController.js`.
5. **No Straight Lines Policy**: Strict `length > 2` polyline requirement across frontend & backend.

### MANDATORY RULE BEFORE EDITING LOCKED MODULES:
If ANY future task requires modifying code in any of the locked modules listed above:
1. You MUST explicitly ask the user for permission BEFORE making any edits.
2. You MUST explain the exact line numbers and proposed code changes.
3. You MUST prove that the change will NOT break or regress the Ride Cycle, Student Acceptance, Zero-Flicker Buttons, or Route Rendering.
