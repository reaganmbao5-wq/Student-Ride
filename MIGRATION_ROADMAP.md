# 🗺️ STUDENT-RIDE: MASTER FEATURE MIGRATION ROADMAP

> **Branch Target**: Strictly `Mapbox-stable` (`origin/Mapbox-stable`)  
> **Workspace**: Strictly `C:\Users\Reaga\OneDrive\Documents\VS Codes\Projects\Mapbox stable`  
> **Baseline Commit**: `885a0b1` (*"perf(map): set camera flyTo speed 2x slower to smooth 4.8s glide"*)  
> **Current Head**: Commit `a06753e` (*"perf(booking-flow): eliminate backdrop-blur GPU overhead, pre-index places globally, and hard-lock 260px bottom-sheet envelope"*)  
> **Verification Status**: ✅ **Part 1 (Bundles 1-4) & Part 2 (Bundles A & B) 100% Complete & Stable**

---

## 📌 MASTER ARCHITECTURE DIVISION

```mermaid
graph TD
    subgraph COMPLETED_BUNDLES["🛡️ COMPLETED & STABILIZED (100% VERIFIED)"]
        B1["✅ Safe Bundle 1: Campus POIs & Proximity Geocoding (a9d5168)"]
        B2["✅ Safe Bundle 2: Notification Pipeline & Android Assets (f969c9a)"]
        B3["✅ Safe Bundle 3: Lecturer Role & Academic Profiles (144ec87)"]
        B4["✅ Safe Bundle 4: Admin Dashboard Overhaul & KYC Lightbox (7561769)"]
        IA["✅ Isolated Bundle A: Destination Search & ActionSearchBar (68fdb09)"]
        IB["✅ Isolated Bundle B: Transit Stepper UI & 260px Height Lock (a06753e)"]
    end

    subgraph REMAINING_SANITIZED_BUNDLES["📦 REMAINING SANITIZED BUNDLES (CHRONOLOGICAL & DECOUPLED)"]
        IC["📦 Bundle C: Pricing Synchronization, Fixed Route Priority & Shimmer (49ee6a9, 727804d)"]
        ID["📦 Bundle D: 10% Commission Fix, Historical Repair & Accountant Suite (bba1e7c, d2031a9)"]
        IE["📦 Bundle E: Driver Onboarding, Vehicle Setup Pipeline & Driver Guard (42ab201, 996d75c, f597f2e)"]
        IF["📦 Bundle F: Simulation Engine & Quarantined Developer QA Suite (891a080, 11ae78f, c016429)"]
    end

    subgraph FINAL_VERIFICATION["🏁 PART 3: FINAL DEEP VERIFICATION"]
        FV["Deep Testing via RIDE_CYCLE_DEBUG_CHECKLIST.md"]
    end

    COMPLETED_BUNDLES --> REMAINING_SANITIZED_BUNDLES --> FINAL_VERIFICATION
```

---

## 🛡️ COMPLETED BUNDLES (100% STABILIZED & LOCKED)

### ✅ Safe Bundles 1–4 (Commits `a9d5168`, `f969c9a`, `144ec87`, `7561769`)
* Campus POIs, Maki icon categorization, and proximity reverse geocoding.
* Push notification pipelines, VAPID auto-purging, and transparent Android notification silhouettes.
* Lecturer passenger role, tactile study year selector (1–5), and targeted push notifications.
* Admin dashboard overhaul, instant bulk Mongo batching (<30ms), and full-screen KYC inspection lightbox.

### ✅ Isolated Bundles A & B (Commits `68fdb09`, `f18ab1f`, `a06753e`)
* Top expandable ActionSearchBar with zero GPU blur overhead and global places indexing.
* 2-Step transit stepper (Pickup $\rightarrow$ Destination) with flush-aligned GPS button.
* Hard-locked 260px bottom sheet envelope guaranteeing 0% WebGL canvas resize and 0ms blackout flicker across all steps.

---

## 📦 REMAINING SANITIZED BUNDLES (CHRONOLOGICAL & TOXICITY-FREE)

---

