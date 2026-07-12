# 🧪 Physical Testing Checklist — Student-Ride

> Open this on your left. Work through each scenario top to bottom.  
> The movement simulator script runs in a separate terminal to animate driver GPS automatically.

---

## 🔐 Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **Student A** | `student_a@qa.com` | `password123` | Primary student |
| **Student B** | `student_b@qa.com` | `password123` | Second student for shared rides |
| **Student C** | `student_c@qa.com` | `password123` | Third student |
| **Driver A** | `driver_a@qa.com` | `password123` | 2-seat private driver |
| **Driver B** | `driver_b@qa.com` | `password123` | 4-seat shared driver |

> Log in through the normal login page — no shortcuts.

---

## 🚗 SCENARIO 1 — Private Ride (1 Student, 1 Driver)

**Setup:** 2 browser windows

| Window | Role | Account |
|--------|------|---------|
| Window 1 | Student A | `student_a@qa.com` |
| Window 2 | Driver A | `driver_a@qa.com` |

### Steps:

- [ ] **Student A** — Log in → reach dashboard
- [ ] **Student A** — Tap **Request Ride** → confirm pickup location → confirm destination → select **Private** → tap **Request**
- [ ] **Driver A** — Notification appears: "New Ride Request"
- [ ] **Driver A** — Tap **Accept**
- [ ] ✅ *Start simulator in terminal:* `node qa_env/move_driver.js --driver driver_a@qa.com --mode to_student`
- [ ] **Student A** — Map shows driver moving toward them
- [ ] **Driver A** — Tap **I've Arrived** when near student
- [ ] **Student A** — "Your driver has arrived" appears
- [ ] **Driver A** — Tap **Start Ride**
- [ ] **Student A** — Map shows ride in progress
- [ ] ✅ *Simulator switches mode automatically* — or run: `node qa_env/move_driver.js --driver driver_a@qa.com --mode to_destination`
- [ ] **Driver A** — Tap **Complete Ride**
- [ ] **Student A** — Rating screen appears
- [ ] **Student A** — Give rating, submit

### ✅ Pass Criteria:
- Ride status transitions: `requested → driver_accepted → driver_arrived → ride_started → ride_completed`
- Driver map pin moves smoothly on student's screen
- Fare is calculated and shown on completion screen

---

## 🚌 SCENARIO 2 — Shared Ride (2 Students, 1 Driver)

**Setup:** 3 browser windows

| Window | Role | Account |
|--------|------|---------|
| Window 1 | Student A | `student_a@qa.com` |
| Window 2 | Student B | `student_b@qa.com` |
| Window 3 | Driver B | `driver_b@qa.com` |

### Phase 1 — Student A Books First

- [ ] **Student A** — Log in → Request Ride → select **Shared** → Request
- [ ] **Driver B** — Notification: "New Ride Request" → tap **Accept**
- [ ] ✅ *Start simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_a`
- [ ] **Student A** — Driver moving on map ✅
- [ ] **Driver B** — Tap **I've Arrived** near Student A
- [ ] **Student A** — "Driver arrived" shown ✅

### Phase 2 — Student B Books (Driver is on the way to A)

- [ ] **Student B** — Log in → Request Ride → select **Shared** → Request
- [ ] **Driver B** — Second ride notification appears (shared)
- [ ] **Driver B** — Tap **Accept** for Student B's ride
- [ ] Both students see the driver on their maps ✅

### Phase 3 — Pickup Student A, Route to Student B

- [ ] **Driver B** — Tap **Start Ride** (with Student A)
- [ ] ✅ *Simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_student_b`
- [ ] Driver route now draws to **Student B's pickup** location
- [ ] **Driver B** — Tap **I've Arrived** near Student B

### Phase 4 — Pickup Student B, Route to Destination

- [ ] **Student B** — "Driver arrived" shown ✅
- [ ] **Driver B** — Tap **Start Ride** (with Student B)
- [ ] ✅ *Simulator:* `node qa_env/move_driver.js --driver driver_b@qa.com --mode to_destination`
- [ ] **Driver B** — Tap **Complete Ride**
- [ ] Both **Student A** and **Student B** — Rating screens appear

### ✅ Pass Criteria:
- Driver map shows route updating after each pickup
- Both students see real-time driver location
- Shared fare split shown correctly
- Both students reach rating screen independently

---

## 📍 SCENARIO 3 — Ride Cancellation

**Setup:** 2 windows (Student A + Driver A)

- [ ] **Student A** — Request a Private Ride
- [ ] **Driver A** — Accept the ride
- [ ] **Student A** — Cancel the ride
- [ ] **Driver A** — "Ride Cancelled" notification appears
- [ ] **Driver A** — Status returns to "Ready for Rides"

### ✅ Pass Criteria:
- Driver is unlocked after cancellation
- Student sees cancellation confirmation
- No orphan ride record remains active

---

## 📱 SCENARIO 4 — Realtime Map Smoke Test

**Setup:** Student A + Driver A (logged in, ride accepted)

- [ ] Run: `node qa_env/move_driver.js --driver driver_a@qa.com --mode loop --speed fast`
- [ ] Watch **Student A's** map — driver pin should move smoothly every ~2 seconds
- [ ] Check map camera follows the driver
- [ ] Check route line updates as driver moves

### ✅ Pass Criteria:
- No map freeze or pin stuck
- Route redraws as driver deviates
- No console errors in browser DevTools

---

## 🔁 SCENARIO 5 — Repeatability Check

- [ ] Run the full automated suite: `cd qa_env && node run_qa_certification.js`
- [ ] All 4 automated scenarios should pass
- [ ] Run it a **second time** back-to-back — it must pass again

### ✅ Pass Criteria:
- Both runs: `✅ PASSED — Production Ready`
- No data conflicts between runs

---

## 🛑 Known Things We're NOT Testing Here
(Pre-validated by the automated suite)

- WebSocket connection stability — ✅ automated
- DB status transitions after acceptance — ✅ automated  
- Driver capacity enforcement — ✅ automated
- Vehicle capacity 2 / 4 / 5 / 7 seats — ✅ automated

---

## 🆘 If Something Fails

| Symptom | Likely cause | Quick fix |
|---------|-------------|-----------|
| Driver stays offline after login | Backend lost WS | Refresh driver window |
| "No drivers found" for student | Driver not online | Check driver toggled online |
| Map pin doesn't move | Simulator not running | Start `move_driver.js` |
| 500 on `/drivers/me` | Stale DB state | Re-run `python seed_qa_data.py` |
| Rating screen never appears | Ride not completed | Check driver tapped "Complete Ride" |
