# 📋 QA & Feature Testing Checklist

This document contains the complete list of test scenarios for all recent features, UI improvements, and Admin Dashboard capabilities. You can run through these tests once deployments are completed.

---

## 1. 🎨 Theme Colors & Button Integrity
- [ ] **Accent Color Selection**: Go to **Profile ➝ Appearance ➝ Accent Color** and switch between **Pink**, **Blue**, **Green**, **Gold**, etc.
- [ ] **Solid Button Appearance**: Check buttons on the Landing Page, Auth Page, Profile, and Complete Profile screens (*Start Riding*, *Sign In*, *Sign Up*, *Save Changes*). Verify they render with **vibrant, solid background colors** and **zero blurry glowing halos/shadows**.
- [ ] **Press / Touch State**: Tap and hold any button. Verify the button stays its chosen accent color and does **not** shift or turn gold/brown on touch.

---

## 2. 🎓 Roles, Year of Study & Native Pill Selectors
- [ ] **Student Sign-Up (`/auth`)**:
  - Select **Student** as the passenger type.
  - Test the **Year of Study pill selector** (`1st`, `2nd`, `3rd`, `4th`, `5th`) — tap each year and verify instant single-tap selection with no browser popups or alert prompts.
  - Test the **Academic Program toggle** (`Standard (4-Yr)` vs `Engineering (5-Yr)`).
  - Submit registration and verify successful entry to the student dashboard.
- [ ] **Lecturer Sign-Up (`/auth`)**:
  - Select **Lecturer** as the passenger type.
  - Verify Year of Study and Program selectors automatically hide.
  - Submit registration and verify immediate access to passenger features.
- [ ] **Google OAuth Profile Completion (`/complete-profile`)**:
  - Sign in with a new Google account that redirects to profile completion.
  - Verify the Student/Lecturer selector, Year pills, and Program pills appear and save properly.
- [ ] **Profile Display & Editing (`/profile`)**:
  - Verify the top profile badge displays `Student • Year X` or `Lecturer`.
  - Open the **Edit Profile** bottom sheet: verify students can update their Year of Study and Program with the native pill buttons.

---

## 3. 🚗 Driver Dashboard & Passenger Recognition
- [ ] **Lecturer Trip Recognition**:
  - Log in as a Lecturer and request a ride.
  - Log in as an online Driver nearby.
  - Check the incoming ride card and active passenger list: verify the amber **"Lecturer"** badge is clearly visible next to the passenger's name.
- [ ] **Student Trip Recognition**:
  - Request a ride as a Student and verify clean standard display.
- [ ] **Core Lifecycle Verification**:
  - Run a complete ride lifecycle: `Request` ➝ `Driver Accept` ➝ `Driver Arrived` ➝ `Start Trip` ➝ `Complete Trip` ➝ `Rating`.
  - Confirm optimistic zero-flicker UI locks, passenger cards, and polyline routes render with 100% stability.

---

## 4. 🛠️ Admin Dashboard Management
- [ ] **User Directory (`/admin/users`)**:
  - Filter by **Role** (`Lecturer`, `Student`, `Driver`, `All Roles`).
  - Filter by **Year of Study** (`1st Year` through `5th Year`).
  - Filter by **Archived Status** (`Active Accounts`, `Archived Only`, `All Statuses`).
  - Test the **Quick Role Switcher** in user table rows and inside the User Inspection drawer to convert between `Student`, `Lecturer`, and `Driver`.
  - Click **"Archive Graduated"** batch button and confirm graduated students are soft-archived.
- [ ] **Lecturers Directory (`/admin/lecturers`)**:
  - Open **Lecturers** from the admin sidebar navigation (Graduation cap icon).
  - Search lecturer records by name/email/phone.
  - Open lecturer details to inspect their ride history and trip statistics.
  - Test role conversion and status toggle buttons.
- [ ] **Fixed Route Management (`/admin/routes`)**:
  - Inspect existing fixed route campus corridors.
  - Verify fare calculations and active route toggle.
- [ ] **Platform Settings & Pricing (`/admin/settings`)**:
  - Inspect global pricing parameters (base fares, per-km rates, shared/private margins).
  - Verify settings update and save properly.

---

## 5. 🔔 Segmented & Individual Push Notifications (`/admin/notifications`)
- [ ] **Audience Segmentation**:
  - **All Active Users**: Broadcasts to all non-archived users.
  - **Students Only**: Broadcasts specifically to student accounts.
  - **Lecturers Only**: Broadcasts specifically to academic staff accounts.
  - **Drivers Only**: Broadcasts specifically to driver accounts.
  - **By Year of Study**: Select *By Year of Study*, pick a year (e.g. `3rd Year`), and verify targeted delivery.
- [ ] **Specific User Direct Push**:
  - Select *Specific Individual User*.
  - Search by name, email, or phone number with live debounced search.
  - Select the user card and send a direct push message.
