# AGENTS.md - Workspace Rules

## 🔒 LOCKED STABLE MODULES & STRICT USER PERMISSION REQUIREMENT

The following core modules and files are **STRICTLY LOCKED AND PROVEN STABLE**:
1. **Backend Ride Lifecycle & State Machine**:
   - `request_ride`, `accept_ride`, `driver_arrived`, `start_ride`, `complete_ride`, `cancel_ride`
   - `get_active_ride`, `get_ride_history`, `get_driver_earnings`, `DriverTripRebuilder`
   - Matching logic, pricing calculations, trip status transitions, and MongoDB ride schemas.
2. **Driver UI Lifecycle Controls**:
   - `DriverDashboard.jsx` (Zero-flicker optimistic UI locks, passenger cards, active route tracking).
3. **Route & Map Engines**:
   - `RouteEngine.jsx`, `RouteRenderer.jsx`, `PlatformMap.jsx`, `RideMap.jsx`, `RouteCache.js`.
4. **Camera & Zoom Control**:
   - `CameraEngine.jsx`, `ZoomController.js`.
5. **No Straight Lines Policy**:
6. **Student Ride Request Engine & Transit Stepper (`RideRequestPage.jsx`, `stepper.jsx`)**:
   - Complete page layout, Map Viewport Engine, Bottom Sheet Shell, GPS Alignment, and 2-step transit Stepper (`step === 'pickup'`, `step === 'dropoff'`, `step === 'confirm'`) are **PERMANENTLY LOCKED AND PROVEN STABLE**. No further edits allowed without explicit user permission.

### 🛡️ ZERO REGRESSION & COMPLETE ISOLATION GUARANTEE:
- **Zero Modifications to Ride Logic**: No Admin fixes, optimizations, or refactors are permitted to modify, alter, or touch any active ride state machines, driver acceptance pipelines, student request handlers, or pricing algorithms.
- **Strict Isolation**: All future Admin dashboard fixes will be 100% confined to Admin-specific analytics endpoints (`/api/admin/*`), offloading push notification I/O to background threads, and client-side Admin UI components.
- **Mandatory User Permission**: If ANY future task requires modifying code in any of the locked modules listed above:
  1. You MUST explicitly ask the user for permission BEFORE making any edits.
  2. You MUST explain the exact line numbers and proposed code changes.
  3. You MUST prove that the change will NOT break or regress the Ride Cycle, Student Acceptance, Zero-Flicker Buttons, or Route Rendering.

## 🧠 ACTIVE SKILL SET UTILIZATION
- Always proactively check and utilize available installed skills (e.g. `frontend-design`, `react-best-practices`, `mobile-developer`, `systematic-debugging`, `lint-and-validate`, `ui-ux-pro-max`, `geo-fundamentals`).
- Ground design, architecture, and debugging decisions directly in specialized skill runbooks without hesitation.
