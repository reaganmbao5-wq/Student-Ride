# Implementation Plan - Unified Driver Registration

## Return to "Direct Driver Redirect"
The user wants new drivers to register and immediately be redirected to the Driver Dashboard (Pending State), skipping the intermediate "Student" state and the extra "Register as Driver" page navigation.

## Proposed Changes

### 1. Update `AuthContext.js`
Create a new atomic function `signupDriver` that:
1.  Calls `/auth/register` (creates user).
2.  **Immediately** sets the Axios Authorization header (bypassing the `useEffect` lag).
3.  Calls `/drivers/register` (creates driver profile).
4.  Updates global state (`user`, `token`, `driverProfile`).

This ensures that the driver profile is created *in the same session* as the user creation, preventing "zombie" accounts if the user drops off between steps.

### 2. Update `AuthPage.jsx`
-   **UI Expansion**: When "Register as Driver" is toggled ON:
    -   Reveal Vehicle Information fields (Type, Model, Color, Plate) *below* the password fields.
-   **Logic Update**:
    -   If `isDriver` is checked:
        -   Validate vehicle fields.
        -   Call `auth.signupDriver(userData, vehicleData)`.
        -   Navigate directly to `/driver`.
    -   If `isDriver` is unchecked:
        -   Call `auth.register(...)` (existing logic).
        -   Navigate to `/dashboard`.

### 3. Verification Plan

#### Automated Verification
-   **Browser Test**:
    -   Navigate to `/`.
    -   Select "Sign Up".
    -   Toggle "Register as Driver".
    -   Fill complete form (User + Vehicle).
    -   Submit.
    -   **Expect**: Direct redirect to `/driver` showing "Pending Approval" (Yellow Alert).
    -   **Expect**: No intermediate logic or page loads.

#### Manual Verification
-   User can try registering a new driver account (`driver2@test.com`) and confirm they land on the pending screen immediately.

## UI Cleanup (Addendum)
**Goal**: Fix layout issues on mobile screens for the Admin User List and Driver Registration Form.

**Changes**:
1.  **Admin User List (`AdminUsersPage.jsx`)**:
    -   Added `min-w-0` to the text container to enable truncation.
    -   Added `truncate` to Name and Email text.
    -   Ensures text doesn't overflow horizontally on small screens.
2.  **Driver Registration Form (`AuthPage.jsx`)**:
    -   Shortened placeholders to "Model", "Color", "Plate Number" to prevent cutoff in 2-column mobile grids.
