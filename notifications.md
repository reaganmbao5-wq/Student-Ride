# 🔔 J Ride — Master Notification Specification & Catalog

This document is the authoritative specification and audit catalog of all notifications, channels, sounds, vibrations, briefings, and toasts across **J Ride**.

---

## 1. 🏗️ Notification Channel Architecture

Every push notification and OS system notification belongs to exactly one channel.

| Channel ID | Purpose | Priority | User Can Disable? | Sound Allowed? |
| :--- | :--- | :--- | :--- | :--- |
| `ride_updates` | Ride lifecycle events (accepted, arrived, started, completed, cancelled) | High | No (while a ride is active) | Only for `driver_arrived` and `ride_cancelled` |
| `chat_messages` | In-ride chat messages | Normal | Yes | No (vibration only) |
| `account_security` | Profile changes, login/device alerts | Normal | Yes | No |
| `admin_broadcast` | Admin-sent announcements | Normal | Yes | No |
| `emergency_sos` | SOS/emergency alerts to admins | Critical | No | Yes — distinct alarm-style tone |

> [!NOTE]
> On Android/PWA, channels are registered at install/startup with immutable importance levels. `ride_updates` and `emergency_sos` bypass Do Not Disturb where the platform allows priority overrides (`IMPORTANCE_HIGH`).

---

## 2. 📳 Sound & Vibration Rules

Sound is reserved strictly for moments requiring immediate physical attention. Routine informational events are silent or vibration-only.

| Event | Sound? | Hardware Vibration | Rationale |
| :--- | :--- | :--- | :--- |
| `driver_accepted` | No | Single short pulse (`[0, 200]`) | Informational — user is watching the map |
| `driver_arrived` | **Yes** — short single tone (<200ms) | Double pulse (`[0, 300, 150, 300]`) | Needs immediate physical attention to meet driver |
| `ride_started` | No | Single short pulse (`[0, 200]`) | Informational confirmation |
| `ride_completed` | No | Short pulse (`[0, 150, 100, 150]`) | Positive completion, not urgent |
| `ride_cancelled` | **Yes** — brief neutral tone | Single pulse (`[0, 300]`) | Needs attention but not alarming |
| `new_ride_request` (driver) | Optional short tone (driver toggle) | Single pulse (`[0, 300]`) | Drivers receive many; avoids auditory fatigue |
| `chat_message` | No | Single short pulse (`[0, 150]`) | Matches standard messaging conventions |
| `emergency_sos` | **Yes** — alarm-style tone | Sustained pattern (`[0, 500, 200, 500, 200, 500]`) | Unmistakably distinct from all other events |

---

## 3. 📱 Push Notification Catalog (FCM & Web Push)

All push notifications use data-only payloads for complete client control over channels, styling, and vibration patterns.

| Trigger Event | Channel | Title | Body Message | Action URL |
| :--- | :--- | :--- | :--- | :--- |
| **Driver accepts ride** | `ride_updates` | `Driver on the way` | `[Driver Name] accepted your ride and is heading your way.` | `/ride/[ride_id]` |
| **Driver arrives at pickup** | `ride_updates` | `Driver has arrived` | `[Driver Name] is waiting at your pickup location.` | `/ride/[ride_id]` |
| **New ride request (targeted)** | `ride_updates` | `New ride request` | `Pickup near [Pickup Location]. Tap to view.` | `/driver` |
| **Ride completed** | `ride_updates` | `Ride complete` | `You've arrived at your destination.` | `/ride/[ride_id]` |
| **Ride cancelled** | `ride_updates` | `Ride cancelled` | `[Cancellation reason, or "The ride was cancelled."]` | `/` or `/driver` |
| **Admin broadcast** | `admin_broadcast` | `[Admin title]` | `[Admin message body]` | `[Custom URL or /]` |
| **Emergency SOS** | `emergency_sos` | `Emergency alert` | `[Student Name] triggered an emergency alert during a ride.` | `/admin` |
| **New chat message** | `chat_messages` | `[Sender Name]` | `[Message preview]` | `/ride/[ride_id]/chat` |

