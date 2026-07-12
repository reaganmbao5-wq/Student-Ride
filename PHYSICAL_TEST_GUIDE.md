# 🧪 Master QA Certification Guide — Mulungushi Rides

> **How to use this guide:**  
> Work through each scenario from top to bottom. Tick every checkbox as you go.  
> A scenario only **PASSES** if every single checkbox in it is ticked.  
> Do not skip steps. Do not assume.

---

## 🔐 Test Credentials

| Role | Email | Password | Vehicle | Notes |
|------|-------|----------|---------|-------|
| **Student A** | `student_a@qa.com` | `password123` | — | Primary student tester |
| **Student B** | `student_b@qa.com` | `password123` | — | Second student for shared rides |
| **Student C** | `student_c@qa.com` | `password123` | — | Third student for 3-passenger tests |
| **Driver A** | `driver_a@qa.com` | `password123` | Toyota Yaris · 2-seat | Private rides only |
| **Driver B** | `driver_b@qa.com` | `password123` | Toyota Corolla · 4-seat | Shared ride driver |
| **Driver C** | `driver_c@qa.com` | `password123` | Toyota Sienta · 5-seat | High-capacity shared |
| **Admin** | `admin@qa.com` | `password123` | — | Admin panel access |

> ⚠️ If any login fails, re-run: `python seed_qa_data.py` from the project root.

---

## 🛠️ Before You Start

Run these in the terminal before any testing:

```bash
# 1. Start backend
cd backend && python -m uvicorn server:app --reload --port 8000

# 2. Start frontend (separate terminal)
cd frontend && npm start

# 3. Seed test data (if first time or data is stale)
python seed_qa_data.py
```

---

## ═══════════════════════════════════════
## 🚗 SCENARIO 1 — Private Ride (Single Student, Single Driver)
## ═══════════════════════════════════════

**Purpose:** Verify the complete private ride lifecycle end-to-end.

**Setup:** 2 browser windows open side by side.

| Window | Role | Account |
|--------|------|---------|
| Window 1 | Student A | `student_a@qa.com` |
| Window 2 | Driver A | `driver_a@qa.com` |

### Steps:

- [ ] **Student A** — Log in → reach the student dashboard
- [ ] **Student A** — Tap **Request Ride** → set pickup location → set destination → select **Private** → tap **Confirm**
- [ ] **Student A** — Screen shows `Searching for driver...`
- [ ] **Driver A** — Log in → toggle **Go Online**
- [ ] **Driver A** — Ride request notification appears (bell icon + modal)
- [ ] **Driver A** — Tap **Accept**
- [ ] **Driver A** — Dashboard switches to active ride view with **Stop Queue** visible
- [ ] **Student A** — Status changes to `Driver is on the way`
- [ ] ✅ *Run simulator:* `node qa_env/move_driver.js --driver driver_a@qa.com --mode to_student`
- [ ] **Student A** — Driver pin moves smoothly on map toward student
- [ ] **Driver A** — Tap **I've Arrived**
- [ ] **Student A** — Banner: `Your driver has arrived`
- [ ] **Driver A** — Tap **Start Ride**
- [ ] **Student A** — Status changes to `Ride in progress`
- [ ] ✅ *Run simulator:* `node qa_env/move_driver.js --driver driver_a@qa.com --mode to_destination`
- [ ] **Driver A** — Tap **Complete Ride**
- [ ] **Student A** — Rating screen appears
- [ ] **Student A** — Submit a star rating
- [ ] **Driver A** — Dashboard returns to idle state

### ✅ Pass Criteria:
- Status sequence: `requested → accepted → driver_arrived → ongoing → completed`
- Driver map pin moves smoothly on Student A's screen
- Fare is calculated and shown on the completion screen
- Driver returns to idle after ride ends
- No React errors in console at any step

---

## ═══════════════════════════════════════
## 🚌 SCENARIO 2 — Shared Ride (2 Students, 1 Driver, Active Trip Queue)
## ═══════════════════════════════════════

**Purpose:** Verify the new `ActiveTripQueue` (Stop-Driven UI) renders correctly for shared rides and that both students are handled independently.

**Setup:** 3 browser windows.

| Window | Role | Account |
|--------|------|---------|
| Window 1 | Student A | `student_a@qa.com` |
| Window 2 | Student B | `student_b@qa.com` |
| Window 3 | Driver B | `driver_b@qa.com` |

