# MuluRides - Student Transportation Platform PRD

## Project Overview
**Name:** MuluRides  
**Type:** Progressive Web App (PWA)  
**Target:** Mulungushi University, Kabwe, Zambia  
**Date Created:** January 22, 2026  

## Original Problem Statement
Build a production-ready MVP for a student-focused ride-hailing and delivery platform designed for Mulungushi University. The system must work on all devices (Android, iOS, PC/Laptop) using a Progressive Web App (PWA) approach.

## User Personas
1. **Students (Riders)** - University students needing transportation
2. **Drivers** - Student drivers or local drivers earning income
3. **Admin** - Platform administrators managing operations
4. **Super Admin** - Platform owner (Reaganmbao5@gmail.com) with full control

## Core Requirements (Static)
- Dark theme (#0B0B0B) with Gold accents (#D4AF37)
- Glassmorphism UI design
- Mobile-first responsive design
- PWA installable on all devices
- Cash-based payments (no payment gateway integration)
- Commission-based monetization (15% default)

## What's Been Implemented ✅

### Backend (FastAPI + MongoDB)
- [x] User authentication (JWT)
- [x] Role-based access control (student, driver, admin, super_admin)
- [x] Auto Super Admin detection by email
- [x] Driver registration and approval flow
- [x] Ride request, accept, arrive, start, complete, cancel
- [x] Real-time WebSocket for GPS tracking
- [x] In-app chat messaging
- [x] Fare calculation with configurable rates
- [x] Platform settings (commission, base fare, per km/min rates)
- [x] Admin statistics and management endpoints
- [x] Admin logging for audit trail

### Frontend (React + Tailwind CSS)
- [x] Landing page with PWA install banner
- [x] Authentication (login/register) with driver toggle
- [x] Student Dashboard with active ride view
- [x] Ride request flow with Leaflet map
- [x] Driver Dashboard with online toggle
- [x] Driver earnings page
- [x] Admin Dashboard with platform overview
- [x] Admin Users management (suspend/activate)
- [x] Admin Drivers management (approve/suspend)
- [x] Admin Rides view
- [x] Admin Settings (commission rate) - Super Admin only
- [x] In-app chat between rider and driver
- [x] Profile page
- [x] Ride history for students and drivers
- [x] Click-to-call functionality

### Design System
- [x] Custom fonts (Outfit headings, DM Sans body)
- [x] Glassmorphism cards and inputs
- [x] Gold accent buttons with glow effects
- [x] Animated components
- [x] Dark themed map tiles

## Prioritized Backlog

### P0 (Critical) - Completed
- ✅ Core ride booking flow
- ✅ Real-time GPS tracking
- ✅ Admin commission controls
- ✅ Driver approval system

### P1 (High Priority) - Future
- [ ] Push notifications for ride updates
- [ ] Service worker for offline support
- [ ] Enhanced PWA caching
- [ ] Driver document upload for verification
- [ ] SMS notifications via Twilio

### P2 (Medium Priority) - Future
- [ ] Driver subscription plans
- [ ] Ride scheduling (advance booking)
- [ ] Multiple stops support
- [ ] Promo codes and discounts
- [ ] Driver leaderboard

### P3 (Nice to Have) - Future
- [ ] Mobile money integration (MTN, Airtel)
- [ ] Surge pricing
- [ ] Multi-city support
- [ ] In-app wallet
- [ ] Native app wrappers (Android/iOS)

## Technical Architecture
```
Frontend (React PWA)
    ↓ HTTPS
Backend (FastAPI)
    ↓ MongoDB Driver
Database (MongoDB)
    
WebSocket for real-time:
- GPS location updates
- Ride status changes
- Chat messages
```

## API Endpoints Summary
- `/api/auth/*` - Authentication
- `/api/drivers/*` - Driver management
- `/api/rides/*` - Ride operations
- `/api/chat/*` - Messaging
- `/api/admin/*` - Admin functions
- `/ws/{user_id}` - WebSocket connection

## Configuration
- **Super Admin Email:** Reaganmbao5@gmail.com
- **Default Commission:** 15%
- **Base Fare:** K10
- **Per KM Rate:** K5
- **Per Minute Rate:** K1

## Next Tasks
1. Add push notifications for ride updates
2. Implement service worker for offline mode
3. Add driver document verification
4. Integrate SMS notifications
5. Performance optimization and caching