---

## 4. ⚡ Real-Time WebSocket Dynamic Briefings

Dispatched through active WebSocket connections during active rides. Rendered as passenger briefing cards in clean sentence case:

- **State 1: En Route to Pickup**
  - Card 1: `Heading to your pickup point` $\rightarrow$ `[Driver Name] is driving a [Color] [Model]`
  - Card 2: `Route status` $\rightarrow$ `Live route mapped to your location`
- **State 2: Driver Arrived**
  - Card 1: `Your driver is waiting` $\rightarrow$ `Please proceed to the pickup location`
  - Card 2: `Vehicle details` $\rightarrow$ `Plate: [Plate Number]`
- **State 3: On Trip**
  - Card 1: `On your way to [Destination]` $\rightarrow$ `Direct route in progress`
  - Card 2: `Safety active` $\rightarrow$ `Live tracking active`

---

## 5. 🛡️ Admin Notifications & Alerts

| Trigger | In-App / Toast Message | Status |
| :--- | :--- | :--- |
| **Broadcast Sent** | `Broadcast delivered to [N] active devices` | `toast.success` |
| **Validation Error** | `Title and message are required` | `toast.error` |
| **Send Failure** | `Failed to send broadcast` | `toast.error` |
| **SOS Received** | Red badge + `Emergency alert sent to admins.` | `toast.success` |

---

## 6. 🍞 Master In-App Toast Catalog

### A. Authentication & Onboarding
- `Welcome to J Ride! 🎉` (`toast.success`)
- `Verification code sent to your email.` (`toast.info`)
- `Account successfully registered.` (`toast.success`)
- `Password reset link sent.` (`toast.success`)
- `Invalid credentials. Please check your email or password.` (`toast.error`)

### B. Student Dashboard & Booking Flow
- `Ride requested successfully. Searching for nearby drivers...` (`toast.success`)
- `No drivers available in your area right now.` (`toast.info`)
- `Driver on the way` (`toast.info`)
- `Driver has arrived` (`toast.success`)
- `Ride cancelled.` (`toast.info`)
- `Emergency alert sent to admins.` (`toast.success` — *Resolved mismatch*)
- `Thank you for rating your ride!` (`toast.success`)

### C. Driver Dashboard
- `You are now Online. Ready to receive ride requests.` (`toast.success`)
- `You are now Offline.` (`toast.info`)
- `Ride accepted! Heading to pickup.` (`toast.success`)
- `Arrived at pickup location.` (`toast.success`)
- `Ride started. Driving to destination.` (`toast.success`)
- `Ride completed. Earnings updated.` (`toast.success`)
- `Trip cancelled.` (`toast.info`)
- `Settlement submitted for verification.` (`toast.success`)

### D. Profile & Preferences
- `Profile updated successfully.` (`toast.success`)
- `Password changed successfully.` (`toast.success`)
- `Push notifications enabled.` (`toast.success`)
- `Push notifications disabled.` (`toast.info`)
- `App vibrations enabled.` (`toast.success`)
- `App vibrations disabled.` (`toast.info`)
- `Bug report submitted. Thank you for your feedback!` (`toast.success`)

### E. In-Ride Chat
- `Message sent.` (`toast.success`)
- `Failed to send message. Please check connection.` (`toast.error`)

---

## 7. 🎯 Driver Request Matching & Filtering (Backend)

Targeted ride dispatch query in `broadcast_to_nearby_drivers`:
1. `is_online == True` and `is_approved == True` and `wallet_status != RESTRICTED`
2. Driver is eligible and not currently on a conflicting private ride
3. Driver coordinates are within **5.0 km** of the student's pickup point
4. Dispatches both real-time WebSocket event and targeted FCM push notification. Zero blast/spam to non-eligible users.
