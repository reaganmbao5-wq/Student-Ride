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
6. **Bottom Sheet Shell & Map Viewport Engine (`RideRequestPage.jsx`)**:
   - Page container layout (`h-[100dvh] flex flex-col`), Map container flex wrapper (`step === 'confirm' && isCollapsing ? 'absolute inset-0 z-0' : 'flex-1 relative z-0'`), Bottom sheet outer `motion.div` (`rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] relative z-20 flex flex-col overflow-hidden`), drag handle pill, and `px-5 pb-5 flex flex-col gap-4` animation container.
   - **Constraint**: Only the child content/logic inside the inner content slot can ever be edited. All outer container styles, layout positioning, height calculations, and animation transitions are permanently locked.

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
