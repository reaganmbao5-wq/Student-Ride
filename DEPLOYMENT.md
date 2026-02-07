# Student Ride-Hailing PWA Deployment Guide

## 1. Prerequisites

### Backend
*   **Python**: Version 3.9 or higher.
*   **PIP**: Python package installer.
*   **MongoDB**: An ACTIVE connection string (Local or Atlas).

### Frontend
*   **Node.js**: Version 16 or higher.
*   **NPM**: Node package manager.

## 2. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
MONGO_URL=mongodb://localhost:27017/ or your_atlas_connection_string
DB_NAME=student_ride
JWT_SECRET=your_secure_secret_key_here
PORT=8000
```

Create a `.env` file in the `frontend/` directory (for build time):

```env
REACT_APP_BACKEND_URL=http://localhost:8000
# For production, point to your production backend domain
```

## 3. Backend Deployment

1.  Navigate to `backend/`.
2.  Create virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run key generator (if needed for secret):
    ```python
    import secrets; print(secrets.token_hex(32))
    ```
5.  Start the server:
    ```bash
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
    ```
    *Remove `--reload` for production.*

## 4. Frontend Deployment

1.  Navigate to `frontend/`.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build for production:
    ```bash
    npm run build
    ```
    This creates a `build/` directory with static files.
4.  Serve the static files using a web server (Nginx, Apache, or a static host like Netlify/Vercel).
    *   **Netlify/Vercel**: Just connect your repo and set build command to `npm run build` and publish dir to `build`.
    *   **Nginx**: Point root to the `build/` folder and ensure all routes fall back to `index.html` (SPA routing).

## 5. MongoDB Setup

*   **Collections** will be auto-created on first use, but for Admin Destinations, you must log in as an Admin to create them initially via the UI.
*   **First Admin**: The system detects the email `Reaganmbao5@gmail.com` as Super Admin automatically during registration. Register with this email to get full access.

## 6. Next Steps (Phase 2)

*   **Google Maps Integration**:
    *   Obtain Google Maps API Key (Maps JS, Places, Directions, Distance Matrix).
    *   Replace `MapPlaceholder.jsx` with real Google Maps components.
    *   Enable billing on Google Cloud Platform.
*   **Live GPS Tracking**: Implementation of WebSocket location broadcasting is currently basic; enhance with Kalman filters for smoothness.
*   **Payment Gateway**: Integrate Airtel/MTN Money API.