### Phase 1 — First Booking (Student A):

- [ ] **Driver B** — Log in → toggle **Go Online** → confirm capacity shows 4 seats
- [ ] **Student A** — Log in → Request Ride → select **Shared** → Confirm
- [ ] **Driver B** — Ride request modal appears
- [ ] **Driver B** — Accept → **ActiveTripQueue renders on the bottom sheet**
- [ ] **Driver B** — Verify: Queue shows a 🟢 Pickup stop for Student A + 🔴 Dropoff stop
- [ ] **Driver B** — Verify: Capacity badge shows `1 / 4 Passengers`
- [ ] **Student A** — Status changes to `Driver is on the way`

### Phase 2 — Second Booking (Student B while Driver en route to A):

- [ ] **Student B** — Log in → Request Ride → select **Shared** → Confirm
- [ ] **Driver B** — Second ride notification appears (shared pool)
- [ ] **Driver B** — Accept Student B's ride
- [ ] **Driver B** — ActiveTripQueue updates: now shows 4 stops total (2 pickups + 2 dropoffs)
- [ ] **Driver B** — Verify: Queue is ordered intelligently (no impossible ordering)
- [ ] **Driver B** — Verify: Capacity badge updates to `2 / 4 Passengers`
- [ ] **Student B** — Status changes to `Driver is on the way`

### Phase 3 — Pickup Student A:

- [ ] ✅ *Run simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_a`
- [ ] **Driver B** — Tap **I've Arrived** at Student A's location
- [ ] **Student A** — Banner: `Your driver has arrived`
- [ ] **Driver B** — First stop in queue turns green / marked complete
- [ ] **Driver B** — Next stop (Student B pickup) becomes highlighted as active

### Phase 4 — Pickup Student B:

- [ ] ✅ *Run simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_b`
- [ ] **Driver B** — Tap **I've Arrived** at Student B's location
- [ ] **Student B** — Banner: `Your driver has arrived`
- [ ] **Driver B** — Second stop marked complete → Dropoff stops now active

### Phase 5 — Dropoffs:

