# JRide Raylight Motion Video — Master Scene & Script Blueprint

**Project Name**: JaeyRide Fresh  
**Project ID**: `f47edeae-a995-42ad-8b37-34aacdcffe2d`  
**Raylight Editor URL**: [https://www.raylight.app/editor/f47edeae-a995-42ad-8b37-34aacdcffe2d](https://www.raylight.app/editor/f47edeae-a995-42ad-8b37-34aacdcffe2d)  
**Target Format**: WhatsApp Status / Mobile Story (`9:16 Portrait` & `16:9 Landscape` master)  
**Estimated Total Runtime**: ~1m 15s – 1m 20s (75,000ms – 80,000ms)  
**Color Palette**: Sapphire Blue (`#3B82F6`), Deep Indigo (`#6366F1`), Electric Violet (`#8B5CF6`), Obsidian Black (`#000000`/`#050505`), White (`#FFFFFF`).  
**Typography**: `Manrope` (Body/Copy) + `Montserrat` (Headlines/Weights 500-600) + `Inter` (UI Indicators).

---

## 🎬 Master Timeline Overview

```
[0:00 - 0:08] SCENE 1: THE HOOK (Original Typewriter + Cursor Stagger)
[0:08 - 0:18] SCENE 2: THE REVEAL & "ONE PLATFORM" (Landing Page Hero)
[0:18 - 0:34] SCENE 3: THE 3-STAGE INTERACTIVE SEQUENCE (Home -> Route -> Fares)
[0:34 - 0:52] SCENE 4: MATCHING & REAL-TIME DISPATCH (Finding Driver)
[0:52 - 1:08] SCENE 5: LIVE GPS ARRIVAL & VEHICLE DETAILS (Active Ride)
[1:08 - 1:20] SCENE 6: BRAND OUTRO & CTA (Official Black JRide Logo Reveal)
```

---

## 📍 Scene-by-Scene Specifications

### 📍 Scene 1: The Frustration Hook (0.0s – 8.0s)
* **Animation Mechanics**: `Typewriter` stagger character entrance + vertical blinking cursor line &rarr; subtle camera push-in.
* **On-Screen Text**:
  * Line 1: *"It's frustrating to walk to the taxi rank..."*
  * Line 2 (Transition): *"Searching for "* + **`rides`** (Sapphire Blue `#3B82F6`)
* **Voice-Over (VO)**:
  > *"It’s frustrating to walk all the way to the taxi rank, especially under the hot sun when you’re rushing to class."*

---

### 📍 Scene 2: Brand Reveal & "One Platform" (8.0s – 18.0s)
* **Animation Mechanics**: `Focus` entrance zoom &rarr; `Blur` angle rotation &rarr; 3D tilted card glides in with original resting tilt from the right.
* **On-Screen Text**:
  * Word 1: *"Meet"*
  * Word 2: **"JRide"** (or **"Jaey Ride"**) (Violet/Blue `#3B82F6`)
  * Hero Subtitle: *"One Platform"* (Montserrat 600, Black `#000000`)
* **Visual Asset**: **The Landing Page** (`01_landing.png` – *"From Campus To Your Door Step / Get Started"*).
* **Voice-Over (VO)**:
  > *"Meet JRide. The smart campus ride platform that puts effortless transportation right in your hands."*

---

### 📍 Scene 3: The 3-Stage Interactive Indicator Sequence (18.0s – 34.0s)
* **Animation Mechanics**: The 3D phone stays anchored on the left/center, while the right-side list items light up with the **animated indicator pointer stepping down sequentially**:
  1. **Pointer on Item 1 (18s – 23s)**:
     * Right Column: `Home Icon` + **"Request"** (Scale pop 1.2x &rarr; 1.0x, Sapphire Blue `#3B82F6`).
     * 3D Phone Screen: Swaps to `02_request_home.jpg` (*"Hello Anti! Where Would You Like To Go?"*).
  2. **Pointer steps to Item 2 (23s – 28s)**:
     * Right Column: `Pin Icon` + **"Set Route"** (Deep Indigo `#6366F1`).
     * 3D Phone Screen: Transitions smoothly to `03_pickup.jpg` &rarr; `04_destination.jpg` (*Kanchibiya Hostel to Kobil Kabwe*).
  3. **Pointer steps to Item 3 (28s – 34s)**:
     * Right Column: `Discount Tag Icon` + **"Smart Fares"** (Electric Violet `#8B5CF6`).
     * 3D Phone Screen: Transitions to `05_confirm_fare.jpg` (*Save 71% Shared Fare - K83.72*).
* **Voice-Over (VO)**:
  > *"Simply tap to request, set your pickup anywhere on campus, drop your destination, and choose transparent fares with up to 71% savings on shared rides."*

---

### 📍 Scene 4: Instant Driver Matching (34.0s – 52.0s)
* **Animation Mechanics**: Smooth card transition + radar glow pulse on top status pill.
* **On-Screen Text**:
  * Top Badge: **"Instant Dispatch"**
  * Subtitle: *"Matched with verified student drivers nearby."*
* **Visual Asset**: `06_finding_driver.jpg` with the live green pill (*"Ride requested! Finding a driver..."*) and dynamic route radar.
* **Voice-Over (VO)**:
  > *"With instant matching, you are connected directly with verified drivers already on campus in seconds—no waiting, no guesswork."*

---

### 📍 Scene 5: Live GPS Arrival & Capacity (52.0s – 1:08s)
* **Animation Mechanics**: 3D perspective glide + driver details banner zoom.
* **On-Screen Text**:
  * Top Badge: **"Live Turn-by-Turn GPS"**
  * Subtitle: *"Track your car right to your doorstep."*
* **Visual Asset**: `07_active_ride.jpg` showing the vehicle approaching Kanchibiya Hostel, vehicle model, plate number (*"Purple Toyota Vitz • AG4690"*), and passenger capacity.
* **Voice-Over (VO)**:
  > *"Track your driver in real-time with live GPS turn-by-turn routing and see exact vehicle details the moment they arrive at your pickup."*

---

### 📍 Scene 6: Brand Outro & Call to Action (1:08s – 1:20s)
* **Animation Mechanics**: Clean `Wipe` transition &rarr; Centered floating brand emblem with soft shadow depth.
* **Visual Asset**: `jride_text_black.png` (official clean black text logo from `frontend/public/assets/images/jride_text_black.png`) centered on crisp white canvas.
* **On-Screen Text**:
  * **"JRIDE"**
  * *"From Campus To Your Doorstep."*
  * Button: **"Get Started on JRide"**
* **Voice-Over (VO)**:
  > *"Fast, affordable, and safe campus rides. Download JRide and get moving today."*

---

## 📁 Required Assets Manifest

| File | Source / Location | Purpose in Story |
| :--- | :--- | :--- |
| `01_landing.png` | `raylight_assets/01_landing.png` | Scene 2: Reveal & "One Platform" Hero card |
| `02_request_home.jpg` | `raylight_assets/02_request_home.jpg` | Scene 3: Item 1 "Request" Home screen |
| `03_pickup.jpg` | `raylight_assets/03_pickup.jpg` | Scene 3: Item 2 "Set Route" Pickup selection |
| `04_destination.jpg` | `raylight_assets/04_destination.jpg` | Scene 3: Item 2 "Set Route" Destination drop |
| `05_confirm_fare.jpg` | `raylight_assets/05_confirm_fare.jpg` | Scene 3: Item 3 "Smart Fares" Fare options & discount |
| `06_finding_driver.jpg` | `raylight_assets/06_finding_driver.jpg` | Scene 4: Instant Dispatch & Driver Search |
| `07_active_ride.jpg` | `raylight_assets/07_active_ride.jpg` | Scene 5: Live GPS Route, Plate No & Arrival |
| `jride_text_black.png` | `raylight_assets/jride_text_black.png` | Scene 6: Final Brand Emblem & CTA |