### 📦 Bundle C: Pricing Synchronization, Fixed Route Priority & Shimmer (Commits `49ee6a9`, `727804d`)
* **Core Problem Solved**: Eliminates price flickering where instant distance calculation flashed before fixed campus route pricing loaded.
* **Key Features**:
  1. **Backend Fixed Route Priority**: `/rides/estimate` resolves `fixed_routes` priority first before falling back to distance estimation.
  2. **Fare Loading Shimmer**: Skeleton shimmer animation during fare calculations so only verified prices render cleanly.
  3. **Admin `FixedRouteManager.jsx` with Mapbox POI Picker**: Visual admin tool for managing fixed campus route polygons and prices.
  4. **In-Ride Messaging Delivery**: Real-time chat message acknowledgment and notification push.
* **🛡️ Quarantined / Excluded**: RideRequestPage bottom sheet modifications from `49ee6a9` are strictly ignored to protect our locked `a06753e` layout.

---

### 📦 Bundle D: 10% Commission Fix, Historical Repair & Accountant Suite (Commits `bba1e7c`, `d2031a9`)
* **Core Problem Solved**: Corrects the critical 0.01% platform commission division bug to true 10.0%, repairs historical MongoDB records, and adds financial reporting.
* **Key Features**:
  1. **Commission Math Fix**: Corrects `commission = fare * (commission_rate / 100)` (exact 10% platform share).
  2. **Historical Data Repair Script**: `repair_ride_commissions.py` to fix past database records so net revenue analytics match reality.
  3. **Full Accountant Dashboard Suite**:
     * `AccountantDashboard.jsx` (Revenue KPIs, net profit, driver payouts)
     * `AccountantLedgerPage.jsx` (Real-time financial audit trail)
     * `AccountantPricingPage.jsx` (Base fare & commission controls)
     * `AccountantSettlementsPage.jsx` (Driver settlement processing)
  4. **Status Normalization**: Maps `ride_archived` status badges to `"Completed"` in all ledger views.

---

### 📦 Bundle E: Driver Onboarding, Vehicle Setup Pipeline & Driver Guard (Commits `42ab201`, `996d75c`, `f597f2e`)
* **Core Problem Solved**: Provides vehicle setup for promoted drivers while protecting already-approved drivers from seeing onboarding gates.
* **Key Features**:
  1. **Approved Driver Protection Guard (`996d75c`)**: Prevents approved drivers from ever seeing setup screens or KYC register gates.
  2. **Vehicle Setup Pipeline (`42ab201`)**: Step-by-step vehicle registration modal with instant live role synchronization.
  3. **Mini-Map Centering & GPS Broadcast Optimization (`f597f2e`)**: Smooth driver location updates.

---

### 📦 Bundle F: Simulation Engine & Quarantined Developer QA Suite (Commits `891a080`, `11ae78f`, `c016429`)
* **Core Problem Solved**: Developer simulation and regression testing tools without destabilizing production runtime.
* **Key Features**:
  1. **`MasterRouteTester.py` & Simulation Upgrades (`11ae78f`, `891a080`)**: 15-meter curved road navigation via Mapbox Directions API for realistic demo simulation.
  2. **Quarantined QA Audit Tools (`backend/qa_suite/`)**: Standalone developer test scripts.
* **🚫 TOXIC ITEMS PERMANENTLY REMOVED**:
  * ❌ *Purged*: Invasive approach-leg route rendering in `StudentDashboard.jsx` that caused live ride flickering.
  * ❌ *Purged*: Headless automated browser scripts that flood the DB or wipe production collections.
  * ❌ *Purged*: In-memory rate limiter overrides that blocked normal login during test runs.

---

## 🏁 PART 3: FINAL RIDE CYCLE TESTING & STABILIZATION
Full verification transfers to [`RIDE_CYCLE_DEBUG_CHECKLIST.md`](file:///C:/Users/Reaga/OneDrive/Documents/VS%20Codes/Projects/Mapbox%20stable/RIDE_CYCLE_DEBUG_CHECKLIST.md) for complete end-to-end testing of single and multi-passenger ride lifecycles, dynamic 60 FPS line erasing behind the vehicle, bidirectional cancellation, and rating modal flows.