- [ ] ✅ *Run simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_destination`
- [ ] **Driver B** — Tap **Complete Ride**
- [ ] **Student A** — Rating screen appears independently
- [ ] **Student B** — Rating screen appears independently
- [ ] Both submit ratings

### ✅ Pass Criteria:
- **ActiveTripQueue** renders with correct green (pickup) and gold (dropoff) stop colors
- Capacity badge updates correctly as students are added
- Queue order is logically valid (no pickup scheduled AFTER its own dropoff)
- Each student only sees their own status, ETA, and driver location
- **Student A cannot see Student B's name, phone, or destination** (and vice versa)
- Shared fare split shown correctly on both completion screens
- No React errors in console

---

## ═══════════════════════════════════════
## 🔒 SCENARIO 3 — Student Privacy Isolation (Shared Ride)
## ═══════════════════════════════════════

**Purpose:** Verify that in a shared ride, no student can see another student's private information.

**Setup:** Run Scenario 2 up to Phase 2, then open browser DevTools.

- [ ] With both Student A and Student B in the same shared ride, open **Student A's** browser
- [ ] Open DevTools → Application → Local Storage → inspect stored data
- [ ] Verify: No field contains Student B's name, phone number, or exact dropoff address
- [ ] Open the **Network** tab on Student A's browser
- [ ] Filter for WebSocket messages
- [ ] Inspect incoming messages — verify no payload contains Student B's personal data
- [ ] Repeat the same check on **Student B's** browser for Student A's data

### ✅ Pass Criteria:
- Zero data leaks between passenger profiles
- Student A's DOM renders: own ETA, own status, driver location only
- Student B's DOM renders: own ETA, own status, driver location only

---

## ═══════════════════════════════════════
## 📍 SCENARIO 4 — Ride Cancellation (Student Cancels)
## ═══════════════════════════════════════

**Purpose:** Verify the driver is fully unlocked after a student cancels.

**Setup:** Student A + Driver A

- [ ] **Student A** — Request a Private Ride
- [ ] **Driver A** — Accept the ride
- [ ] **Student A** — Cancel the ride before pickup
- [ ] **Driver A** — Notification: `Ride Cancelled`
- [ ] **Driver A** — Dashboard returns to idle state (no stuck activeRide)
- [ ] **Student A** — Sees cancellation confirmation screen

### ✅ Pass Criteria:
- Driver is fully unlocked (can accept a new ride immediately)
- Student sees clear cancellation confirmation
- No orphan ride record remains with status `accepted`

---

## ═══════════════════════════════════════
## ❌ SCENARIO 5 — Driver Cancellation & Re-Dispatch
## ═══════════════════════════════════════

**Purpose:** Verify the re-dispatch engine escalates correctly when a driver cancels.

**Setup:** Student A + Driver A + Driver B (both online)

- [ ] **Student A** — Request a Private Ride
- [ ] **Driver A** — Accept the ride
- [ ] **Driver A** — Cancel the ride
- [ ] **Student A** — Status shows `Finding another driver...` (NOT an error)
- [ ] **Driver B** — Receives the re-dispatched ride notification within 30 seconds
- [ ] **Driver B** — Accept → Ride continues normally

### ✅ Pass Criteria:
- Student is NOT shown an error after Driver A cancels
- Ride is automatically re-dispatched within 30 seconds
- Driver B can successfully complete the ride

---

## ═══════════════════════════════════════
## 🔄 SCENARIO 6 — Browser Refresh Recovery
## ═══════════════════════════════════════

**Purpose:** Verify that refreshing any browser mid-ride does not break the trip state.

**Setup:** Run Scenario 1 up to the point where the driver has accepted the ride.

- [ ] **Driver A** (has active ride) — Hard refresh the browser (`Ctrl+Shift+R`)
- [ ] **Driver A** — After reload, the active ride view re-appears automatically
- [ ] **Driver A** — The Stop Queue is still intact with correct stops
- [ ] **Student A** — Hard refresh the browser
- [ ] **Student A** — After reload, still sees driver moving on map
- [ ] **Student A** — Ride status is still correct

### ✅ Pass Criteria:
- No "ride lost" on refresh for driver
- No "ride lost" on refresh for student
- Driver trip is fully reconstructed from the `rides` collection (DriverTripRebuilder works)
- WebSocket reconnects automatically within 5 seconds

---

## ═══════════════════════════════════════
## ⏱️ SCENARIO 7 — Seat Reservation Expiry
## ═══════════════════════════════════════

**Purpose:** Verify that a student who requests a shared ride but whose driver assignment fails does NOT permanently block a seat.

**Setup:** Driver B (4-seat) is online. Student A requests a shared ride. No driver accepts within 60 seconds.

- [ ] **Student A** — Request a Shared Ride
- [ ] **Do NOT** accept the ride from any driver window
- [ ] Wait 60+ seconds
- [ ] **Student A** — Status changes to `No driver found. Please try again.`
- [ ] **Driver B** — Capacity shows no seats blocked (still 0/4 occupied)
- [ ] **Student A** — Can immediately re-request a new ride

### ✅ Pass Criteria:
- Seat reservation auto-expires after timeout
- No permanent capacity reduction on the driver
- Student can re-request without issues

---

## ═══════════════════════════════════════
## 🗺️ SCENARIO 8 — Realtime Map Smoke Test
## ═══════════════════════════════════════

**Purpose:** Verify map rendering, pin animation, and route drawing work correctly.

**Setup:** Student A + Driver A (ride accepted and active)

- [ ] Run: `node qa_env/move_driver.js --driver driver_a@qa.com --mode loop --speed fast`
- [ ] **Student A** — Driver pin moves smoothly on the map (updates every ~2 seconds)
- [ ] **Student A** — Map camera follows the driver pin
- [ ] **Student A** — Route line redraws as driver moves
- [ ] **Driver A** — Their own location dot animates on their map
- [ ] Open browser DevTools → Console → verify **zero red errors**

### ✅ Pass Criteria:
- No frozen pin or stuck animation
- Route redraws correctly as driver moves
- Zero console errors during map simulation

---

## ═══════════════════════════════════════
## 🚌 SCENARIO 9 — Full Shared Ride with 3 Students
## ═══════════════════════════════════════

**Purpose:** Stress-test the Stop Queue with 3 simultaneous passengers on a 5-seat driver.

**Setup:** 4 browser windows.

| Window | Role | Account |
|--------|------|---------|
| Window 1 | Student A | `student_a@qa.com` |
| Window 2 | Student B | `student_b@qa.com` |
| Window 3 | Student C | `student_c@qa.com` |
| Window 4 | Driver C | `driver_c@qa.com` · 5-seat |

- [ ] All 3 students request **Shared** rides
- [ ] **Driver C** — Accepts all 3 requests
- [ ] **Driver C** — ActiveTripQueue shows 6 stops (3 pickups + 3 dropoffs)
- [ ] **Driver C** — Capacity badge shows `3 / 5 Passengers`
- [ ] **Driver C** — Stop ordering is logically valid (no pickup after its dropoff)
- [ ] Complete the full ride cycle for all 3 students
- [ ] All 3 students receive independent rating screens

### ✅ Pass Criteria:
- Queue renders all 6 stops correctly
- Driver completes all stops in order without crashes
- All 3 rating screens appear independently after completion

---

## ═══════════════════════════════════════
## 🔁 SCENARIO 10 — Repeatability & Data Cleanup
## ═══════════════════════════════════════

**Purpose:** Verify no stale data from one test run bleeds into the next.

- [ ] Complete Scenario 1 fully
- [ ] Without re-seeding, immediately run Scenario 1 again
- [ ] Everything works identically on the second run
- [ ] Re-run the automated suite: `cd qa_env && node run_qa_certification.js`
- [ ] Run the automated suite a **second time** back-to-back
- [ ] Both automated runs show: `✅ PASSED — Production Ready`

### ✅ Pass Criteria:
- Zero data conflicts between test runs
- Automated suite passes twice in a row

---

## ═══════════════════════════════════════
## 🛑 SCENARIO 11 — Admin Panel Smoke Test
## ═══════════════════════════════════════

**Purpose:** Verify admin can view and manage the system.

**Setup:** Admin window only.

- [ ] **Admin** — Log in with `admin@qa.com`
- [ ] Navigate to the Admin Dashboard
- [ ] View all active drivers (Driver A, B, C shown as online)
- [ ] View all recent rides from the test runs
- [ ] Verify driver stats (total rides, earnings) updated after test runs

### ✅ Pass Criteria:
- Admin sees real-time driver locations on admin map
- All ride records from test runs are visible
- No 500 errors on any admin API call

---

## ═══════════════════════════════════════
## 🔧 Troubleshooting Reference
## ═══════════════════════════════════════

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| Driver stays offline after login | WebSocket lost | Refresh driver window |
| `No drivers found` for student | Driver not online | Check driver toggled Online |
| Map pin doesn't move | Simulator not running | Start `move_driver.js` |
| 500 on `/drivers/me` | Stale DB state | `python seed_qa_data.py` |
| Rating screen never appears | Ride not completed | Check driver tapped "Complete Ride" |
| Shared ride shows wrong capacity | Stale `driver_trips` doc | Restart backend server |
| ActiveTripQueue blank | React compile error | Check browser console for error |
| Student sees other passenger data | Privacy bug — **CRITICAL** | File a bug immediately, do NOT ship |

---

## 📋 Final Certification Checklist

Before marking this build as **Production Ready**, every scenario above must have all checkboxes ticked.

| Scenario | Status |
|----------|--------|
| SCENARIO 1 — Private Ride | ⬜ PENDING |
| SCENARIO 2 — Shared Ride (2 Students) | ⬜ PENDING |
| SCENARIO 3 — Privacy Isolation | ⬜ PENDING |
| SCENARIO 4 — Student Cancellation | ⬜ PENDING |
| SCENARIO 5 — Driver Cancellation & Re-Dispatch | ⬜ PENDING |
| SCENARIO 6 — Browser Refresh Recovery | ⬜ PENDING |
| SCENARIO 7 — Seat Expiry | ⬜ PENDING |
| SCENARIO 8 — Map Smoke Test | ⬜ PENDING |
| SCENARIO 9 — 3-Student Shared Ride | ⬜ PENDING |
| SCENARIO 10 — Repeatability | ⬜ PENDING |
| SCENARIO 11 — Admin Panel | ⬜ PENDING |

> **FINAL VERDICT:** ⬜ PENDING  
> *(Change to ✅ PASS or ❌ FAIL after completing all scenarios)*
