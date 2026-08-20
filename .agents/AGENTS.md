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
   - Strict `length > 2` polyline requirement across frontend & backend.

### 🛡️ ZERO REGRESSION & COMPLETE ISOLATION GUARANTEE:
- **Zero Modifications to Ride Logic**: No Admin fixes, optimizations, or refactors are permitted to modify, alter, or touch any active ride state machines, driver acceptance pipelines, student request handlers, or pricing algorithms.
- **Strict Isolation**: All future Admin dashboard fixes will be 100% confined to Admin-specific analytics endpoints (`/api/admin/*`), offloading push notification I/O to background threads, and client-side Admin UI components.
- **Mandatory User Permission**: If ANY future task requires modifying code in any of the locked modules listed above:
  1. You MUST explicitly ask the user for permission BEFORE making any edits.
  2. You MUST explain the exact line numbers and proposed code changes.
  3. You MUST prove that the change will NOT break or regress the Ride Cycle, Student Acceptance, Zero-Flicker Buttons, or Route Rendering.

---

## 🧠 MANDATORY KARPATHY GUIDELINES (ENFORCED ACROSS ALL AGENTS)

All agents working in this codebase MUST follow the 4 Karpathy Guidelines on EVERY task without exception:

### 1. Think Before Coding
- **Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — do not pick silently.
- If a simpler approach exists, suggest it and push back when warranted.
- If something is unclear, stop, name what is confusing, and clarify.

### 2. Simplicity First
- **Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines were written where 50 suffice, rewrite and simplify.

### 3. Surgical Changes
- **Touch only what you must. Clean up only your own mess.**
- Do NOT "improve" adjacent code, comments, or formatting.
- Do NOT refactor things that aren't broken.
- Match existing style, even if you'd write it differently.
- If you notice unrelated dead code, mention it — do not delete it without permission.
- Remove imports/variables/functions that YOUR changes made unused. Every changed line must trace directly to the request.

### 4. Goal-Driven Execution
- **Define success criteria. Loop until verified.**
- Transform tasks into verifiable goals before executing.
- For multi-step tasks, state a brief plan: `[Step] -> verify: [check]`.
- Verify every change with real execution/tests before declaring completion.

