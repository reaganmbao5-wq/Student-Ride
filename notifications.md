# 🔔 Student-Ride (Mulu Rides) — Complete Notification & Alert Catalog

This document is the definitive master audit of **every single notification, push alert, OS system notification, audio chime, vibration pattern, passenger briefing, and toast message** across the entire application ecosystem.

---

## 📑 Table of Contents
1. [📱 Push Notifications (FCM Native & WebPush)](#1--push-notifications-fcm-native--webpush)
2. [🔊 OS System Notifications & Audio / Vibration Engine](#2--os-system-notifications--audio--vibration-engine)
3. [⚡ Real-Time WebSocket Alerts & Dynamic Briefings](#3--real-time-websocket-alerts--dynamic-briefings)
4. [🛡️ Admin Notifications & System Broadcasts](#4--admin-notifications--system-broadcasts)
5. [🍞 Master In-App Toast Catalog (By Page & Role)](#5--master-in-app-toast-catalog-by-page--role)
   - [A. Authentication & Onboarding](#a-authentication--onboarding)
   - [B. Student Dashboard & Booking Flow](#b-student-dashboard--booking-flow)
   - [C. Driver Dashboard & Active Ride Lifecycle](#c-driver-dashboard--active-ride-lifecycle)
   - [D. Profile & Preferences](#d-profile--preferences)
   - [E. Chat & Messaging](#e-chat--messaging)
   - [F. Bug Reports & Ratings](#f-bug-reports--ratings)
   - [G. Admin Management & Control Operations](#g-admin-management--control-operations)

---

## 1. 📱 Push Notifications (FCM Native & WebPush)

These notifications are dispatched from the backend (`NotificationService`) to mobile devices (Firebase Cloud Messaging) and desktop web browsers (Web Push / Service Worker) even when the app is minimized or the screen is locked.

| Trigger Event | Target Audience | Title | Body Message | URL / Action | Vibration Signature |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Driver Accepts Ride** | Student (Passenger) | `Ride Accepted` / `🚗 Driver On The Way!` | `[Driver Name] is on the way!` | `/ride/[ride_id]` | `[0, 300, 150, 300]` (Double-pulse) |
| **Driver Arrives at Pickup** | Student (Passenger) | `🚨 DRIVER HAS ARRIVED!` | `Your driver is waiting at your pickup location!` | `/ride/[ride_id]` | `[0, 600, 150, 600, 150, 900]` (High-priority triple burst) |
| **New Ride Available** | Driver (Fleet) | `⚡ NEW RIDE REQUEST!` | `New ride available near [Pickup Location]. Tap to accept.` | `/driver` | `[0, 500, 150, 500, 150, 800]` (High-intensity request buzz) |
| **Ride Completed** | Student (Passenger) | `🎉 Arrived at Destination!` | `Your ride is complete. Thank you for riding with Mulu!` | `/ride/[ride_id]` | `[0, 150, 100, 150, 100, 400]` (Triumph rhythm) |
| **Ride Cancelled** | Student or Driver | `❌ Ride Cancelled` | `[Cancellation Reason / 'The ride was cancelled.']` | `/` or `/driver` | `[0, 400, 100, 400]` (Warning pulse) |
| **Admin Broadcast** | All Users / Students / Drivers | `[Admin Defined Title]` | `[Admin Defined Message Body]` | `[Custom URL or /]` | Default system pulse |
| **Emergency SOS Alert** | All Admins | `🚨 EMERGENCY ALERT` | `Student [Name] triggered an emergency alert during ride [Ride ID]` | `/admin` | `[0, 800, 200, 800, 200, 1000]` (Urgent alarm) |

---

## 2. 🔊 OS System Notifications & Audio / Vibration Engine

Handled by `SystemNotificationService.js` and `haptics.js` to provide multi-sensory feedback (System Notification Banner + Web Audio Synthesizer + Custom Vibration Pattern).

| System Event | Banner Title | Banner Content | Audio Synthesizer Tone | Hardware Vibration |
| :--- | :--- | :--- | :--- | :--- |
| `driver_accepted` | `🚗 Driver On The Way!` | `[Driver Name] accepted your ride ([Vehicle Specs]).` | Upward harmonic sweep (523.25 Hz $\rightarrow$ 659.25 Hz) | `[0, 300, 150, 300]` ms |
| `driver_arrived` | `🚨 DRIVER HAS ARRIVED!` | `[Driver Name] is waiting at your pickup location!` | High-awareness double chime (880 Hz $\rightarrow$ 1174 Hz) | `[0, 600, 150, 600, 150, 900]` ms |
| `ride_started` | `🏁 Ride Started` | `You are on your way to the destination.` | Upward triangle chime (523.25 Hz $\rightarrow$ 659.25 Hz) | `[0, 200, 100, 200]` ms |
| `ride_completed` | `🎉 Arrived at Destination!` | `Your ride is complete. Thank you for riding with Mulu!` | Triumph major chord chime (523.25 Hz $\rightarrow$ 659.25 Hz $\rightarrow$ 783.99 Hz) | `[0, 150, 100, 150, 100, 400]` ms |
| `new_ride_request` | `⚡ NEW RIDE REQUEST!` | `New ride available near [Pickup Location]. Tap to accept.` | Double attention pulse | `[0, 500, 150, 500, 150, 800]` ms |
| `ride_cancelled` | `❌ Ride Cancelled` | `[Reason / 'The ride was cancelled']` | Descending caution tone | `[0, 400, 100, 400]` ms |

---

## 3. ⚡ Real-Time WebSocket Alerts & Dynamic Briefings

Dispatched instantly through persistent WebSockets (`/ws/{user_id}`) during live ride lifecycle execution.

### A. Live Passenger Briefing Cards & Rotating Sub-alerts
*Generated deterministically by `trip_rebuilder.py` and rendered at the top of the passenger active ride view:*

| Engine State (`X.3`) | Primary Briefing Text | Pinned Behavior | Sub-Carousel Messages (Rotates every 6s) |
| :--- | :--- | :--- | :--- |
| `DRIVER_ARRIVED_MY_PICKUP` | **"Driver has arrived at your pickup!"** | 📌 **Pinned** (Locked top priority) | *None (Locked)* |
| `DRIVER_ARRIVED_MY_DROPOFF` | **"Driver has arrived at your destination!"** | 📌 **Pinned** (Locked top priority) | *None (Locked)* |
| `HEADING_TO_MY_PICKUP` | **"Driver is approaching your pickup point."** | Dynamic | `["You are the next stop.", "Driver is approaching your pickup point."]` |
| `HEADING_TO_MY_DROPOFF` | **"Heading to your destination."** | Dynamic | `["You are the next stop.", "Heading to your destination."]` |
| `DRIVER_EN_ROUTE_OTHER_PICKUP`| **"Driver is approaching another pickup."** | Dynamic | `["[N] stops remaining before your pickup.", "Driver is approaching another pickup.", "Shared Ride"]` |
| `DRIVER_ARRIVED_OTHER_PICKUP` | **"Driver is picking up another student."** | Dynamic | `["[N] stops remaining before your pickup.", "Driver is picking up another student.", "Shared Ride"]` |
| `DRIVER_EN_ROUTE_OTHER_DROPOFF`| **"Driver is on the way to another student's destination."** | Dynamic | `["[N] stops remaining before your destination.", "Driver is on the way to another student's destination.", "Shared Ride"]` |
| `DRIVER_ARRIVED_OTHER_DROPOFF` | **"Driver is dropping off another student."** | Dynamic | `["[N] stops remaining before your destination.", "Driver is dropping off another student.", "Shared Ride"]` |

### B. Live WebSocket Event Payloads
- `driver_location`: Real-time GPS coordinate update of the assigned driver.
- `passenger_briefing_update`: Synchronizes route stops, intermediate markers, and current ETAs.
- `route_queue_update`: Updates driver navigation queue and sequential stops.
- `new_message`: Incoming chat message from the driver or student.
- `emergency_alert`: SOS broadcast to platform administrators.

---

## 4. 🛡️ Admin Notifications & System Broadcasts

| Action / Channel | Target | Trigger Condition | Display Message |
| :--- | :--- | :--- | :--- |
| **Broadcast Dispatch** | All / Students / Drivers | Admin sends broadcast from Dashboard | `Broadcast delivered to [N] active devices` *(Toast + Push)* |
| **Broadcast Validation** | Admin UI | Form submitted with empty title/body | `Title and message are required` *(Toast)* |
| **Broadcast Failure** | Admin UI | Network or backend error | `Failed to send broadcast` *(Toast)* |
| **Emergency Audit** | Admin UI | Student taps SOS emergency button | Red pulsing badge + `Emergency alert sent to admins.` |

---

## 5. 🍞 Master In-App Toast Catalog (By Page & Role)

Below is the exhaustive index of all `toast.success`, `toast.error`, `toast.info`, and `toast.warning` notifications across every screen.

### A. Authentication & Onboarding
*File: `frontend/src/pages/AuthPage.jsx` & `CompleteProfilePage.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.error` | `"You must agree to the Terms of Service and Privacy Policy"` | Unchecked terms box during registration |
| `toast.error` | `"Passwords do not match"` | Password and confirm password mismatch |
| `toast.error` | `"Please upload your driver profile photo"` | Driver signs up without selecting an avatar |
| `toast.success` | `"Driver account created! Waiting for approval."` | Successful driver registration |
| `toast.success` | `"Account created successfully!"` | Successful student registration |
| `toast.success` | `"Welcome back, [Name]!"` | Successful login |
| `toast.error` | `"Google authentication failed or cancelled"` | User cancels Google OAuth or token failure |
| `toast.error` | `"Please enter your phone number"` | Empty phone number during profile completion |
| `toast.success` | `"Welcome to Jaey Ride! 🎉"` | Google user finishes setting up required profile info |

---

### B. Student Dashboard & Booking Flow
*Files: `frontend/src/pages/StudentDashboard.jsx` & `RideRequestPage.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.success` | `"Ride requested! Finding a driver..."` | Student submits ride request |
| `toast.error` | `"Failed to request ride"` / `[Backend Detail]` | API error during ride request creation |
| `toast.success` | `"Ride cancelled"` | Student cancels pending / unaccepted ride |
| `toast.error` | `"Failed to cancel ride"` | API error when cancelling ride |
| `toast.error` | `"Emergency alert sent to admins."` | Student taps SOS panic button |
| `toast.success` | `"Ride record deleted from history"` | Student swipes to delete past completed trip |
| `toast.error` | `"Failed to delete ride"` | Error deleting trip from user history |
| `toast.success` | `"Rating submitted successfully"` | Student submits driver star rating & review |

---

### C. Driver Dashboard & Active Ride Lifecycle
*File: `frontend/src/pages/DriverDashboard.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.success` | `"Ride accepted!"` | Driver accepts a private ride request |
| `toast.error` | `"Failed to accept ride"` / `[Backend Detail]` | Error when accepting private ride |
| `toast.success` | `"Shared ride accepted!"` | Driver accepts an overlapping shared ride |
| `toast.success` | `"Passenger notified of your arrival"` | Driver taps "I Have Arrived" button |
| `toast.success` | `"Ride started"` | Driver taps "Start Trip" button after passenger boards |
| `toast.success` | `"Ride completed!"` | Driver taps "Complete Ride" button at destination |
| `toast.success` | `"Fare: K[Amount]"` | Displays completed fare calculation breakdown |
| `toast.info` | `"Ride cancelled"` | Driver manually cancels an active trip |
| `toast.error` | `"Failed to cancel ride"` | Error cancelling trip from driver console |
| `toast.error` | `"Student cancelled the ride"` | Real-time WebSocket alert when student cancels |
| `toast.success` | `"You received a [N]-star rating!"` | Real-time alert when student rates the completed trip |
| `toast.error` | `"Your account is pending approval"` | Driver tries going online before admin verification |
| `toast.success` | `"You are now online"` / `"You are now offline"` | Driver toggles available/offline status switch |
| `toast.error` | `"Failed to toggle status"` | Error updating driver online/offline availability |
| `toast.info` | `"Simulation Mode ON: Python script can now control location safely."` | Driver activates GPS simulator mode |
| `toast.error` | `"File too large. Max 2MB allowed."` | Driver uploads verification document $>2$ MB |
| `toast.success` | `"[Document Type] uploaded successfully"` | Driver uploads license or vehicle inspection photo |
| `toast.error` | `"Upload failed"` / `[Backend Detail]` | Document upload failure |

---

### D. Profile & Preferences
*File: `frontend/src/pages/ProfilePage.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.success` | `"Map Theme set to [Auto / Light Mode / Night Dark Mode]"` | User changes map visual style preference |
| `toast.info` | `"Location turned OFF"` | User disables device location tracking in profile |
| `toast.success` | `"Location turned ON"` | User enables device location tracking in profile |
| `toast.success` | `"Profile picture ready to save"` | User selects and crops a new profile photo |
| `toast.error` | `"Name is required"` | User attempts to save an empty name |
| `toast.success` | `"Profile updated successfully!"` | User saves updated name and avatar |
| `toast.error` | `"Failed to update profile"` | API error updating profile data |
| `toast.info` | `"Notifications Turned OFF"` | User disables push notifications toggle |
| `toast.success` | `"Notifications Turned ON"` | User enables push notifications toggle |
| `toast.success` | `"App Vibrations Turned ON"` | User enables custom haptic feedback toggle |
| `toast.info` | `"App Vibrations Turned OFF"` | User disables custom haptic feedback toggle |
| `toast.success` | `"Account deleted successfully"` | User confirms account deletion |
| `toast.error` | `"Failed to delete account"` | Error deleting user account |

---

### E. Chat & Messaging
*File: `frontend/src/pages/ChatPage.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.error` | `"Failed to send message"` | Network or server error sending in-ride chat message |

---

### F. Bug Reports & Ratings
*Files: `frontend/src/components/common/ReportBugModal.jsx` & `RatingModal.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.success` | `"Thank you for reporting! We will get it fixed as soon as possible."` | User successfully submits a bug report |
| `toast.error` | `"Failed to submit report. Please try again."` | Error submitting bug report |
| `toast.error` | `"Please select a rating"` | User clicks submit on rating modal without selecting stars |
| `toast.error` | `"Failed to submit rating"` | Error submitting rating feedback |

---

### G. Admin Management & Control Operations
*Files: `AdminDashboard.jsx`, `AdminUsersPage.jsx`, `AdminDriversPage.jsx`, `AdminRidesPage.jsx`, `AdminSettingsPage.jsx`, `AdminBugReportsPage.jsx`, `FixedRouteManager.jsx`, `PricingGlobalSettings.jsx`*

| Type | Exact Message Text | Trigger Condition |
| :--- | :--- | :--- |
| `toast.error` | `"Failed to load users"` | Error loading user directory |
| `toast.success` | `"User details updated successfully"` | Admin edits user profile (name, email, phone, password) |
| `toast.error` | `"Failed to update user details"` | Error updating user profile |
| `toast.success` | `"Ride record deleted"` | Admin deletes an invalid/test ride from history |
| `toast.error` | `"Failed to delete ride record"` | Error deleting ride record |
| `toast.success` | `"Role switched to [STUDENT / DRIVER] successfully"` | Admin converts account role |
| `toast.error` | `"Failed to switch user role"` | Error converting account role |
| `toast.success` | `"User [Name] activated"` | Admin unsuspends user account |
| `toast.info` | `"User [Name] suspended"` | Admin suspends user account |
| `toast.error` | `"Failed to update user status"` | Error toggling suspension status |
| `toast.success` | `"User [Name] deleted"` | Admin permanently deletes user account |
| `toast.success` | `"Admin [Name] deleted"` | Super Admin deletes admin account |
| `toast.error` | `"Failed to delete user"` | Error deleting account |
| `toast.success` | `"Admin created successfully"` | Super Admin creates new admin account |
| `toast.error` | `"Failed to create admin"` | Error creating admin account |
| `toast.error` | `"Failed to load drivers"` | Error loading driver directory |
| `toast.success` | `"Driver approved successfully"` | Admin approves driver application |
| `toast.error` | `"Failed to approve driver"` | Error approving driver |
| `toast.info` | `"Driver suspended"` | Admin suspends driver account |
| `toast.error` | `"Failed to suspend driver"` | Error suspending driver |
| `toast.success` | `"Successfully cleared K[Amount] commission debt"` | Admin settles driver commission wallet |
| `toast.error` | `"Failed to settle commission"` | Error clearing driver wallet |
| `toast.success` | `"Driver information updated successfully"` | Admin edits driver vehicle specs |
| `toast.error` | `"Failed to update driver details"` | Error saving driver specs |
| `toast.error` | `"Failed to load rides"` | Error loading admin ride audit page |
| `toast.success` | `"Settings saved successfully"` | Admin updates system configuration |
| `toast.error` | `"Failed to save settings"` | Error saving system settings |
| `toast.error` | `"Failed to load bug reports & system diagnostics"` | Error fetching bug report queue |
| `toast.success` | `"Report status updated to [Status]"` | Admin changes status of bug report (open/in_progress/resolved) |
| `toast.error` | `"Failed to update status"` | Error updating bug report status |
| `toast.error` | `"Failed to load pricing settings"` | Error loading global pricing configuration |
| `toast.success` | `"Pricing settings updated successfully"` | Admin saves base fare, per-km rates, or commission % |
| `toast.error` | `"Failed to update settings"` | Error saving pricing configuration |
| `toast.error` | `"Failed to load routes"` | Error fetching fixed route list |
| `toast.success` | `"Pickup set: [Location Name]"` | Admin selects fixed route pickup point |
| `toast.success` | `"Dropoff set: [Location Name]"` | Admin selects fixed route dropoff point |
| `toast.error` | `"Please select both Pickup and Dropoff locations"` | Validation error creating fixed route |
| `toast.success` | `"Fixed route created successfully"` | Admin saves new predefined fixed route |
| `toast.error` | `"Failed to create route"` | Error saving fixed route |
| `toast.success` | `"Route deleted"` | Admin deletes fixed route |
| `toast.error` | `"Failed to delete route"` | Error deleting fixed route |
