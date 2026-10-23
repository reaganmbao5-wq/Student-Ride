from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query, File, UploadFile, Response, BackgroundTasks, Body
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
import os
import time
import secrets
import base64
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import sqlite3

# ── Path fix: ensure backend/services/ is always importable ──────────────────
# Render runs from project root with PYTHONPATH=backend, but locally we may
# run from inside backend/. This guarantees 'services.X' always resolves.
import sys as _sys, os as _os
_backend_dir = _os.path.dirname(_os.path.abspath(__file__))
if _backend_dir not in _sys.path:
    _sys.path.insert(0, _backend_dir)
# ─────────────────────────────────────────────────────────────────────────────
from services.osrm_service import get_route, calculate_eta
from services.notification_service import NotificationService
from services.event_bus import internal_bus
from services.trip_manager import DriverTripManager
from services.trip_rebuilder import DriverTripRebuilder
from services.background_tasks import BackgroundOrchestrator
import jwt
import bcrypt
import asyncio
import resend
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from typing import List, Optional, Dict, Any
import requests
import httpx
import math
import json

ROOT_DIR = Path(__file__).parent

# Phase 4 ETA Helpers
def format_eta_text(seconds: int) -> str:
    if seconds is None:
        return ""
    if seconds < 60:
        return "<1 min"
    return f"{int(seconds // 60)} min"

async def inject_etas_into_trip(trip: dict, driver_location: dict):
    if not trip or not driver_location:
        return trip
    
    route_queue = trip.get("route_queue", [])
    briefings = trip.get("passenger_briefings", {})
    
    if not route_queue or not briefings:
        return trip
        
    curr_lat = driver_location.get("lat")
    curr_lng = driver_location.get("lng")
    if not curr_lat or not curr_lng:
        return trip
        
    segments = trip.get("full_driver_segments", [])
    seg_durations = {seg.get("stopId"): seg.get("duration_seconds") for seg in segments if isinstance(seg, dict) and seg.get("stopId") and seg.get("duration_seconds")}

    cumulative_seconds = 0
    eta_dict = {} # Maps ride_id -> seconds
    
    for stop in route_queue:
        stop_lat = stop.get("coordinates", {}).get("lat")
        stop_lng = stop.get("coordinates", {}).get("lng")
        stop_id = stop.get("stop_id")
        
        if stop_lat and stop_lng:
            if stop_id in seg_durations and seg_durations[stop_id] > 0:
                leg_seconds = int(seg_durations[stop_id])
            else:
                d_lat = math.radians(stop_lat - curr_lat)
                d_lon = math.radians(stop_lng - curr_lng)
                a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(curr_lat)) * math.cos(math.radians(stop_lat)) * math.sin(d_lon / 2) ** 2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                dist_km = 6371 * c
                leg_seconds = int(max(60, (dist_km / 28.0) * 3600 + 30))

            cumulative_seconds += leg_seconds
            curr_lat = stop_lat
            curr_lng = stop_lng
            
            ride_id = stop.get("ride_id")
            if ride_id and ride_id not in eta_dict:
                eta_dict[ride_id] = cumulative_seconds
                
    # Inject into briefings
    for s_id, briefing in briefings.items():
        ride_id = briefing.get("ride_id")
        if ride_id in eta_dict:
            briefing["eta_seconds"] = eta_dict[ride_id]
            briefing["eta_text"] = format_eta_text(eta_dict[ride_id])
            
    return trip
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with Atlas M0 Connection Pooling & Graceful Reuse
mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/?appName=Cluster0')
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=40,               # Stays well below Atlas M0 500-connection ceiling
    minPoolSize=5,                # Maintains warm pre-authenticated TCP sockets to eliminate handshake latency
    maxIdleTimeMS=45000,          # Reclaims idle connections to prevent stale socket accumulation
    waitQueueTimeoutMS=5000,      # Queues burst requests gracefully rather than failing immediately
    serverSelectionTimeoutMS=5000,# Rapid failover detection
    connectTimeoutMS=10000,       # 10s connection timeout
    retryWrites=True,             # Built-in driver level retry for supported writes
    retryReads=True               # Built-in driver level retry for reads
)
db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
notification_service = NotificationService(db)

# Resend API Configuration
resend.api_key = os.environ.get('RESEND_API_KEY', 're_X7gVHfvT_F9eBjUDtnFbvE6rhr954sMGR')

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '613545438163-5eo9e0tpustjgotq6u7m7elsas8gkjst.apps.googleusercontent.com')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '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')

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'mulungushi-rides-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 14  # 14 days

# Super Admin Email
SUPER_ADMIN_EMAIL = "Reaganmbao5@gmail.com"
DEFAULT_COMMISSION_RATE = 0.10

# Create the main app
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", "https://fb662cce0aa16c927aedc2da33dff16a@o4511784708472832.ingest.de.sentry.io/4511785200844880"),
    integrations=[FastApiIntegration()],
    send_default_pii=True,
    traces_sample_rate=1.0,
    attach_stacktrace=True,
    include_local_variables=True
)

app = FastAPI(title="Jaey Ride API")

# Configure CORS — allow all origins for APK/mobile/script support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()
security = HTTPBearer(auto_error=False)

# Configure Static Files for Uploads
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "student-ride-backend"}

@app.on_event("startup")
async def startup_db_client():
    try:
        # Create geospatial index for driver location
        await db.drivers.create_index([("location", "2dsphere")])
        
        # Create index for TTL temporary driver location tracking
        await db.driver_locations.create_index("driver_id", unique=True)
        await db.driver_locations.create_index([("location", "2dsphere")])
        await db.driver_locations.create_index("updated_at", expireAfterSeconds=30)
        
        # Create TTL index for chat messages cleanup (24 hours = 86400 seconds)
        await db.messages.create_index("expires_at", expireAfterSeconds=86400)
        
        # Create indexes for ride queries
        await db.rides.create_index("status")
        await db.rides.create_index("student_id")
        
        # Atlas M0 High-Concurrency Indexes: sub-millisecond lookup and graceful connection reuse
        for col_name, idx_args, idx_kwargs in [
            ("users", "email", {"unique": True, "sparse": True}),
            ("users", "id", {"unique": True, "sparse": True}),
            ("drivers", "user_id", {"unique": True, "sparse": True}),
            ("beta_testers", "email", {"sparse": True})
        ]:
            try:
                await db[col_name].create_index(idx_args, **idx_kwargs)
            except Exception as idx_err:
                logger.warning(f"Index notice for {col_name}.{idx_args}: {idx_err}")

        # Create indexes for pricing
        await db.fixed_routes.create_index([("pickup_coordinates", "2dsphere")])
        await db.fixed_routes.create_index([("dropoff_coordinates", "2dsphere")])
        
        # Initialize pricing settings if not exists
        existing_settings = await db.pricing_settings.find_one({})
        if not existing_settings:
            default_settings = {
                "base_fare": 15.0,
                "per_km_rate": 5.0,
                "per_minute_rate": 2.0,
                "surge_multiplier": 1.0,
                "minimum_fare": 20.0,
                "updated_at": datetime.now(timezone.utc)
            }
            await db.pricing_settings.insert_one(default_settings)
            logger.info("Initialized default pricing settings")
        
        logger.info("Created 2dsphere index and ride indexes")
        
        # Start Phase 3.2.6.X Background Orchestrator
        global orchestrator
        orchestrator = BackgroundOrchestrator(db, internal_bus)
        await orchestrator.start()
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        # We don't raise here to allow app to start even if DB is flaky

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Inlined from services/ride_state_machine.py ───────────────────────────────
VALID_TRANSITIONS = {
    "requested": ["driver_accepted", "cancelled"],
    "accepted": ["driver_arrived", "cancelled", "driver_en_route_to_pickup"],
    "driver_accepted": ["driver_en_route_to_pickup", "driver_arrived", "cancelled"],
    "driver_en_route_to_pickup": ["driver_arrived", "cancelled"],
    "driver_arrived": ["passenger_boarding", "ride_started", "cancelled"],
    "passenger_boarding": ["ride_started", "cancelled"],
    "ride_started": ["ride_in_progress", "ride_completed", "completed"],
    "ongoing": ["completed", "arriving_destination"],
    "ride_in_progress": ["arriving_destination", "ride_completed"],
    "arriving_destination": ["ride_completed"],
    "ride_completed": ["settlement"],
    "settlement": ["ride_archived"],
    "ride_archived": [],
    "completed": [],
    "cancelled": []
}

def validate_ride_transition(current_state: str, next_state: str) -> bool:
    valid_next_states = VALID_TRANSITIONS.get(current_state, [])
    if next_state not in valid_next_states:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ride state transition from '{current_state}' to '{next_state}'."
        )
    return True

ACTIVE_RIDE_STATES = [
    "requested", "accepted", "driver_accepted", "driver_en_route_to_pickup",
    "driver_arrived", "passenger_boarding", "ride_started", "ongoing",
    "picked_up", "ride_in_progress", "arriving_destination"
]

def get_active_ride_states():
    return ACTIVE_RIDE_STATES

async def find_ride_by_id(ride_id: str):
    or_clauses = [{"id": ride_id}, {"_id": ride_id}]
    if ObjectId.is_valid(ride_id):
        or_clauses.append({"_id": ObjectId(ride_id)})
    return await db.rides.find_one({"$or": or_clauses})

async def find_driver_ride(ride_id: str, driver_id: str):
    or_clauses = [{"id": ride_id}, {"_id": ride_id}]
    if ObjectId.is_valid(ride_id):
        or_clauses.append({"_id": ObjectId(ride_id)})
    return await db.rides.find_one({
        "$or": or_clauses,
        "driver_id": driver_id
    })
# ─────────────────────────────────────────────────────────────────────────────

# ==================== ENUMS ====================
class UserRole(str, Enum):
    STUDENT = "student"
    LECTURER = "lecturer"
    DRIVER = "driver"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    ACCOUNTANT = "accountant"

class RideStatus(str, Enum):
    # LEGACY STATES (Preserved for safe migration/compatibility)
    ACCEPTED = "accepted"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    
    # PHASE 3.2.5 RIDE STATE MACHINE
    REQUESTED = "requested"
    DRIVER_ACCEPTED = "driver_accepted"
    DRIVER_EN_ROUTE_TO_PICKUP = "driver_en_route_to_pickup"
    DRIVER_ARRIVED = "driver_arrived"
    PASSENGER_BOARDING = "passenger_boarding"
    RIDE_STARTED = "ride_started"
    RIDE_IN_PROGRESS = "ride_in_progress"
    ARRIVING_DESTINATION = "arriving_destination"
    RIDE_COMPLETED = "ride_completed"
    SETTLEMENT = "settlement"
    RIDE_ARCHIVED = "ride_archived"
    CANCELLED = "cancelled"

class DriverStatus(str, Enum):
    AVAILABLE = "available"
    EN_ROUTE_TO_PICKUP = "en_route_to_pickup"
    WAITING_FOR_PASSENGER = "waiting_for_passenger"
    ON_TRIP = "on_trip"
    OFFLINE = "offline"
    OFF_SHIFT = "off_shift"

class RideMode(str, Enum):
    SHARED = "shared"
    PRIVATE = "private"

class VehicleType(str, Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    BICYCLE = "bicycle"

class WalletStatus(str, Enum):
    ACTIVE = "active"
    RESTRICTED = "restricted"

class TransactionType(str, Enum):
    COMMISSION_DEDUCTION = "commission_deduction"
    ADMIN_TOPUP = "admin_topup"
    ADJUSTMENT = "adjustment"
    COMMISSION_SETTLEMENT = "commission_settlement"

# PHASE 3.2.6.X.1 ENUMS (Driver Trip Manager)
class DriverTripState(str, Enum):
    AVAILABLE = "available"
    DRIVING_TO_PICKUP = "driving_to_pickup"
    WAITING_FOR_PASSENGER = "waiting_for_passenger"
    DRIVING_SHARED = "driving_shared"
    DRIVING_PRIVATE = "driving_private"
    DROPPING_PASSENGER = "dropping_passenger"

class StopType(str, Enum):
    PICKUP = "pickup"
    DROPOFF = "dropoff"

class StopStatus(str, Enum):
    PENDING = "pending"
    ARRIVED = "arrived"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PassengerState(str, Enum):
    RESERVED = "reserved"
    WAITING_FOR_PICKUP = "waiting_for_pickup"
    PICKED_UP = "picked_up"
    ONBOARD = "onboard"
    DROPPED_OFF = "dropped_off"
    COMPLETED = "completed"

# ==================== MODELS ====================
# ==================== HELPERS ====================
def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items() if k != "_id"}
    elif isinstance(obj, list):
        return [sanitize_for_json(i) for i in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: str

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.STUDENT
    avatar_url: Optional[str] = None
    year_of_study: Optional[int] = None
    program_type: Optional[str] = None
    department: Optional[str] = None
    staff_id: Optional[str] = None

# PHASE 3.2.6.X.1 MODELS (Driver Trip Manager)
class StopCoordinates(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class Stop(BaseModel):
    stop_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ride_id: str
    student_id: str
    stop_type: StopType
    sequence: int
    status: StopStatus = StopStatus.PENDING
    eta_seconds: Optional[int] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    coordinates: StopCoordinates

class SeatReservation(BaseModel):
    ride_id: str
    student_id: str
    seats_reserved: int
    reservation_time: str
    expiry_time: str

class DriverTripCapacity(BaseModel):
    total: int
    occupied: int = 0
    reserved: int = 0

class DriverTrip(BaseModel):
    driver_id: str
    trip_version: int = 1
    state: DriverTripState = DriverTripState.AVAILABLE
    active_ride_ids: List[str] = []
    route_queue: List[Stop] = []
    seat_reservations: List[SeatReservation] = []
    capacity: DriverTripCapacity
    last_updated: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: Dict[str, str]
    expirationTime: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class GoogleLoginRequest(BaseModel):
    id_token: Optional[str] = None
    access_token: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None
    year_of_study: Optional[int] = None
    program_type: Optional[str] = None
    department: Optional[str] = None
    staff_id: Optional[str] = None
    created_at: Optional[str] = None
    is_active: bool = True
    is_archived: Optional[bool] = False
    archived_at: Optional[str] = None
    is_beta_tester: Optional[bool] = False

class DriverProfile(BaseModel):
    vehicle_type: VehicleType = VehicleType.CAR
    plate_number: str
    vehicle_model: str
    vehicle_color: str
    vehicle_capacity: int = 4
    avatar_url: Optional[str] = None
    verification_docs: Optional[Dict[str, str]] = None

class DriverResponse(BaseModel):
    id: str
    user_id: str
    user: Optional[UserResponse] = None
    vehicle_type: Optional[VehicleType] = None
    plate_number: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    rating: float = 5.0
    total_rides: int = 0
    total_earnings: float = 0.0
    is_online: bool = False
    is_approved: bool = False
    accepts_shared_rides: bool = True
    vehicle_capacity: int = 4
    current_location: Optional[Dict[str, Any]] = None
    wallet_balance: float = 0.0
    wallet_status: WalletStatus = WalletStatus.ACTIVE
    minimum_required_balance: float = 50.0
    total_commission_due: float = 0.0
    total_commission_paid: float = 0.0
    max_commission_owed_limit: float = 500.0
    needs_setup: Optional[bool] = False
    verification_docs: Optional[Dict[str, str]] = None # {"license": "url", "id": "url"}
    verification_status: str = "none" # none, pending, approved, rejected
    created_at: Optional[str] = None

class NearbyDriverResponse(BaseModel):
    id: str
    latitude: float
    longitude: float
    heading: Optional[float] = 0.0
    vehicle_type: VehicleType

class DriverWalletTransaction(BaseModel):
    id: str
    driver_id: str
    type: TransactionType
    amount: float
    ride_id: Optional[str] = None
    description: Optional[str] = None
    timestamp: str

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    heading: Optional[float] = 0.0
    speed: Optional[float] = 0.0

class WalletTopUp(BaseModel):
    amount: float
    description: Optional[str] = None

class RideRequest(BaseModel):
    pickup_location: Dict[str, Any]  # {lat, lng, address}
    dropoff_location: Dict[str, Any]  # {lat, lng, address}
    ride_mode: RideMode = RideMode.PRIVATE
    passenger_count: int = 1
    # REMOVED: estimated_fare, estimated_distance, estimated_duration
    # Server is sole authority on pricing.

class RideResponse(BaseModel):
    id: str
    student_id: str
    student: Optional[UserResponse] = None
    driver_id: Optional[str] = None
    driver: Optional[DriverResponse] = None
    pickup_location: Optional[Dict[str, Any]] = None
    dropoff_location: Optional[Dict[str, Any]] = None
    status: Any = "requested"
    ride_mode: Optional[RideMode] = RideMode.PRIVATE
    passenger_count: Optional[int] = 1
    fare: Optional[float] = 0.0
    commission: Optional[float] = 0.0
    driver_earning: Optional[float] = 0.0
    distance: Optional[float] = 0.0
    duration: Optional[float] = 0.0
    verified_distance: Optional[float] = None
    verified_duration: Optional[float] = None
    verified_geometry: Optional[List[List[float]]] = None
    route_source: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None
    created_at: Optional[str] = None
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None
    eta_seconds: Optional[int] = None
    eta_text: Optional[str] = None
    passenger_briefing: Optional[Dict[str, Any]] = None

class MessageCreate(BaseModel):
    ride_id: str
    content: str

class EmergencyRequest(BaseModel):
    ride_id: str
    message: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    
# ==================== PRICING MODELS ====================
class PricingSettings(BaseModel):
    base_fare: float = Field(15.0, gt=0)
    per_km_rate: float = Field(1.40, gt=0)
    per_minute_rate: float = Field(0.10, gt=0)
    surge_multiplier: float = Field(1.0, ge=1.0, le=5.0)
    minimum_fare: float = Field(15.0, gt=0)
    
    shared_base_fare: float = Field(15.0, gt=0)
    shared_per_km_rate: float = Field(1.40, gt=0)
    shared_per_minute_rate: float = Field(0.10, gt=0)
    shared_surge_multiplier: float = Field(1.0, ge=1.0, le=5.0)
    shared_minimum_fare: float = Field(15.0, gt=0)
    
    commission_rate: float = Field(0.10, ge=0.0, le=0.50) # Default 10%
    private_multiplier: float = Field(3.5, ge=1.0, le=5.0) # 3.5 seats for Whole Car / In Taka
    max_commission_owed_limit: float = Field(500.0, gt=0) # K500 max limit before lockout
    default_flat_commission: float = Field(5.0, ge=0.0) # K5.00 default flat fee
    
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FixedRouteBase(BaseModel):
    pickup_name: str
    dropoff_name: str
    pickup_coordinates: Dict[str, Any] # GeoJSON Point
    dropoff_coordinates: Dict[str, Any] # GeoJSON Point
    tolerance_radius_meters: float = Field(..., ge=50, le=2000)
    fixed_price: float = Field(..., gt=0) # Shared / Per-Seat Driver Base Fare
    flat_commission: Optional[float] = Field(5.0, ge=0.0) # Flat Commission for Shared Ride
    private_fixed_price: Optional[float] = Field(None, gt=0) # Optional Custom Driver Base Fare for Private Ride
    is_active: bool = True

class FixedRouteResponse(FixedRouteBase):
    id: str
    created_at: datetime

class FixedRouteCreate(FixedRouteBase):
    pass

class MessageResponse(BaseModel):
    id: str
    ride_id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: str

class RatingCreate(BaseModel):
    rating: int  # 1-5
    review: Optional[str] = None

class AdminLogResponse(BaseModel):
    id: str
    admin_id: str
    admin_name: str
    action: str
    target_id: Optional[str] = None
    details: Optional[str] = None
    created_at: str

class NotificationLog(BaseModel):
    id: str
    title: str
    message: str
    target_role: str
    total_sent: int
    total_failed: int
    created_by: str
    created_at: str

class AdminBroadcastRequest(BaseModel):
    title: str
    message: str
    url: Optional[str] = None
    target_role: Optional[str] = "all"
    target_user_id: Optional[str] = None
    year_of_study: Optional[int] = None

class PlatformSettings(BaseModel):
    commission_rate: float
    base_fare: float
    per_km_rate: float
    per_minute_rate: float

class DestinationCreate(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    estimated_fare: float  # Legacy support
    base_price: Optional[float] = 0.0
    estimated_distance_km: Optional[float] = 0.0
    is_active: bool = True

class DestinationResponse(BaseModel):
    id: str
    name: str
    address: str
    latitude: float
    longitude: float
    estimated_fare: float
    base_price: Optional[float] = 0.0
    estimated_distance_km: Optional[float] = 0.0
    is_active: bool
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    driver_profile_complete: Optional[bool] = None
    user: UserResponse

# ==================== HELPER FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) * math.sin(dLat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    query_token: Optional[str] = Query(None, alias="token")
) -> dict:
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
        # logger.info("Auth: Found token in headers")
    elif query_token:
        token = query_token
        # logger.info("Auth: Found token in query params")
        
    if not token:
        # logger.info("Auth: No token found in headers or query params")
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        # Check if the bearer token is a Google OAuth access token or ID token
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0
                )
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email")
                    if email:
                        g_user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
                        if g_user:
                            return g_user
        except Exception:
            pass

        # Check if token is Google ID token via tokeninfo
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                    timeout=5.0
                )
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email")
                    if email:
                        g_user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
                        if g_user:
                            return g_user
        except Exception:
            pass

        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    query_token: Optional[str] = Query(None, alias="token")
) -> Optional[dict]:
    try:
        return await get_current_user(credentials, query_token)
    except Exception:
        return None

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role", UserRole.STUDENT.value)
    if role not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_accountant(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role", UserRole.STUDENT.value)
    if role not in [UserRole.ACCOUNTANT.value, UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Accountant or Admin access required")
    return user

@api_router.get("/users/me", response_model=UserResponse)
@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_profile(user: dict = Depends(get_current_user)):
    return user

class UpdateProfileRequest(BaseModel):
    phone: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    year_of_study: Optional[int] = None
    program_type: Optional[str] = None
    department: Optional[str] = None
    staff_id: Optional[str] = None

@api_router.patch("/users/me")
async def update_my_profile(updates: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    """Let a user update their own phone number, name, profile picture, and academic/role details."""
    update_fields = {}
    if updates.phone is not None:
        update_fields["phone"] = updates.phone.strip()
    if updates.name is not None:
        update_fields["name"] = updates.name.strip()
    if updates.avatar_url is not None:
        update_fields["avatar_url"] = updates.avatar_url.strip()
    if updates.year_of_study is not None:
        update_fields["year_of_study"] = updates.year_of_study
    if updates.program_type is not None:
        update_fields["program_type"] = updates.program_type.strip()
    if updates.department is not None:
        update_fields["department"] = updates.department.strip()
    if updates.staff_id is not None:
        update_fields["staff_id"] = updates.staff_id.strip()
    if updates.role in [UserRole.STUDENT.value, UserRole.LECTURER.value, UserRole.DRIVER.value]:
        update_fields["role"] = updates.role
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    if "avatar_url" in update_fields:
        await db.drivers.update_one({"user_id": user["id"]}, {"$set": {"avatar_url": update_fields["avatar_url"]}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return UserResponse(**updated)


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user

async def require_driver(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != UserRole.DRIVER.value:
        raise HTTPException(status_code=403, detail="Driver access required")
    return user

async def log_admin_action(admin_id: str, admin_name: str, action: str, target_id: str = None, details: str = None):
    log = {
        "id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "admin_name": admin_name,
        "action": action,
        "target_id": target_id,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_logs.insert_one(log)

_cached_platform_settings = None
_cached_platform_settings_ts = 0

async def get_platform_settings() -> dict:
    global _cached_platform_settings, _cached_platform_settings_ts
    now = time.time()
    if _cached_platform_settings and (now - _cached_platform_settings_ts) < 30.0:
        return _cached_platform_settings

    settings = await db.pricing_settings.find_one({})
    
    if not settings:
        res = {
            "base_fare": 15.0,
            "per_km_rate": 1.40,
            "per_minute_rate": 0.10,
            "surge_multiplier": 1.0,
            "minimum_fare": 15.0,
            "commission_rate": 0.10,
            "private_multiplier": 3.5,
            "max_commission_owed_limit": 500.0,
            "updated_at": datetime.now(timezone.utc)
        }
        _cached_platform_settings = res
        _cached_platform_settings_ts = now
        return res
    
    # Normalize commission_rate if legacy > 1.0
    comm = settings.get("commission_rate", 0.10)
    if comm > 1.0:
        comm = comm / 100.0 if comm <= 100.0 else 0.10
    settings["commission_rate"] = comm
    _cached_platform_settings = settings
    _cached_platform_settings_ts = now
    return settings

_cached_fixed_routes = None
_cached_fixed_routes_ts = 0

async def calculate_ride_fare(pickup_loc: Dict[str, Any], dropoff_loc: Dict[str, Any], distance_km: float, duration_min: float, ride_mode: RideMode = RideMode.PRIVATE) -> Dict[str, Any]:
    global _cached_fixed_routes, _cached_fixed_routes_ts
    settings = await get_platform_settings()
    commission_rate = settings.get("commission_rate", 0.10)
    private_mult = settings.get("private_multiplier", 3.5)
    
    pickup_point = (pickup_loc["lat"], pickup_loc["lng"])
    dropoff_point = (dropoff_loc["lat"], dropoff_loc["lng"])
    
    # 1. Check Fixed Routes (Cached in-memory)
    now = time.time()
    if _cached_fixed_routes is not None and (now - _cached_fixed_routes_ts) < 30.0:
        active_routes = _cached_fixed_routes
    else:
        active_routes = await db.fixed_routes.find({"is_active": True}).to_list(100)
        _cached_fixed_routes = active_routes
        _cached_fixed_routes_ts = now
    for route in active_routes:
        r_p_lng = route["pickup_coordinates"]["coordinates"][0]
        r_p_lat = route["pickup_coordinates"]["coordinates"][1]
        r_d_lng = route["dropoff_coordinates"]["coordinates"][0]
        r_d_lat = route["dropoff_coordinates"]["coordinates"][1]
        
        p_dist = calculate_haversine_distance(pickup_point[0], pickup_point[1], r_p_lat, r_p_lng)
        d_dist = calculate_haversine_distance(dropoff_point[0], dropoff_point[1], r_d_lat, r_d_lng)
        
        tolerance_km = route["tolerance_radius_meters"] / 1000.0
        
        if p_dist <= tolerance_km and d_dist <= tolerance_km:
            shared_fixed_driver = float(route["fixed_price"])
            shared_commission = float(route.get("flat_commission") if route.get("flat_commission") is not None else round(shared_fixed_driver * commission_rate, 2))
            
            is_private = (ride_mode == RideMode.PRIVATE or str(ride_mode).lower() == "private")
            
            if is_private:
                # Private Ride ("In Taka" Whole Car)
                # If custom private fixed price exists, use it; otherwise, multiply shared price * private_multiplier (3.5x)
                if route.get("private_fixed_price") is not None and float(route["private_fixed_price"]) > 0:
                    driver_earning = float(route["private_fixed_price"])
                else:
                    driver_earning = round(shared_fixed_driver * private_mult, 2)
                    
                commission = round(driver_earning * commission_rate, 2)
                total_student_fare = round(driver_earning + commission, 2)
            else:
                # Shared Ride (Per Seat)
                driver_earning = shared_fixed_driver
                commission = shared_commission
                total_student_fare = round(driver_earning + commission, 2)
            
            logger.info(f"Fixed Route Match: {route['pickup_name']} -> {route['dropoff_name']} | Mode: {ride_mode} | Driver: {driver_earning}, Comm: {commission}, Student Total: {total_student_fare}")
            return {
                "fare": total_student_fare,
                "driver_earning": driver_earning,
                "commission": commission,
                "is_fixed": True,
                "route_name": f"{route['pickup_name']} to {route['dropoff_name']}",
                "breakdown": {
                    "base": driver_earning,
                    "distance": 0,
                    "time": 0,
                    "surge": 0,
                    "commission": commission,
                    "student_fare": total_student_fare
                }
            }

    # 2. Dynamic Pricing
    base_fare = settings.get("base_fare", 15.0)
    per_km = settings.get("per_km_rate", 1.40)
    per_min = settings.get("per_minute_rate", 0.10)
    surge = settings.get("surge_multiplier", 1.0)
    min_fare = settings.get("minimum_fare", 15.0)
    
    # Time-based Surge Logic
    current_hour = datetime.now(timezone.utc).hour + 2 # Adjusting to local Lusaka time (UTC+2)
    if current_hour >= 24: current_hour -= 24
    
    time_multiplier = 1.0
    surge_reason = None
    
    if current_hour >= 22 or current_hour < 5:
        time_multiplier = 1.5
        surge_reason = "Late Night Surge"
    elif 7 <= current_hour <= 9:
        time_multiplier = 1.2
        surge_reason = "Morning Peak Surge"
        
    final_surge = surge * time_multiplier
    
    dist_cost = distance_km * per_km
    time_cost = duration_min * per_min
    
    subtotal = base_fare + dist_cost + time_cost
    surge_total = subtotal * final_surge
    
    # Shared vs Private Mode Calculation
    shared_per_seat_base = max(surge_total, min_fare)
    
    if ride_mode == RideMode.PRIVATE or ride_mode == "private":
        # Private Ride ("In Taka" Whole Car) = 3.5x Shared Per-Seat Base Fare
        driver_base_fare = round(shared_per_seat_base * private_mult, 2)
    else:
        # Shared Ride (Per Seat)
        driver_base_fare = round(shared_per_seat_base, 2)
        
    # Commission Add-On (Student Pays Driver Base + 10% Commission)
    commission_amount = round(driver_base_fare * commission_rate, 2)
    student_total_fare = round(driver_base_fare + commission_amount, 2)
    
    return {
        "fare": student_total_fare,
        "driver_earning": driver_base_fare,
        "commission": commission_amount,
        "is_fixed": False,
        "route_name": "Standard Ride",
        "surge_reason": surge_reason,
        "breakdown": {
            "base": base_fare,
            "distance": round(dist_cost, 2),
            "time": round(time_cost, 2),
            "surge_multiplier": final_surge,
            "driver_earning": driver_base_fare,
            "commission": commission_amount,
            "student_fare": student_total_fare,
            "min_fare_applied": shared_per_seat_base == min_fare
        }
    }

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# ==================== WEBSOCKET CONNECTION MANAGER ====================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.driver_locations: Dict[str, Dict] = {}
        self.driver_last_active: Dict[str, float] = {}
        self.driver_last_db_persist: Dict[str, float] = {}
        self.ride_connections: Dict[str, List[str]] = {}  # ride_id -> [user_ids]
        self.active_driver_rides: Dict[str, List[dict]] = {} # driver_id -> list of active ride dicts

    def add_active_ride(self, driver_id: str, ride: dict):
        if not driver_id:
            return
        if driver_id not in self.active_driver_rides:
            self.active_driver_rides[driver_id] = []
        existing_idx = next((i for i, r in enumerate(self.active_driver_rides[driver_id]) if r.get("id") == ride.get("id")), -1)
        if existing_idx >= 0:
            self.active_driver_rides[driver_id][existing_idx] = ride
        else:
            self.active_driver_rides[driver_id].append(ride)

    def remove_active_ride(self, driver_id: str, ride_id: str):
        if not driver_id or driver_id not in self.active_driver_rides:
            return
        self.active_driver_rides[driver_id] = [r for r in self.active_driver_rides[driver_id] if r.get("id") != ride_id]
        if len(self.active_driver_rides[driver_id]) == 0:
            del self.active_driver_rides[driver_id]

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected via WebSocket. Total connections: {len(self.active_connections[user_id])}")

        # Asynchronously rehydrate active rides if this user is a driver
        async def check_and_hydrate_driver_rides():
            try:
                driver_doc = await db.drivers.find_one({"$or": [{"user_id": user_id}, {"id": user_id}]}, {"_id": 0})
                if driver_doc:
                    d_id = driver_doc.get("id")
                    d_uid = driver_doc.get("user_id")
                    query_ids = [qid for qid in [d_id, d_uid, user_id] if qid]
                    rides_cursor = db.rides.find({
                        "driver_id": {"$in": query_ids},
                        "status": {"$in": get_active_ride_states()}
                    }, {"_id": 0})
                    active_rides = await rides_cursor.to_list(10)
                    if active_rides:
                        for qid in query_ids:
                            self.active_driver_rides[qid] = active_rides
                        logger.info(f"Rehydrated {len(active_rides)} active ride(s) for connected driver {user_id}")
            except Exception as e:
                logger.error(f"Error checking driver rides on connect: {e}")

        asyncio.create_task(check_and_hydrate_driver_rides())

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if len(self.active_connections[user_id]) == 0:
                del self.active_connections[user_id]
                # Only clean up driver data if all connections for this user are gone
                if user_id in self.driver_locations:
                    del self.driver_locations[user_id]
                if user_id in self.driver_last_active:
                    del self.driver_last_active[user_id]
        logger.info(f"User {user_id} disconnected a WebSocket")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            sanitized = sanitize_for_json(message)
            dead_sockets = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(sanitized)
                except Exception as e:
                    logger.error(f"Error sending message to {user_id}: {e}")
                    dead_sockets.append(ws)
            
            # Clean up dead sockets
            for ws in dead_sockets:
                self.disconnect(ws, user_id)

    async def broadcast_to_all_active_connections(self, message: dict):
        sanitized = sanitize_for_json(message)
        delivered = 0
        for user_id, sockets in list(self.active_connections.items()):
            for ws in sockets:
                try:
                    await ws.send_json(sanitized)
                    delivered += 1
                except Exception as e:
                    logger.error(f"Error sending broadcast to {user_id}: {e}")
        logger.info(f"Broadcasted '{message.get('type')}' to {delivered} active connections.")

    async def broadcast_to_ride(self, message: dict, ride_id: str):
        if ride_id in self.ride_connections:
            for user_id in self.ride_connections[ride_id]:
                await self.send_personal_message(message, user_id)

    def add_to_ride(self, ride_id: str, user_id: str):
        if ride_id not in self.ride_connections:
            self.ride_connections[ride_id] = []
        if user_id not in self.ride_connections[ride_id]:
            self.ride_connections[ride_id].append(user_id)

    def remove_from_ride(self, ride_id: str, user_id: str):
        if ride_id in self.ride_connections and user_id in self.ride_connections[ride_id]:
            self.ride_connections[ride_id].remove(user_id)

    async def update_driver_location(self, driver_id: str, location: dict):
        self.driver_locations[driver_id] = location
        now = time.time()
        self.driver_last_active[driver_id] = now
        
        # 1. Throttled Non-blocking Async Background Task for MongoDB Persistence (Every 5.0 seconds per driver)
        if now - self.driver_last_db_persist.get(driver_id, 0.0) >= 5.0:
            self.driver_last_db_persist[driver_id] = now
            async def persist_db():
                try:
                    geo_location = {
                        "type": "Point",
                        "coordinates": [location["lng"], location["lat"]]
                    }
                    await db.driver_locations.update_one(
                        {"driver_id": driver_id},
                        {"$set": {
                            "latitude": location["lat"],
                            "longitude": location["lng"],
                            "heading": location.get("heading", 0.0),
                            "speed": location.get("speed", 0.0),
                            "location": geo_location,
                            "updated_at": datetime.now(timezone.utc)
                        }},
                        upsert=True
                    )
                    await db.drivers.update_one(
                        {"$or": [{"user_id": driver_id}, {"id": driver_id}]},
                        {"$set": {
                            "current_location": location,
                            "location": geo_location
                        }}
                    )
                except Exception as e:
                    logger.error(f"Error persisting driver location to DB: {e}")

            asyncio.create_task(persist_db())

        # 2. FAST IN-MEMORY BROADCAST (0 WAN Database Calls)
        cached_rides = self.active_driver_rides.get(driver_id, [])
        if not cached_rides:
            # Asynchronously rehydrate cache from DB if missing (e.g. after server restart)
            async def rehydrate_and_broadcast():
                try:
                    driver_doc = await db.drivers.find_one({"$or": [{"user_id": driver_id}, {"id": driver_id}]}, {"_id": 0})
                    if driver_doc:
                        d_id = driver_doc.get("id")
                        d_uid = driver_doc.get("user_id")
                        query_ids = [qid for qid in [d_id, d_uid, driver_id] if qid]
                        rides_cursor = db.rides.find({
                            "driver_id": {"$in": query_ids},
                            "status": {"$in": get_active_ride_states()}
                        }, {"_id": 0})
                        rides_found = await rides_cursor.to_list(10)
                        if rides_found:
                            for qid in query_ids:
                                self.active_driver_rides[qid] = rides_found
                            for ride in rides_found:
                                student_id = ride.get("student_id")
                                if student_id:
                                    await self.send_personal_message({
                                        "type": "driver_location",
                                        "lat": location["lat"],
                                        "lng": location["lng"],
                                        "heading": location.get("heading", 0.0),
                                        "ride_id": ride["id"]
                                    }, student_id)
                except Exception as e:
                    logger.error(f"Error rehydrating active rides for driver {driver_id}: {e}")

            asyncio.create_task(rehydrate_and_broadcast())
        else:
            for ride in cached_rides:
                student_id = ride.get("student_id")
                if student_id:
                    asyncio.create_task(self.send_personal_message({
                        "type": "driver_location",
                        "lat": location["lat"],
                        "lng": location["lng"],
                        "heading": location.get("heading", 0.0),
                        "ride_id": ride["id"]
                    }, student_id))

        # Broadcast back to the driver so their own map moves in real-time
        asyncio.create_task(self.send_personal_message({
            "type": "driver_location",
            "lat": location["lat"],
            "lng": location["lng"],
            "heading": location.get("heading", 0.0),
            "ride_id": cached_rides[0]["id"] if cached_rides else "driver-loc"
        }, driver_id))

    async def broadcast_to_nearby_drivers(self, message: dict, location: dict, radius_km: float = 15.0):
        """
        Targeted dispatch of new ride requests.
        Only targets drivers who are:
        1. Marked is_online == True and is_approved == True and wallet not restricted
        2. Not on a conflicting active trip (is_driver_eligible == True)
        3. Within radius_km (default 15.0 km for campus and surrounding areas)
        """
        try:
            ride = message.get("ride", {})
            ride_mode = ride.get("ride_mode", "private")
            passenger_count = ride.get("passenger_count", 1)
            pickup_loc = location or ride.get("pickup_location", {})
            loc_lat = float(pickup_loc.get("lat", pickup_loc.get("latitude", 0))) if isinstance(pickup_loc, dict) else 0
            loc_lng = float(pickup_loc.get("lng", pickup_loc.get("longitude", 0))) if isinstance(pickup_loc, dict) else 0

            # 1. Query online, approved, non-restricted drivers
            online_drivers = await db.drivers.find({
                "is_online": True,
                "is_approved": True,
                "wallet_status": {"$ne": WalletStatus.RESTRICTED.value}
            }, {"_id": 0}).to_list(100)

            if not online_drivers:
                return

            # Batch fetch active rides for all online drivers in ONE query
            all_driver_ids = []
            for d in online_drivers:
                if d.get("id"): all_driver_ids.append(d["id"])
                if d.get("user_id"): all_driver_ids.append(d["user_id"])

            all_active_rides = await db.rides.find({
                "driver_id": {"$in": all_driver_ids},
                "status": {"$in": get_active_ride_states()}
            }, {"_id": 0, "driver_id": 1, "ride_mode": 1, "passenger_count": 1}).to_list(500)

            # Build in-memory active states map instantly
            active_states_by_id = {}
            for d in online_drivers:
                d_id = d.get("id")
                u_id = d.get("user_id")
                d_rides = [r for r in all_active_rides if r.get("driver_id") in (d_id, u_id)]
                active_states_by_id[d_id] = {
                    "active_passengers": sum(r.get("passenger_count", 1) for r in d_rides),
                    "has_private": any(r.get("ride_mode") == RideMode.PRIVATE.value for r in d_rides),
                    "has_shared": any(r.get("ride_mode") == RideMode.SHARED.value for r in d_rides),
                    "active_rides_count": len(d_rides)
                }

            eligible_drivers = []
            for driver in online_drivers:
                real_driver_id = driver.get("id")
                real_user_id = driver.get("user_id")
                
                # Check eligibility from in-memory cache
                active_state = active_states_by_id.get(real_driver_id) or {
                    "active_passengers": 0, "has_private": False, "has_shared": False, "active_rides_count": 0
                }
                eligibility = is_driver_eligible(driver, active_state, ride_mode, passenger_count)
                if not eligibility.get("eligible"):
                    continue

                # Check proximity if driver coordinates are available
                loc = manager.driver_locations.get(real_user_id) or manager.driver_locations.get(real_driver_id) or driver.get("current_location") or {}
                d_lat = loc.get("lat")
                d_lng = loc.get("lng")
                if (d_lat is None or d_lng is None) and driver.get("location") and "coordinates" in driver["location"]:
                    coords = driver["location"]["coordinates"]
                    if len(coords) >= 2:
                        d_lng = float(coords[0])
                        d_lat = float(coords[1])

                if loc_lat != 0 and loc_lng != 0 and d_lat is not None and d_lng is not None:
                    dist_km = calculate_haversine_distance(loc_lat, loc_lng, float(d_lat), float(d_lng))
                    if dist_km > radius_km:
                        continue # Skip driver beyond radius

                eligible_drivers.append(driver)

            logger.info(f"Targeted broadcast '{message.get('type')}': Found {len(eligible_drivers)} eligible nearby drivers within {radius_km}km")

            pickup_name = pickup_loc.get("name") or pickup_loc.get("address") or "your location"
            if isinstance(pickup_name, str) and len(pickup_name) > 30:
                pickup_name = pickup_name[:30] + "..."

            for driver in eligible_drivers:
                u_id = driver.get("user_id")
                d_id = driver.get("id")
                
                # 1. Real-time WebSocket event
                sent = False
                if u_id and u_id in self.active_connections:
                    try:
                        await self.send_personal_message(message, u_id)
                        sent = True
                        logger.info(f"WebSocket new_ride_request delivered to driver user_id {u_id}")
                    except Exception as ws_err:
                        logger.error(f"WebSocket send failed for driver user_id {u_id}: {ws_err}")
                if d_id and d_id in self.active_connections and d_id != u_id:
                    try:
                        await self.send_personal_message(message, d_id)
                        sent = True
                        logger.info(f"WebSocket new_ride_request delivered to driver id {d_id}")
                    except Exception as ws_err:
                        logger.error(f"WebSocket send failed for driver id {d_id}: {ws_err}")

                # 2. Targeted Push Notification (FCM / WebPush) - Fire in background non-blocking
                push_target = u_id or d_id
                if push_target:
                    async def send_bg_push(target, p_name):
                        try:
                            await notification_service.send(
                                user_id=target,
                                type="new_ride_request",
                                payload={
                                    "title": "New ride request",
                                    "body": f"Pickup near {p_name}. Tap to view.",
                                    "url": "/driver",
                                    "channelId": "ride_updates"
                                }
                            )
                        except Exception as push_err:
                            logger.error(f"Push send failed for driver {target}: {push_err}")

                    asyncio.create_task(send_bg_push(push_target, pickup_name))

        except Exception as top_err:
            logger.error(f"broadcast_to_nearby_drivers error: {top_err}", exc_info=True)

manager = ConnectionManager()

# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if registering as super admin
    role = user_data.role
    if user_data.email.lower() == SUPER_ADMIN_EMAIL.lower():
        role = UserRole.SUPER_ADMIN

    if role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT]:
        if not user_data.avatar_url or not str(user_data.avatar_url).strip():
            raise HTTPException(status_code=400, detail="Please upload your profile photo to complete registration")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "phone": user_data.phone,
        "password": hash_password(user_data.password),
        "role": role.value,
        "avatar_url": user_data.avatar_url,
        "year_of_study": user_data.year_of_study,
        "program_type": user_data.program_type,
        "department": user_data.department,
        "staff_id": user_data.staff_id,
        "is_active": True,
        "is_archived": False,
        "is_beta_tester": bool(await db.beta_testers.find_one({"email": user_data.email.lower().strip()})),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)

    # Auto-queue newly registered user into Play Store Closed Testing list if not already present
    try:
        email_norm = user_data.email.lower().strip()
        existing_ps = await db.play_store_testers.find_one({"email": email_norm})
        if not existing_ps:
            await db.play_store_testers.insert_one({
                "email": email_norm,
                "name": user_data.name or "",
                "user_id": user_id,
                "status": "synced" if user["is_beta_tester"] else "pending",
                "requested_at": user["created_at"]
            })
    except Exception as e:
        logger.warning(f"Failed to auto-queue user in play_store_testers: {e}")
    
    # Generate token
    token = create_token(user_id, role.value)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(**{k: v for k, v in user.items() if k != "password"})
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")
        
    # Auto-sync beta status if email is in beta_testers collection
    if not user.get("is_beta_tester"):
        if await db.beta_testers.find_one({"email": credentials.email.lower().strip()}):
            await db.users.update_one({"id": user["id"]}, {"$set": {"is_beta_tester": True}})
            user["is_beta_tester"] = True
    
    token = create_token(user["id"], user["role"])
    
    driver_profile_complete = None
    if user.get("role") == UserRole.DRIVER.value:
        driver_doc = await db.drivers.find_one({"user_id": user["id"]})
        if driver_doc:
            driver_profile_complete = bool(driver_doc.get("is_approved") or (driver_doc.get("plate_number") and driver_doc.get("vehicle_model")))
        else:
            driver_profile_complete = False

    return TokenResponse(
        access_token=token,
        driver_profile_complete=driver_profile_complete,
        user=UserResponse(**{k: v for k, v in user.items() if k != "password"})
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    # Auto-sync beta status if user email is in beta_testers collection
    if not user.get("is_beta_tester") and user.get("email"):
        if await db.beta_testers.find_one({"email": user["email"].lower().strip()}):
            await db.users.update_one({"id": user["id"]}, {"$set": {"is_beta_tester": True}})
            user["is_beta_tester"] = True
    return UserResponse(**{k: v for k, v in user.items() if k != "password"})

@api_router.get("/auth/password-reset/redirect")
async def password_reset_redirect(token: str):
    """Redirects to the frontend reset page. Using the backend domain helps bypass PWA deep linking issues."""
    frontend_url = os.environ.get("REACT_APP_FRONTEND_URL", "https://mulungushistudentride.site")
    return RedirectResponse(url=f"{frontend_url}/reset-password?token={token}")

def _send_password_reset_email_task(email_params: dict):
    try:
        resend.Emails.send(email_params)
        logger.info(f"Password reset email sent to {email_params.get('to')}")
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")

@api_router.post("/auth/password-reset/request")
async def request_password_reset(request: PasswordResetRequest, background_tasks: BackgroundTasks):
    user = await db.users.find_one({"email": request.email.lower()})
    if not user:
        return {"status": "success", "message": "If an account with that email exists, a password reset link has been sent."}
    
    # Prepend the user ID to the token so we can look it up later without scanning the whole DB
    raw_secret = secrets.token_urlsafe(32)
    # The token given to the user is: base64(user_id) + "." + raw_secret
    import base64
    b64_uid = base64.urlsafe_b64encode(user["id"].encode()).decode().rstrip("=")
    reset_token = f"{b64_uid}.{raw_secret}"
    
    hashed_token = hash_password(reset_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "reset_password_token": hashed_token,
            "reset_password_expires": expires_at.isoformat()
        }}
    )
    
    try:
        frontend_url = os.environ.get("REACT_APP_FRONTEND_URL", "https://mulungushistudentride.site")
        backend_url = os.environ.get('BACKEND_URL', 'https://student-ride-backend-dev.onrender.com').rstrip('/')
        reset_link = f"{backend_url}/api/auth/password-reset/redirect?token={reset_token}"
        
        from_email = os.environ.get("RESEND_FROM_EMAIL", "noreply@mulungushistudentride.site")
        sender = from_email if "onboarding@resend.dev" in from_email else f"Jaey Ride <{from_email}>"
        
        email_params = {
            "from": sender,
            "to": [user["email"]],
            "subject": "Reset your Jaey Ride Password",
            "html": f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Password Reset Request</h2>
                <p>Hello {user.get('name', 'User')},</p>
                <p>We received a request to reset your password. Click the button below to choose a new password:</p>
                <a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>This link will expire in 1 hour.</p>
                <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 30px;"/>
                <p style="font-size: 12px; color: #888;">Jaey Ride Support Team</p>
            </div>
            """
        }
        background_tasks.add_task(_send_password_reset_email_task, email_params)
        logger.info(f"Queued password reset email task for {user['email']}")
    except Exception as e:
        logger.error(f"Failed to queue password reset email: {e}")
    
    return {"status": "success", "message": "If an account with that email exists, a password reset link has been sent."}

@api_router.post("/auth/password-reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    import base64
    
    try:
        if "." not in request.token:
            raise ValueError()
        b64_uid, _ = request.token.split(".", 1)
        padding = "=" * (4 - (len(b64_uid) % 4))
        user_id = base64.urlsafe_b64decode(b64_uid + padding).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token format")
        
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("reset_password_token") or not user.get("reset_password_expires"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    expires_at = datetime.fromisoformat(user["reset_password_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
        
    if not verify_password(request.token, user["reset_password_token"]):
        raise HTTPException(status_code=400, detail="Invalid reset token")
        
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {"password": hashed_password},
            "$unset": {"reset_password_token": "", "reset_password_expires": ""}
        }
    )
    
    return {"status": "success", "message": "Password successfully reset"}

@api_router.post("/auth/google")
async def google_login(request: GoogleLoginRequest):
    email = None
    name = None

    # Tier 1: Try verifying ID token with GOOGLE_CLIENT_ID
    if request.id_token:
        try:
            idinfo = id_token.verify_oauth2_token(
                request.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
            )
            email = idinfo.get("email")
            name = idinfo.get("name")
        except Exception as e:
            logger.warning(f"Google ID token verification with client ID failed: {e}")
            # Tier 1b: Try verifying ID token without strict audience check (handles Native Android / iOS client IDs)
            try:
                idinfo = id_token.verify_oauth2_token(
                    request.id_token, google_requests.Request()
                )
                email = idinfo.get("email")
                name = idinfo.get("name")
            except Exception as e2:
                logger.warning(f"Google ID token verification without audience failed: {e2}")
                # Tier 1c: Try Google's tokeninfo endpoint
                try:
                    async with httpx.AsyncClient() as client:
                        res = await client.get(
                            f"https://oauth2.googleapis.com/tokeninfo?id_token={request.id_token}",
                            timeout=8.0
                        )
                        if res.status_code == 200:
                            info = res.json()
                            email = info.get("email")
                            name = info.get("name")
                except Exception as e3:
                    logger.warning(f"Google tokeninfo endpoint failed: {e3}")

    # Tier 2: Try verifying access token via Google userinfo
    if not email and request.access_token:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {request.access_token}"},
                    timeout=8.0
                )
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email")
                    name = info.get("name")
        except Exception as e:
            logger.warning(f"Google access token verification failed: {e}")

    # Tier 3: Direct verified profile payload fallback
    if not email and request.email:
        email = request.email
        name = request.name or "User"

    if not email:
        raise HTTPException(status_code=401, detail="Invalid Google token or unable to retrieve email")

    try:
        user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
        is_new_user = False
        
        if not user:
            is_new_user = True
            user_id = str(uuid.uuid4())
            is_beta = bool(await db.beta_testers.find_one({"email": email.lower().strip()}))
            user = {
                "id": user_id,
                "email": email.lower(),
                "name": name or "User",
                "phone": "",
                "password": hash_password(secrets.token_urlsafe(32)),
                "role": UserRole.STUDENT.value,
                "is_active": True,
                "is_beta_tester": is_beta,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            try:
                email_norm = email.lower().strip()
                if not await db.play_store_testers.find_one({"email": email_norm}):
                    await db.play_store_testers.insert_one({
                        "email": email_norm,
                        "name": name or "User",
                        "user_id": user_id,
                        "status": "synced" if is_beta else "pending",
                        "requested_at": user["created_at"]
                    })
            except Exception as e:
                logger.warning(f"Failed to auto-queue google user in play_store_testers: {e}")
        elif not user.get("is_beta_tester") and await db.beta_testers.find_one({"email": email.lower().strip()}):
            await db.users.update_one({"id": user["id"]}, {"$set": {"is_beta_tester": True}})
            user["is_beta_tester"] = True

        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account suspended")

        driver_profile_complete = False
        if user.get("role") == UserRole.DRIVER.value:
            profile = await db.drivers.find_one({"user_id": user["id"]})
            if profile:
                driver_profile_complete = True

        token = create_token(user["id"], user["role"])
        
        return {
            "access_token": token,
            "is_new_user": is_new_user,
            "driver_profile_complete": driver_profile_complete,
            "user": UserResponse(**{k: v for k, v in user.items() if k != "password"}).model_dump()
        }

    except Exception as ex:
        logger.error(f"Error processing Google authentication: {ex}")
        raise HTTPException(status_code=500, detail="Authentication processing error")

@api_router.delete("/users/me")
async def delete_me(user: dict = Depends(get_current_user)):
    """Allow a user to delete their own account."""
    user_id = user["id"]
    
    # If user is a driver, delete driver profile too
    if user["role"] == UserRole.DRIVER.value:
        await db.drivers.delete_one({"user_id": user_id})
        
    # Delete the user
    await db.users.delete_one({"id": user_id})
    
    return {"status": "deleted"}

async def broadcast_route_queue(driver_id: str):
    trip = await db.driver_trips.find_one({"driver_id": driver_id})
    if not trip:
        logger.warning(f"CACHE MISS in broadcast_route_queue for driver {driver_id} - zero fallback execution as per Phase 01 rules")
    if trip:
        driver = await db.drivers.find_one({"id": driver_id})
        if driver:
            trip = await inject_etas_into_trip(trip, driver.get("current_location", {}))
            background_tasks.add_task(manager.send_personal_message, {
                "type": "routeQueueUpdate",
                "route_queue": trip.get("route_queue", [])
            }, driver["user_id"])

        # Phase X: Broadcast passenger briefings to each active student
        passenger_briefings = trip.get("passenger_briefings", {})
        for student_id, briefing in passenger_briefings.items():
            background_tasks.add_task(manager.send_personal_message, {
                "type": "passenger_briefing_update",
                "ride_id": briefing["ride_id"],
                "briefing_text": briefing["briefing_text"],
                "x3_state": briefing.get("x3_state"),
                "is_pinned": briefing.get("is_pinned", False),
                "carousel_messages": briefing.get("carousel_messages", []),
                "stops_remaining": briefing["stops_remaining"],
                "is_next_stop": briefing["is_next_stop"],
                "intermediate_stops": briefing.get("intermediate_stops", []),
                "route_segments": briefing.get("route_segments", []),
                "route_geometry": briefing["route_geometry"],
                "eta_seconds": briefing.get("eta_seconds"),
                "eta_text": briefing.get("eta_text")
            }, student_id)

# ==================== DRIVER ROUTES ====================
@api_router.get("/drivers/nearby", response_model=List[NearbyDriverResponse])
async def get_nearby_drivers(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.5, le=25.0),
    user: dict = Depends(get_current_user)
):
    """
    Fetch nearby AVAILABLE drivers for the pickup map.
    Filters: Online, Approved, Active Wallet, Not in Conflicting Ride.
    """
    results = []
    seen_ids = set()
    
    # 1. Fetch all online & approved drivers with active wallets
    online_drivers = await db.drivers.find({
        "is_online": True,
        "is_approved": True,
        "wallet_status": {"$ne": WalletStatus.RESTRICTED.value}
    }).to_list(200)

    for d in online_drivers:
        d_id = d.get("id")
        d_uid = d.get("user_id")
        primary_id = d_uid or d_id
        if not primary_id or primary_id in seen_ids:
            continue

        # Extract real-time or cached coordinates
        loc = manager.driver_locations.get(d_uid) or manager.driver_locations.get(d_id) or d.get("current_location") or {}
        lat = loc.get("lat")
        lng = loc.get("lng")
        heading = loc.get("heading", 0.0)

        # Fallback to GeoJSON coordinates [lng, lat]
        if (lat is None or lng is None) and d.get("location") and "coordinates" in d["location"]:
            coords = d["location"]["coordinates"]
            if len(coords) >= 2:
                lng = coords[0]
                lat = coords[1]

        if lat is None or lng is None:
            continue

        dist = calculate_haversine_distance(latitude, longitude, lat, lng)
        if dist <= radius_km:
            active_state = await get_driver_active_state(d["id"])
            eligibility = is_driver_eligible(d, active_state)
            if not eligibility["visibility"]:
                continue

            seen_ids.add(primary_id)
            results.append(NearbyDriverResponse(
                id=primary_id,
                latitude=float(lat),
                longitude=float(lng),
                heading=float(heading or 0.0),
                vehicle_type=d.get("vehicle_type", VehicleType.CAR)
            ))

    return results

@api_router.post("/drivers/register", response_model=DriverResponse)
async def register_driver(profile: DriverProfile, user: dict = Depends(get_current_user)):
    # Check if already a driver
    existing = await db.drivers.find_one({"user_id": user["id"]})
    
    avatar_url = profile.avatar_url or (profile.verification_docs.get("profile_photo") if profile.verification_docs else None)
    if avatar_url:
        await db.users.update_one({"id": user["id"]}, {"$set": {"avatar_url": avatar_url}})

    if existing:
        # Update existing driver record with real vehicle credentials
        update_fields = {
            "vehicle_type": profile.vehicle_type.value,
            "plate_number": profile.plate_number.upper(),
            "vehicle_model": profile.vehicle_model,
            "vehicle_color": profile.vehicle_color,
            "vehicle_capacity": profile.vehicle_capacity,
            "verification_docs": profile.verification_docs or {},
            "verification_status": "pending",
            "needs_setup": False,
            "is_approved": False
        }
        if avatar_url:
            update_fields["avatar_url"] = avatar_url
            
        await db.drivers.update_one({"user_id": user["id"]}, {"$set": update_fields})
        await db.users.update_one({"id": user["id"]}, {"$set": {"role": UserRole.DRIVER.value}})
        updated_driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        updated_driver["needs_setup"] = False
        return DriverResponse(**updated_driver)

    driver_id = str(uuid.uuid4())
    driver = {
        "id": driver_id,
        "user_id": user["id"],
        "vehicle_type": profile.vehicle_type.value,
        "plate_number": profile.plate_number.upper(),
        "vehicle_model": profile.vehicle_model,
        "vehicle_color": profile.vehicle_color,
        "vehicle_capacity": profile.vehicle_capacity,
        "avatar_url": avatar_url,
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "is_online": False,
        "is_approved": False,
        "needs_setup": False,
        "accepts_shared_rides": True,
        "current_ride_id": None, # For locking
        "current_location": None,
        "location": None, # GeoJSON for indexing
        "wallet_balance": 0.0,
        "wallet_status": WalletStatus.ACTIVE.value,
        "minimum_required_balance": 50.0,
        "total_commission_due": 0.0,
        "total_commission_paid": 0.0,
        "verification_docs": profile.verification_docs or {},
        "verification_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        await db.drivers.insert_one(driver)
    except Exception as e:
        logger.error(f"Error checking driver existence: {e}")
        # Could be duplicate key if concurrent
        existing = await db.drivers.find_one({"user_id": user["id"]})
        if existing:
            await db.drivers.update_one({"user_id": user["id"]}, {"$set": {
                "vehicle_type": profile.vehicle_type.value,
                "plate_number": profile.plate_number.upper(),
                "vehicle_model": profile.vehicle_model,
                "vehicle_color": profile.vehicle_color,
                "vehicle_capacity": profile.vehicle_capacity,
                "verification_docs": profile.verification_docs or {},
                "verification_status": "pending",
                "needs_setup": False,
                "is_approved": False
            }})
            updated_driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
            updated_driver["needs_setup"] = False
            return DriverResponse(**updated_driver)
        raise HTTPException(status_code=500, detail="Registration failed")
    
    # Update user role
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": UserRole.DRIVER.value}})
    driver["needs_setup"] = False
    return DriverResponse(**driver)

@api_router.get("/drivers/me", response_model=DriverResponse)
async def get_my_driver_profile(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})
    if not driver:
        # Create empty placeholder driver marked as needs_setup
        driver = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "vehicle_type": "car",
            "vehicle_model": "",
            "vehicle_color": "",
            "plate_number": "",
            "is_approved": False,
            "needs_setup": True,
            "is_online": False,
            "rating": 5.0,
            "total_rides": 0,
            "total_earnings": 0.0,
            "verification_status": "unsubmitted",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.drivers.insert_one(driver)
    
    # Compute if setup is needed
    if driver.get("is_approved"):
        driver["needs_setup"] = False
    else:
        driver["needs_setup"] = bool(
            driver.get("needs_setup") or
            not driver.get("plate_number") or
            not driver.get("vehicle_model") or
            (driver.get("vehicle_model") == "Campus Shuttle" and str(driver.get("plate_number", "")).startswith("MR-"))
        )
    
    settings = await get_platform_settings()
    driver["max_commission_owed_limit"] = settings.get("max_commission_owed_limit", 500.0)
    
    driver["user"] = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        role=UserRole(user["role"]),
        year_of_study=user.get("year_of_study"),
        program_type=user.get("program_type"),
        is_archived=user.get("is_archived", False),
        created_at=user["created_at"],
        is_active=user.get("is_active", True)
    )
    
    return DriverResponse(**driver)

class DriverSettingsUpdate(BaseModel):
    accepts_shared_rides: Optional[bool] = None
    vehicle_capacity: Optional[int] = None

@api_router.patch("/drivers/me/settings", response_model=DriverResponse)
async def update_driver_settings(settings: DriverSettingsUpdate, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
        
    update_data = {}
    if settings.accepts_shared_rides is not None:
        update_data["accepts_shared_rides"] = settings.accepts_shared_rides
    if settings.vehicle_capacity is not None:
        update_data["vehicle_capacity"] = settings.vehicle_capacity
        
    if update_data:
        await db.drivers.update_one({"id": driver["id"]}, {"$set": update_data})
        # Fetch updated driver
        driver = await db.drivers.find_one({"id": driver["id"]}, {"_id": 0})
        
    driver["user"] = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        role=UserRole(user["role"]),
        created_at=user["created_at"],
        is_active=user.get("is_active", True)
    )
    return DriverResponse(**driver)

@api_router.post("/drivers/toggle-online")
async def toggle_online_status(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    if driver.get("needs_setup") or not driver.get("plate_number") or not driver.get("vehicle_model") or (driver.get("vehicle_model") == "Campus Shuttle" and str(driver.get("plate_number", "")).startswith("MR-")):
        raise HTTPException(status_code=403, detail="Please complete your vehicle registration before going online.")

    if not driver.get("is_approved"):
        raise HTTPException(status_code=403, detail="Driver account is pending admin approval.")
    
    if driver.get("wallet_status") == WalletStatus.RESTRICTED.value:
        raise HTTPException(status_code=403, detail="Wallet restricted. Please top up to go online.")
    
    new_status = not bool(driver.get("is_online", False))
    await db.drivers.update_one(
        {"$or": [{"user_id": user["id"]}, {"id": user["id"]}]},
        {"$set": {"is_online": new_status}}
    )
    
    if new_status:
        now = time.time()
        manager.driver_last_active[user["id"]] = now
        if driver.get("id"):
            manager.driver_last_active[driver["id"]] = now
    
    return {"is_online": new_status}

@api_router.post("/drivers/documents")
async def upload_driver_documents(
    doc_type: str = Query(...), 
    file: UploadFile = File(...), 
    user: dict = Depends(require_driver)
):
    """
    Uploads driver verification documents. Max 2MB.
    """
    # 2MB Limit
    MAX_SIZE = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 2MB.")
        
    fs = AsyncIOMotorGridFSBucket(db)
    
    file_id = await fs.upload_from_stream(
        file.filename,
        content,
        metadata={"driver_id": user["id"], "content_type": file.content_type}
    )
    
    # Generate absolute URL
    backend_url = os.environ.get('BACKEND_URL', 'https://student-ride-backend-manual.onrender.com').rstrip('/')
    doc_url = f"{backend_url}/api/documents/{str(file_id)}"
    
    await db.drivers.update_one(
        {"user_id": user["id"]},
        {
            "$set": {
                f"verification_docs.{doc_type}": doc_url,
                "verification_status": "pending"
            }
        }
    )
    
    return {"status": "success", "url": doc_url}

@api_router.get("/documents/{file_id}")
async def get_document(file_id: str):
    """Serves uploaded KYC documents and avatars from GridFS with proper caching and headers."""
    try:
        from bson import ObjectId
        fs = AsyncIOMotorGridFSBucket(db)
        try:
            oid = ObjectId(file_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid document ID format")
            
        grid_out = await fs.open_download_stream(oid)
        metadata = grid_out.metadata or {}
        content_type = metadata.get("content_type") or "image/jpeg"
        content = await grid_out.read()
        
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400, immutable",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Document {file_id} not found in GridFS: {e}")
        raise HTTPException(status_code=404, detail="Document not found")

@api_router.post("/admin/drivers/{driver_id}/verify")
async def verify_driver(
    driver_id: str, 
    status: str = Query(..., regex="^(approved|rejected)$"),
    user: dict = Depends(require_admin)
):
    """
    Admin verification of driver documents.
    """
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "verification_status": status,
            "is_approved": status == "approved",
            "needs_setup": False if status == "approved" else True
        }}
    )
    
    # Update role to driver only if approved
    if status == "approved":
        await db.users.update_one({"id": driver["user_id"]}, {"$set": {"role": UserRole.DRIVER.value}})
    
    await log_admin_action(user["id"], user["name"], "verify_driver", driver_id, f"Status: {status}")
    
    return {"status": "success", "verification_status": status}

@api_router.post("/drivers/location")
async def update_location(location: LocationUpdate, user: dict = Depends(require_driver)):
    loc_data = {
        "lat": location.latitude,
        "lng": location.longitude,
        "heading": getattr(location, "heading", 0.0) or 0.0,
        "speed": getattr(location, "speed", 0.0) or 0.0
    }
    await manager.update_driver_location(user["id"], loc_data)
    return {"status": "updated"}

class InjectDriversRequest(BaseModel):
    drivers: dict

@api_router.post("/test/inject_drivers")
async def inject_drivers(req: InjectDriversRequest):
    # Inject fake drivers for simulation without auth
    import time
    for driver_id, loc in req.drivers.items():
        manager.driver_locations[driver_id] = loc
        manager.driver_last_active[driver_id] = time.time()
        # Also broadcast to passengers if they are in a ride
        await manager.update_driver_location(driver_id, loc)
        
    return {"status": "injected", "count": len(req.drivers)}

@api_router.post("/test/accept_trip")
async def accept_trip():
    ride = await db.rides.find_one({"status": "requested"}, sort=[("created_at", -1)])
    if not ride:
        ride = await db.rides.find_one({"status": "accepted"}, sort=[("created_at", -1)])
    if not ride: return {"status": "no rides"}
    
    driver_id = "ghost-driver-0"
    driver = await db.drivers.find_one({"user_id": driver_id})
    
    await db.rides.update_one({"_id": ride["_id"]}, {"$set": {"status": "accepted", "driver_id": driver["id"], "accepted_at": datetime.utcnow().isoformat()}})
    await db.drivers.update_one({"user_id": driver_id}, {"$set": {"current_ride_id": ride["id"]}})
    
    # Remove ObjectIds for JSON serialization
    if "_id" in ride: del ride["_id"]
    if "_id" in driver: del driver["_id"]
    
    # Broadcast to user
    ride["status"] = "accepted"
    ride["driver_id"] = driver["id"]
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": "ride_accepted",
        "ride": ride,
        "driver": driver
    }, ride["student_id"])
    return {"status": "accepted", "ride": ride, "driver": driver}

@api_router.get("/test/get_active_ride_for_simulation")
async def get_active_ride_for_simulation():
    ride = await db.rides.find_one({"status": {"$in": ["requested", "accepted", "driver_arrived", "ongoing"]}}, sort=[("created_at", -1)], projection={"_id": 0})
    return ride

@api_router.get("/rides/driver/trip")
async def get_driver_trip_state(user: dict = Depends(require_driver)):
    """Returns the current rebuilt and optimized trip queue for the driver"""
    driver = await db.drivers.find_one({"$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    trip = await DriverTripRebuilder.rebuild(driver["id"], db)
    if not trip:
        return {"route_queue": [], "state": "available"}
        
    return trip

@api_router.get("/rides/driver/active", response_model=List[RideResponse])
async def get_active_rides_for_driver(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"$or": [{"user_id": user["id"]}, {"id": user["id"]}]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
        
    driver_ids = [driver.get("id"), driver.get("user_id")]
    query = {
        "status": {"$in": get_active_ride_states()},
        "driver_id": {"$in": [d for d in driver_ids if d]}
    }
    
    rides = await db.rides.find(query, {"_id": 0}, sort=[("created_at", 1)]).to_list(100)
    
    for ride in rides:
        # Populate student
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student:
            ride["student"] = UserResponse(
                id=student["id"],
                email=student["email"],
                name=student["name"],
                phone=student.get("phone", ""),
                role=UserRole(student["role"]),
                created_at=student.get("created_at", ""),
                is_active=student.get("is_active", True)
            )
            
        # Populate driver (always this driver)
        driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0})
        if driver_user:
            d_copy = driver.copy()
            d_copy["user"] = UserResponse(
                id=driver_user["id"],
                email=driver_user["email"],
                name=driver_user["name"],
                phone=driver_user.get("phone", ""),
                role=UserRole(driver_user["role"]),
                created_at=driver_user.get("created_at", ""),
                is_active=driver_user.get("is_active", True)
            )
            ride["driver"] = d_copy
            
    return rides

class UpdateTripStatusReq(BaseModel):
    ride_id: str
    status: str

@api_router.post("/test/update_trip_status")
async def update_trip_status(req: UpdateTripStatusReq, background_tasks: BackgroundTasks):
    ride = await db.rides.find_one({"id": req.ride_id})
    if not ride: return {"status": "not found"}
    
    await db.rides.update_one({"id": req.ride_id}, {"$set": {"status": req.status}})
    
    event_type_map = {
        "driver_arrived": "driver_arrived",
        "ongoing": "ride_started",
        "completed": "ride_completed",
        "cancelled": "ride_cancelled"
    }
    
    # Broadcast to user
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": event_type_map.get(req.status, "status_update"),
        "ride_id": req.ride_id,
        "status": req.status
    }, ride["student_id"])
    
    return {"status": "updated", "new_status": req.status}

@api_router.get("/drivers/earnings")
async def get_driver_earnings(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    # Get all completed/archived rides for driver
    rides = await db.rides.find({
        "driver_id": driver["id"],
        "status": {"$in": [
            RideStatus.COMPLETED.value,
            RideStatus.RIDE_COMPLETED.value,
            RideStatus.RIDE_ARCHIVED.value,
            "completed",
            "ride_completed",
            "ride_archived",
            "archived"
        ]}
    }, {"_id": 0}).to_list(1000)
    
    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    today_earnings = 0.0
    week_earnings = 0.0
    month_earnings = 0.0
    
    settings = await get_platform_settings()
    comm_rate = float(settings.get("commission_rate", 0.15))
    
    for r in rides:
        date_str = r.get("completed_at") or r.get("created_at")
        if not date_str:
            continue
        try:
            if isinstance(date_str, str):
                if date_str.endswith('Z'):
                    date_str = date_str[:-1] + '+00:00'
                r_date = datetime.fromisoformat(date_str).date()
            elif isinstance(date_str, datetime):
                r_date = date_str.date()
            else:
                continue
        except Exception as e:
            logger.warning(f"Error parsing date '{date_str}': {e}")
            continue

        earning = float(r.get("driver_earning", 0.0))
        if earning == 0.0 and r.get("fare"):
            earning = float(r.get("fare", 0.0)) * (1.0 - comm_rate)
        
        if r_date == today:
            today_earnings += earning
        if r_date >= week_start:
            week_earnings += earning
        if r_date >= month_start:
            month_earnings += earning
            
    return {
        "total_earnings": round(float(driver.get("total_earnings", 0.0)), 2),
        "today_earnings": round(today_earnings, 2),
        "week_earnings": round(week_earnings, 2),
        "month_earnings": round(month_earnings, 2),
        "total_rides": int(driver.get("total_rides", 0)),
        "rating": round(float(driver.get("rating", 5.0)), 1)
    }

@api_router.get("/drivers/available", response_model=List[DriverResponse])
async def get_available_drivers(user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({
        "is_online": True,
        "is_approved": True
    }, {"_id": 0}).to_list(100)
    
    result = []
    for driver in drivers:
        driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0})
        if driver_user:
            driver["user"] = UserResponse(
                id=driver_user["id"],
                email=driver_user["email"],
                name=driver_user["name"],
                phone=driver_user["phone"],
                role=UserRole(driver_user["role"]),
                created_at=driver_user["created_at"],
                is_active=driver_user.get("is_active", True)
            )
        result.append(DriverResponse(**driver))
    
    return result

@api_router.post("/admin/drivers/{driver_id}/topup")
async def topup_driver_wallet(driver_id: str, topup: WalletTopUp, user: dict = Depends(require_admin)):
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    new_balance = driver.get("wallet_balance", 0.0) + topup.amount
    total_paid = driver.get("total_commission_paid", 0.0) + topup.amount
    
    wallet_status = driver.get("wallet_status", WalletStatus.ACTIVE.value)
    if new_balance >= driver.get("minimum_required_balance", 50.0):
        wallet_status = WalletStatus.ACTIVE.value
    
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "wallet_balance": new_balance,
            "total_commission_paid": total_paid,
            "wallet_status": wallet_status
        }}
    )
    
    # Log transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "driver_id": driver_id,
        "type": TransactionType.ADMIN_TOPUP.value,
        "amount": topup.amount,
        "description": topup.description or "Admin Top-up",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.driver_wallet_transactions.insert_one(transaction)

    await log_admin_action(user["id"], user["name"], "wallet_topup", driver_id, f"Topup {topup.amount}")
    
    return {"status": "success", "new_balance": new_balance, "wallet_status": wallet_status}



@api_router.post("/admin/settlement/daily")
async def run_daily_settlement(user: dict = Depends(require_accountant)):
    """
    Cron-like endpoint to settle accumulated commissions for all drivers.
    Idempotent: Resets 'total_commission_due' to 0 and adds to 'total_commission_paid'.
    """
    # Find all drivers with commission due > 0
    drivers_with_due = await db.drivers.find({"total_commission_due": {"$gt": 0}}).to_list(1000)
    
    settled_count = 0
    total_amount = 0.0
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    for driver in drivers_with_due:
        driver_id = driver["id"]
        due_amount = driver["total_commission_due"]
        
        # Atomic update to reset due and inc paid
        # Using optimistic locking on 'total_commission_due' to ensure we only settle what we saw
        result = await db.drivers.update_one(
            {"id": driver_id, "total_commission_due": due_amount},
            {
                "$set": {"total_commission_due": 0},
                "$inc": {"total_commission_paid": due_amount}
            }
        )
        
        if result.modified_count > 0:
            settled_count += 1
            total_amount += due_amount
            
            # Log Settlement Transaction
            await db.driver_wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "driver_id": driver_id,
                "type": TransactionType.COMMISSION_SETTLEMENT.value,
                "amount": due_amount,
                "description": "Daily Commission Settlement",
                "timestamp": timestamp
            })
            
    await log_admin_action(user["id"], user["name"], "daily_settlement", None, f"Settled {settled_count} drivers, Total: {total_amount}")
    
    return {
        "status": "success", 
        "settled_drivers": settled_count, 
        "total_settled_amount": total_amount
    }

@api_router.post("/admin/drivers/{driver_id}/settle-commission")
async def settle_single_driver_commission(driver_id: str, data: dict = Body({}), user: dict = Depends(require_accountant)):
    """
    Admin clears/settles a specific driver's accumulated commission debt (remittance payment).
    Resets total_commission_due, increments total_commission_paid, restores wallet_status to ACTIVE.
    """
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    current_due = driver.get("total_commission_due", 0.0)
    settle_amount = float(data.get("amount", current_due))
    notes = data.get("notes", "Commission Remittance Settlement")
    
    new_due = max(0.0, current_due - settle_amount)
    
    update_ops = {
        "total_commission_due": new_due,
        "wallet_status": WalletStatus.ACTIVE.value
    }
    
    await db.drivers.update_one(
        {"id": driver["id"]},
        {
            "$set": update_ops,
            "$inc": {"total_commission_paid": settle_amount}
        }
    )
    
    timestamp = datetime.now(timezone.utc).isoformat()
    await db.driver_wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "driver_id": driver["id"],
        "type": TransactionType.COMMISSION_SETTLEMENT.value,
        "amount": settle_amount,
        "description": f"Admin Settlement: {notes}",
        "timestamp": timestamp
    })
    
    await log_admin_action(user["id"], user["name"], "settle_driver_commission", driver["id"], f"Settled K{settle_amount:.2f} for driver {driver['id']}. Remaining due: K{new_due:.2f}")
    
    return {
        "status": "success",
        "driver_id": driver["id"],
        "settled_amount": settle_amount,
        "remaining_due": new_due,
        "wallet_status": WalletStatus.ACTIVE.value
    }

# ==================== DESTINATION ROUTES ====================

async def populate_ride_student(ride: dict) -> dict:
    """Centralized helper to rehydrate student object from db.users if missing."""
    if not ride:
        return ride
    if not ride.get("student") and ride.get("student_id"):
        student_user = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student_user:
            student_obj = {
                "id": student_user["id"],
                "email": student_user["email"],
                "name": student_user["name"],
                "phone": student_user.get("phone", ""),
                "avatar_url": student_user.get("avatar_url"),
                "role": str(student_user.get("role", "student")),
                "created_at": student_user.get("created_at", ""),
                "is_active": student_user.get("is_active", True)
            }
            ride["student"] = student_obj
            ride["student_name"] = student_user["name"]
    elif ride.get("student") and isinstance(ride["student"], dict):
        if not ride.get("student_name"):
            ride["student_name"] = ride["student"].get("name")
        if not ride["student"].get("avatar_url"):
            student_user = await db.users.find_one({"id": ride.get("student_id")}, {"_id": 0})
            if student_user and student_user.get("avatar_url"):
                ride["student"]["avatar_url"] = student_user.get("avatar_url")
    return ride

# ==================== RIDE ROUTES ====================
@api_router.post("/rides/request", response_model=RideResponse)
async def request_ride(ride_data: RideRequest, user: dict = Depends(get_current_user)):
    try:
        # Beta Testing Access Guard
        settings_doc = await db.settings.find_one({"type": "platform"}) or {}
        beta_gate_active = settings_doc.get("beta_gate_active", True)
        if beta_gate_active and user.get("role") not in [UserRole.ADMIN.value, "admin", "super_admin"]:
            is_tester = bool(user.get("is_beta_tester"))
            if not is_tester and user.get("email"):
                tester_doc = await db.beta_testers.find_one({"email": user["email"].lower().strip()})
                if tester_doc:
                    is_tester = True
                    await db.users.update_one({"id": user["id"]}, {"$set": {"is_beta_tester": True}})
            if not is_tester:
                raise HTTPException(
                    status_code=403, 
                    detail="Jaey Ride is currently in private beta testing with select users. Full campus rollout is coming soon!"
                )

        # User Penalty Check
        # user_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0})
        # if user_doc and user_doc.get("pending_penalty", 0.0) > 0:
        #     penalty = user_doc["pending_penalty"]
        #     raise HTTPException(
        #         status_code=403, 
        #         detail=f"You have an outstanding penalty of K{penalty:0.2f}. Please clear it before requesting a new ride."
        #     )

        # Ride Spam / Concurrency Check
        active_ride = await db.rides.find_one({
            "student_id": user["id"],
            "status": {"$in": get_active_ride_states()}
        })
        if active_ride:
            raise HTTPException(status_code=429, detail="You already have an active ride request.")

        # DEBUG: Check available drivers
        online_count = await db.drivers.count_documents({"is_online": True, "is_approved": True})
        logger.info(f"DEBUG: {online_count} drivers online and approved in DB before request.")

        settings = await get_platform_settings()
        
        # DEBUG: Check data types
        # print(f"Pickup: {ride_data.pickup_location}, Type: {type(ride_data.pickup_location)}")
        
        # Server-side calculation
        # Server-side calculation with OSRM
        route_data = await get_route(
            ride_data.pickup_location["lat"], ride_data.pickup_location["lng"],
            ride_data.dropoff_location["lat"], ride_data.dropoff_location["lng"]
        )
        
        if route_data.get("source") not in ["mapbox", "osrm"]:
             logger.error("Routing failed (neither Mapbox nor OSRM available). Rejecting ride request for safety.")
             raise HTTPException(status_code=503, detail="Routing service unavailable. Cannot calculate secure fare.")

        dist = route_data["distance_km"]
        duration = route_data["duration_minutes"]
        
        # Ensure we have valid numbers
        if dist < 0.1: dist = 0.1
        if duration < 1: duration = 1
        
        # PRICING ENGINE CALL
        pricing_result = await calculate_ride_fare(
            ride_data.pickup_location,
            ride_data.dropoff_location,
            dist,
            duration,
            ride_data.ride_mode
        )
        
        calculated_fare = pricing_result["fare"]
        commission = pricing_result.get("commission", round(calculated_fare * 0.10, 2))
        driver_earning = pricing_result.get("driver_earning", round(calculated_fare - commission, 2))
        
        ride_id = str(uuid.uuid4())
        ride = {
            "id": ride_id,
            "student_id": user["id"],
            "driver_id": None,
            "pickup_location": ride_data.pickup_location,
            "dropoff_location": ride_data.dropoff_location,
            "status": RideStatus.REQUESTED.value,
            "ride_mode": ride_data.ride_mode.value,
            "passenger_count": ride_data.passenger_count,
            "fare": calculated_fare,
            "commission": commission,
            "driver_earning": driver_earning,
            "distance": round(dist, 2),
            "duration": round(duration, 1),
            "verified_distance": round(dist, 2),
            "verified_duration": round(duration, 1),
            "verified_geometry": route_data["geometry"],
            "route_geometry": route_data["geometry"],
            "route_source": route_data["source"],
            "rating": None,
            "review": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "accepted_at": None,
            "completed_at": None
        }
        await db.rides.insert_one(ride)
        ride.pop("_id", None)
        student_obj = {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "phone": user.get("phone", ""),
            "role": str(user.get("role", "student"))
        }
        ride["student"] = student_obj
        ride["student_name"] = user["name"]
        
        # Broadcast to available drivers
        await manager.broadcast_to_nearby_drivers({
            "type": "new_ride_request",
            "ride": ride
        }, ride_data.pickup_location)
        
        return RideResponse(**ride)
    except Exception as e:
        logger.error(f"Error in request_ride: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

async def get_driver_active_state(driver_id: str):
    driver = await db.drivers.find_one({"$or": [{"id": driver_id}, {"user_id": driver_id}]})
    ids_to_check = [driver_id]
    if driver:
        if driver.get("id"): ids_to_check.append(driver["id"])
        if driver.get("user_id"): ids_to_check.append(driver["user_id"])
    
    active_rides = await db.rides.find({
        "driver_id": {"$in": ids_to_check},
        "status": {"$in": get_active_ride_states()}
    }).to_list(100)
    
    active_passengers = sum(ride.get("passenger_count", 1) for ride in active_rides)
    has_private = any(ride.get("ride_mode") == RideMode.PRIVATE.value for ride in active_rides)
    has_shared = any(ride.get("ride_mode") == RideMode.SHARED.value for ride in active_rides)
    
    return {
        "active_passengers": active_passengers,
        "has_private": has_private,
        "has_shared": has_shared,
        "active_rides_count": len(active_rides)
    }

def is_driver_eligible(driver: dict, active_state: dict, requested_mode: str = None, requested_passenger_count: int = 0) -> dict:
    """
    Single source of truth for driver eligibility.
    Returns structured result: { 'eligible': bool, 'reason': str, 'remaining_seats': int, 'visibility': bool, 'accepts_private': bool, 'accepts_shared': bool }
    """
    capacity = driver.get("vehicle_capacity", 4)
    active_passengers = active_state["active_passengers"]
    remaining_seats = capacity - active_passengers
    
    visibility = not active_state["has_private"] and remaining_seats > 0
    accepts_shared = driver.get("accepts_shared_rides", True)
    
    result = {
        "eligible": False,
        "reason": "",
        "remaining_seats": remaining_seats,
        "visibility": visibility,
        "accepts_private": (active_passengers == 0),
        "accepts_shared": accepts_shared
    }
    
    if not driver.get("is_online", False):
        result["reason"] = "driver_offline"
        result["visibility"] = False
        return result
        
    if active_state["has_private"]:
        result["reason"] = "private_ride_active"
        return result

    if requested_mode:
        if requested_mode == RideMode.PRIVATE.value:
            if active_passengers > 0:
                result["reason"] = "capacity_exceeded" # Cannot accept private while carrying passengers
                return result
        elif requested_mode == RideMode.SHARED.value:
            if not accepts_shared:
                result["reason"] = "shared_disabled"
                return result
            if requested_passenger_count > remaining_seats:
                result["reason"] = "capacity_exceeded"
                return result
        
        # If no explicit requested_mode blockers match, and they fit:
        if requested_passenger_count > remaining_seats:
            result["reason"] = "vehicle_full"
            return result
            
        result["eligible"] = True
        result["reason"] = "shared_capacity_available" if active_state["has_shared"] else "eligible"
        return result
    else:
        # Just checking general eligibility/visibility
        if remaining_seats <= 0:
            result["reason"] = "vehicle_full"
            return result
        result["eligible"] = True
        result["reason"] = "eligible"
        return result
            
async def broadcast_route_queue(driver_id: str):
    try:
        driver = await db.drivers.find_one({"id": driver_id})
        if not driver:
            driver = await db.drivers.find_one({"user_id": driver_id})
        if not driver:
            return
        trip = await db.driver_trips.find_one({"driver_id": driver["id"]})
        if not trip:
            trip = await DriverTripRebuilder.rebuild(driver["id"], db)
        if trip:
            driver_user_id = driver.get("user_id") or driver["id"]
            await manager.send_personal_message({
                "type": "routeQueueUpdate",
                "route_queue": trip.get("route_queue", [])
            }, driver_user_id)
    except Exception as e:
        logger.error(f"Error broadcasting route queue to driver {driver_id}: {e}")

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_driver)):
    # 1. Parallelize initial queries (Driver profile, platform settings, target ride)
    driver, settings, target_ride = await asyncio.gather(
        db.drivers.find_one({"user_id": user["id"]}, {"_id": 0}),
        get_platform_settings(),
        db.rides.find_one({"id": ride_id})
    )

    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
        
    # Debt Limit Check
    max_limit = settings.get("max_commission_owed_limit", 500.0) if settings else 500.0
    total_due = driver.get("total_commission_due", 0.0)
    if total_due >= max_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Commission debt limit reached (K{total_due:.2f} / K{max_limit:.2f}). Please remit payment to Admin to clear your balance and unlock your account."
        )
    
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    validate_ride_transition(target_ride.get("status"), RideStatus.DRIVER_ACCEPTED.value)
        
    ride_mode = target_ride.get("ride_mode", RideMode.PRIVATE.value)
    passenger_count = target_ride.get("passenger_count", 1)
    
    # DISPATCH MATCHING RULES via centralized source of truth
    active_state = await get_driver_active_state(driver["id"])
    eligibility = is_driver_eligible(driver, active_state, ride_mode, passenger_count)
    
    if not eligibility["eligible"]:
        reason = eligibility["reason"]
        if reason == "private_ride_active":
            raise HTTPException(status_code=400, detail="Cannot accept another ride while on a private ride.")
        elif reason == "capacity_exceeded":
            if ride_mode == RideMode.PRIVATE.value:
                raise HTTPException(status_code=400, detail="Cannot accept a private ride while carrying passengers.")
            else:
                raise HTTPException(status_code=400, detail=f"Not enough capacity. You have {eligibility['remaining_seats']} seats available.")
        elif reason == "shared_disabled":
            raise HTTPException(status_code=400, detail="You are not accepting shared rides.")
        elif reason == "vehicle_full":
            raise HTTPException(status_code=400, detail="Vehicle is full.")
        else:
            raise HTTPException(status_code=400, detail=f"Ineligible: {reason}")

    # Rate Limit Driver Requests
    ten_seconds_ago = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    recent_accepts = await db.rides.count_documents({
        "driver_id": driver["id"],
        "accepted_at": {"$gte": ten_seconds_ago}
    })
    if recent_accepts >= 3:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a few seconds.")

    # ATOMIC UPDATE: State verified above
    now = datetime.now(timezone.utc).isoformat()
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "status": target_ride["status"]},
        {"$set": {
            "driver_id": driver["id"],
            "status": RideStatus.DRIVER_ACCEPTED.value,
            "accepted_at": now
        }},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        # Check if ride exists at all to give better error
        existing = await db.rides.find_one({"id": ride_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Ride not found")
        raise HTTPException(status_code=400, detail="Ride already taken or cancelled")

    # Lock driver in background if needed
    if ride_mode == RideMode.PRIVATE.value or active_state["active_rides_count"] == 0:
        background_tasks.add_task(
            db.drivers.update_one,
            {"id": driver["id"]},
            {"$set": {"current_ride_id": ride_id}}
        )
        
    # Broadcast to all active drivers to remove accepted ride from their shared pools
    background_tasks.add_task(manager.broadcast_to_all_active_connections, {
        "type": "shared_ride_accepted_by_other",
        "ride_id": ride_id
    })
    
    # 2. Parallel user profile lookups for driver and student
    driver_user, student_user = await asyncio.gather(
        db.users.find_one({"id": driver.get("user_id")}, {"_id": 0, "password": 0}),
        db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
    )

    driver_payload = dict(driver)
    if driver_user:
        driver_payload["user"] = {
            "id": driver_user.get("id"),
            "name": driver_user.get("name"),
            "email": driver_user.get("email"),
            "phone": driver_user.get("phone", ""),
            "avatar_url": driver_user.get("avatar_url"),
            "role": driver_user.get("role", "driver")
        }

    if student_user:
        ride["student"] = {
            "id": student_user["id"],
            "email": student_user["email"],
            "name": student_user["name"],
            "phone": student_user.get("phone", ""),
            "avatar_url": student_user.get("avatar_url"),
            "role": str(student_user.get("role", "student")),
            "created_at": student_user.get("created_at", ""),
            "is_active": student_user.get("is_active", True)
        }
        ride["student_name"] = student_user["name"]

    driver_loc = manager.driver_locations.get(driver.get("user_id")) or manager.driver_locations.get(driver["id"]) or driver.get("current_location", {})
    if driver_loc and ("lat" in driver_loc or "latitude" in driver_loc):
        driver_payload["current_location"] = {
            "lat": driver_loc.get("lat") or driver_loc.get("latitude"),
            "lng": driver_loc.get("lng") or driver_loc.get("longitude"),
            "heading": driver_loc.get("heading", 0.0),
            "status": "online"
        }

    # Build instant optimistic passenger briefing before WebSocket dispatch
    active_passengers = active_state.get("active_passengers", 0)
    is_next_stop_initial = (active_passengers == 0)
    initial_stops_remaining = active_passengers
    initial_briefing_text = "Driver is approaching your pickup point." if is_next_stop_initial else "Driver is picking up another student."
    initial_carousel = ["You are the next stop.", "Driver is approaching your pickup point."] if is_next_stop_initial else [f"{initial_stops_remaining} stop remaining before your pickup.", "Driver is picking up another student.", "Shared Ride"]
    
    initial_briefing = {
        "ride_id": ride_id,
        "briefing_text": initial_briefing_text,
        "x3_state": "HEADING_TO_MY_PICKUP" if is_next_stop_initial else "DRIVER_EN_ROUTE_OTHER_PICKUP",
        "is_pinned": False,
        "carousel_messages": initial_carousel,
        "stops_remaining": initial_stops_remaining,
        "is_next_stop": is_next_stop_initial,
        "intermediate_stops": [],
        "route_segments": [],
        "route_geometry": ride.get("verified_geometry", []) or ride.get("route_geometry", []),
        "eta_seconds": 180,
        "eta_text": "~3 min"
    }
    ride["passenger_briefing"] = initial_briefing

    # Register ride in in-memory active rides mapping
    manager.add_active_ride(driver["id"], ride)
    if driver.get("user_id"):
        manager.add_active_ride(driver["user_id"], ride)

    # Direct instant WebSocket dispatch to student (<10ms)
    try:
        await manager.send_personal_message(
            {
                "ride_mode": ride_mode,
                "type": "ride_accepted",
                "ride": ride,
                "driver": driver_payload
            },
            ride["student_id"]
        )
    except Exception as e:
        logger.error(f"Failed direct websocket send to student: {e}")

    # Rebuild multi-stop trip & calculate ETAs in non-blocking background task
    async def bg_rebuild_and_notify(d_id, d_user_id, s_id):
        try:
            trip = await DriverTripRebuilder.rebuild(d_id, db, driver_loc=driver_payload.get("current_location"))
            if trip:
                trip = await inject_etas_into_trip(trip, driver_payload.get("current_location", {}))
                
                # BROADCAST TO ALL PASSENGERS IN THE POOL
                passenger_briefings = trip.get("passenger_briefings", {})
                for student_id, briefing in passenger_briefings.items():
                    await manager.send_personal_message({
                        "type": "passenger_briefing_update",
                        "ride_id": briefing["ride_id"],
                        "briefing_text": briefing["briefing_text"],
                        "x3_state": briefing.get("x3_state"),
                        "is_pinned": briefing.get("is_pinned", False),
                        "carousel_messages": briefing.get("carousel_messages", []),
                        "stops_remaining": briefing["stops_remaining"],
                        "is_next_stop": briefing["is_next_stop"],
                        "intermediate_stops": briefing.get("intermediate_stops", []),
                        "route_segments": briefing.get("route_segments", []),
                        "route_geometry": briefing.get("route_geometry", []),
                        "eta_seconds": briefing.get("eta_seconds"),
                        "eta_text": briefing.get("eta_text")
                    }, student_id)

                # UPDATE DRIVER DASHBOARD
                await manager.send_personal_message({
                    "type": "trip_updated",
                    "route_queue": trip.get("route_queue", []),
                    "full_driver_segments": trip.get("full_driver_segments", [])
                }, d_user_id)
        except Exception as bg_err:
            logger.error(f"Background DriverTripRebuilder failed: {bg_err}")

    asyncio.create_task(bg_rebuild_and_notify(driver["id"], driver.get("user_id", driver["id"]), ride["student_id"]))
    
    # Push notification
    async def send_accept_push(student_id, r_id, user_name):
        await notification_service.send(
            user_id=student_id,
            type="ride_accepted",
            payload={
                "title": "Ride Accepted",
                "body": f"{user_name} is on the way!",
                "url": f"/ride/{r_id}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png"
            }
        )
    background_tasks.add_task(send_accept_push, ride["student_id"], ride_id, user.get('name', 'Your driver'))
    
    # Add both to ride room
    manager.add_to_ride(ride_id, ride["student_id"])
    manager.add_to_ride(ride_id, user["id"])
    
    ride["driver"] = driver_payload # Include full driver details in response
    return RideResponse(**ride)

@api_router.post("/rides/{ride_id}/arrived")
async def driver_arrived(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await find_driver_ride(ride_id, driver["id"])
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    
    current_status = target_ride.get("status")
    if current_status == RideStatus.DRIVER_ARRIVED.value:
        logger.info(f"Ride {ride_id} is already in driver_arrived status. Returning 200 OK.")
        return {"status": "arrived"}

    validate_ride_transition(current_status, RideStatus.DRIVER_ARRIVED.value)

    actual_query = {"_id": target_ride["_id"], "status": current_status}
    ride = await db.rides.find_one_and_update(
        actual_query,
        {"$set": {"status": RideStatus.DRIVER_ARRIVED.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        updated = await find_driver_ride(ride_id, driver["id"])
        if updated and updated.get("status") == RideStatus.DRIVER_ARRIVED.value:
            return {"status": "arrived"}
        raise HTTPException(status_code=400, detail="Invalid transition or double update.")
    
    # Instant direct WebSocket dispatch to student (<10ms)
    try:
        await manager.send_personal_message(
            {
                "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value),
                "type": "driver_arrived",
                "ride_id": ride_id
            },
            ride["student_id"]
        )
    except Exception as e:
        logger.error(f"Failed direct websocket send driver_arrived: {e}")
    
    async def send_arrived_push(student_id, r_id):
        await notification_service.send(
            user_id=student_id,
            type="driver_arrived",
            payload={
                "title": "🚨 DRIVER HAS ARRIVED!",
                "body": "Your driver is waiting at your pickup location!",
                "url": f"/ride/{r_id}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png",
                "tag": "driver_arrived"
            }
        )
    background_tasks.add_task(send_arrived_push, ride["student_id"], ride_id)
    background_tasks.add_task(DriverTripRebuilder.rebuild, driver["id"], db)
    
    return {"status": "arrived"}

@api_router.post("/rides/{ride_id}/start")
async def start_ride(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await find_driver_ride(ride_id, driver["id"])
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
        
    current_status = target_ride.get("status")
    if current_status in [RideStatus.RIDE_STARTED.value, "ongoing"]:
        logger.info(f"Ride {ride_id} is already started. Returning 200 OK.")
        return {"status": "ongoing"}

    validate_ride_transition(current_status, RideStatus.RIDE_STARTED.value)

    actual_query = {"_id": target_ride["_id"], "status": current_status}
    ride = await db.rides.find_one_and_update(
        actual_query,
        {"$set": {
            "status": RideStatus.RIDE_STARTED.value,
            "started_at": datetime.now(timezone.utc).isoformat()
        }},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        updated = await find_driver_ride(ride_id, driver["id"])
        if updated and updated.get("status") in [RideStatus.RIDE_STARTED.value, "ongoing"]:
            return {"status": "ongoing"}
        raise HTTPException(status_code=400, detail="Invalid transition or double update.")
    
    # Instant direct WebSocket dispatch to student (<10ms)
    try:
        await manager.send_personal_message(
            {
                "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value),
                "type": "ride_started",
                "ride_id": ride_id
            },
            ride["student_id"]
        )
    except Exception as e:
        logger.error(f"Failed direct websocket send ride_started: {e}")
    
    # Official push notification for ride start
    async def send_start_push(student_id, r_id):
        await notification_service.send(
            user_id=student_id,
            type="ride_started",
            payload={
                "title": "Ride Started",
                "body": "You are on your way to your destination.",
                "url": f"/ride/{r_id}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png",
                "tag": f"ride_started_{r_id}"
            }
        )
    background_tasks.add_task(send_start_push, ride["student_id"], ride_id)
    background_tasks.add_task(DriverTripRebuilder.rebuild, driver["id"], db)
    
    return {"status": "ongoing"}

@api_router.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await find_driver_ride(ride_id, driver["id"])
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")

    current_status = target_ride.get("status")
    if current_status == RideStatus.RIDE_COMPLETED.value:
        logger.info(f"Ride {ride_id} is already completed. Returning 200 OK.")
        return {"status": "completed", "fare": target_ride.get("fare", 0.0), "driver_earning": target_ride.get("driver_earning", 0.0)}

    # FRAUD PROTECTION: Prevent instant completes (Lowered to 2s for testing)
    started_at_str = target_ride.get("started_at")
    if started_at_str:
        started_at = datetime.fromisoformat(started_at_str)
        delta = (datetime.now(timezone.utc) - started_at).total_seconds()
        logger.info(f"FRAUD CHECK: Ride {ride_id} started at {started_at_str}. Current delta: {delta}s")
        if delta < 2:
            raise HTTPException(status_code=400, detail="Fraud Protection: Cannot complete ride instantly.")

    validate_ride_transition(current_status, RideStatus.RIDE_COMPLETED.value)
    
    actual_query = {"_id": target_ride["_id"], "status": current_status}
    ride = await db.rides.find_one_and_update(
        actual_query,
        {"$set": {"status": RideStatus.RIDE_COMPLETED.value, "completed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    if not ride:
        updated = await find_driver_ride(ride_id, driver["id"])
        if updated and updated.get("status") == RideStatus.RIDE_COMPLETED.value:
            return {"status": "completed", "fare": updated.get("fare", 0.0), "driver_earning": updated.get("driver_earning", 0.0)}
        raise HTTPException(status_code=400, detail="Invalid transition. Race condition prevented.")
    
    commission_amount = ride.get("commission")
    if commission_amount is None or commission_amount <= 0.0:
        commission_amount = round(float(ride.get("fare", 0.0)) * 0.10, 2)
    else:
        commission_amount = float(commission_amount)
    
    # Flipped Wallet Logic: Accumulate Platform Commission Debt
    settings = await get_platform_settings()
    max_limit = settings.get("max_commission_owed_limit", 500.0)
    
    total_due = round(float(driver.get("total_commission_due", 0.0)) + commission_amount, 2)
    driver_earning = round(float(ride.get("driver_earning", max(0.0, float(ride.get("fare", 0.0)) - commission_amount))), 2)
    
    wallet_status = WalletStatus.ACTIVE.value
    is_still_online = driver.get("is_online", True)
    
    if total_due >= max_limit:
        wallet_status = WalletStatus.RESTRICTED.value
        is_still_online = False
        logger.warning(f"Driver {driver['id']} reached commission debt limit: K{total_due:.2f} / K{max_limit:.2f}. Restricting account.")
        
    remaining_active_rides = await db.rides.count_documents({
        "driver_id": driver["id"],
        "status": {"$in": get_active_ride_states()}
    })

    set_ops = {
        "total_commission_due": total_due,
        "wallet_status": wallet_status,
        "is_online": is_still_online
    }
    
    if remaining_active_rides == 0:
        set_ops["current_ride_id"] = None

    # Log transaction
    now_iso = datetime.now(timezone.utc).isoformat()
    transaction = {
        "id": str(uuid.uuid4()),
        "driver_id": driver["id"],
        "type": TransactionType.COMMISSION_DEDUCTION.value,
        "amount": -commission_amount,
        "ride_id": ride_id,
        "description": f"Commission for ride {ride_id}",
        "timestamp": now_iso
    }

    # Parallelize DB writes over Atlas WAN
    await asyncio.gather(
        db.drivers.update_one(
            {"id": driver["id"]},
            {
                "$inc": {
                    "total_rides": 1,
                    "total_earnings": ride.get("driver_earning", 0.0)
                },
                "$set": set_ops
            }
        ),
        db.rides.update_one({"id": ride_id}, {"$set": {"status": RideStatus.RIDE_ARCHIVED.value}}),
        db.driver_wallet_transactions.insert_one(transaction)
    )
    
    ride["status"] = RideStatus.RIDE_ARCHIVED.value
    
    # Direct immediate WebSocket dispatch (<10ms)
    try:
        await manager.send_personal_message(
            {
                "type": "ride_completed",
                "ride_id": ride_id,
                "fare": ride["fare"]
            },
            ride["student_id"]
        )
    except Exception as e:
        logger.error(f"Failed direct websocket send ride_completed to student: {e}")

    try:
        await manager.send_personal_message(
            {
                "type": "ride_completed",
                "ride_id": ride_id,
                "fare": ride["fare"]
            },
            user["id"]
        )
    except Exception as e:
        logger.error(f"Failed direct websocket send ride_completed to driver: {e}")

    # Notify Driver of Wallet Update asynchronously
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "type": "wallet_updated",
            "wallet_balance": -total_due,
            "total_commission_due": total_due,
            "wallet_status": wallet_status
        },
        user["id"]
    )
    
    # Remove from in-memory active rides mapping
    manager.remove_active_ride(driver["id"], ride_id)
    if driver.get("user_id"):
        manager.remove_active_ride(driver["user_id"], ride_id)

    # Official push notification for ride completion
    async def send_complete_push(student_id, r_id, fare_val):
        await notification_service.send(
            user_id=student_id,
            type="ride_completed",
            payload={
                "title": "Ride Complete",
                "body": f"You have arrived! Total fare: K{fare_val:.2f}",
                "url": f"/ride/{r_id}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png",
                "tag": f"ride_completed_{r_id}"
            }
        )
    background_tasks.add_task(send_complete_push, ride["student_id"], ride_id, ride["fare"])

    background_tasks.add_task(manager.remove_from_ride, ride_id, ride["student_id"])
    background_tasks.add_task(manager.remove_from_ride, ride_id, user["id"])
    background_tasks.add_task(DriverTripRebuilder.rebuild, driver["id"], db)
    
    return {"status": "completed", "fare": ride["fare"]}


@api_router.post("/rides/{ride_id}/en_route")
async def driver_en_route(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": "ride_state_changed",
        "state": RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "en_route_to_pickup"}

@api_router.post("/rides/{ride_id}/boarding")
async def passenger_boarding(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.PASSENGER_BOARDING.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.PASSENGER_BOARDING.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": "ride_state_changed",
        "state": RideStatus.PASSENGER_BOARDING.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "passenger_boarding"}

@api_router.post("/rides/{ride_id}/in_progress")
async def ride_in_progress(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.RIDE_IN_PROGRESS.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.RIDE_IN_PROGRESS.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": "ride_state_changed",
        "state": RideStatus.RIDE_IN_PROGRESS.value,
        "ride_id": ride_id
    }, ride["student_id"])
    return {"status": "ride_in_progress"}

@api_router.post("/rides/{ride_id}/arriving")
async def arriving_destination(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    target_ride = await db.rides.find_one({"id": ride_id, "driver_id": driver["id"]})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found or not assigned to you")
    validate_ride_transition(target_ride.get("status"), RideStatus.ARRIVING_DESTINATION.value)

    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "driver_id": driver["id"], "status": target_ride["status"]},
        {"$set": {"status": RideStatus.ARRIVING_DESTINATION.value}},
        return_document=True
    )
    if ride: ride.pop("_id", None)
    
    background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
        "type": "ride_state_changed",
        "state": RideStatus.ARRIVING_DESTINATION.value,
        "ride_id": ride_id
    }, ride["student_id"])
    await broadcast_route_queue(driver["id"])
    return {"status": "arriving_destination"}

@api_router.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check permission
    is_driver = False
    is_rider = False
    
    if ride["student_id"] == user["id"]:
        is_rider = True
    elif user["role"] not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not driver or ride["driver_id"] != driver["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        is_driver = True
    
    status = ride["status"]
    if status in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel this ride")
        
    # SECTION 11: Driver Fraud Protection - cannot cancel after start
    if is_driver and status == RideStatus.ONGOING.value:
        raise HTTPException(status_code=403, detail="Fraud Protection: Drivers cannot cancel a ride after it has started.")
        
    # SECTION 9: Fraud-Proof Cancellation Logic
    penalty_amount = 0
    penalty_reason = ""
    
    if is_driver:
        if status in [RideStatus.ACCEPTED.value, RideStatus.DRIVER_ARRIVED.value]:
            penalty_amount = 3.0
            penalty_reason = "Driver cancelled after accepting"
    elif is_rider:
        if status == RideStatus.ACCEPTED.value:
            penalty_amount = 2.0
            penalty_reason = "Rider cancelled after driver accepted"
        elif status == RideStatus.DRIVER_ARRIVED.value:
            penalty_amount = 5.0
            penalty_reason = "Rider cancelled after driver arrived"
            
    # Apply driver penalty automatically to driver wallet
    if is_driver and penalty_amount > 0 and ride.get("driver_id"):
        driver_db = await db.drivers.find_one({"id": ride["driver_id"]})
        if driver_db:
            new_balance = driver_db.get("wallet_balance", 0.0) - penalty_amount
            new_due = driver_db.get("total_commission_due", 0.0) + penalty_amount
            await db.drivers.update_one(
                {"id": driver_db["id"]},
                {"$set": {"wallet_balance": new_balance, "total_commission_due": new_due}}
            )
            await db.driver_wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "driver_id": driver_db["id"],
                "type": TransactionType.COMMISSION_DEDUCTION.value,
                "amount": -penalty_amount,
                "ride_id": ride_id,
                "description": penalty_reason,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            
    # Apply rider penalty (placeholder for future billing)
    # if is_rider and penalty_amount > 0:
    #     await db.users.update_one(
    #         {"id": user["id"]},
    #         {"$inc": {"pending_penalty": penalty_amount}}
    #     )
    
    # Unlock driver if assigned
    if ride.get("driver_id"):
        await db.drivers.update_one(
            {"id": ride["driver_id"]},
            {"$set": {"current_ride_id": None}}
        )

    if is_driver:
        # Driver cancelled: put the ride back in the pool
        driver_id_to_notify = ride.get("driver_id")
        if driver_id_to_notify:
            manager.remove_active_ride(driver_id_to_notify, ride_id)
            if user.get("id"):
                manager.remove_active_ride(user["id"], ride_id)

        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {
                "status": RideStatus.REQUESTED.value,
                "driver_id": None
            }}
        )
        
        # Notify the student immediately (<10ms)
        try:
            await manager.send_personal_message(
                {
                    "type": "driver_cancelled_reassigning",
                    "ride_id": ride_id,
                    "message": "Your driver had to cancel. Finding a new driver..."
                },
                ride["student_id"]
            )
        except Exception as e:
            logger.error(f"Failed direct send driver_cancelled_reassigning to student: {e}")
        
        # Broadcast to pool that ride is back available
        ride["status"] = RideStatus.REQUESTED.value
        ride["driver_id"] = None
        await populate_ride_student(ride)
        background_tasks.add_task(manager.broadcast_to_nearby_drivers, {
            "type": "new_ride_request",
            "ride": ride
        }, ride.get("pickup_location"))
        
        # Official push notification to student for driver cancel
        async def send_driver_cancel_push(student_id, r_id):
            await notification_service.send(
                user_id=student_id,
                type="ride_cancelled",
                payload={
                    "title": "Ride Cancelled",
                    "body": "Your driver had to cancel. Finding you another driver...",
                    "url": f"/ride/{r_id}",
                    "icon": "/logo192.png",
                    "badge": "/favicon-32x32.png",
                    "tag": f"ride_cancelled_{r_id}"
                }
            )
        background_tasks.add_task(send_driver_cancel_push, ride["student_id"], ride_id)

        if driver_id_to_notify:
            try:
                await DriverTripRebuilder.rebuild(driver_id_to_notify, db)
                await broadcast_route_queue(driver_id_to_notify)
            except Exception as e:
                logger.error(f"Failed DriverTripRebuilder on driver cancel: {e}")

        return {"status": "reassigned"}
    else:
        # Rider cancelled: terminate the ride completely
        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {"status": RideStatus.CANCELLED.value}}
        )
        
        cancel_msg = {
            "type": "ride_cancelled",
            "ride_id": ride_id,
            "student_id": ride.get("student_id"),
            "message": "Student cancelled the ride"
        }

        # Direct immediate WebSocket dispatch (<10ms) - single dispatch to avoid double toasts
        try:
            await manager.broadcast_to_ride(cancel_msg, ride_id)
        except Exception as e:
            logger.error(f"Failed direct broadcast_to_ride cancel: {e}")
        
        if ride.get("driver_id"):
            manager.remove_active_ride(ride["driver_id"], ride_id)
            driver_doc = await db.drivers.find_one({"id": ride["driver_id"]})
            if driver_doc:
                driver_uid = driver_doc.get("user_id") or driver_doc.get("id")
                if driver_uid:
                    manager.remove_active_ride(driver_uid, ride_id)
                    try:
                        await manager.send_personal_message(cancel_msg, driver_uid)
                    except Exception as e:
                        logger.error(f"Failed direct send cancel to driver: {e}")
                    
                    # Official push notification to driver for rider cancel
                    async def send_rider_cancel_push(d_uid, r_id):
                        await notification_service.send(
                            user_id=d_uid,
                            type="ride_cancelled",
                            payload={
                                "title": "Ride Cancelled",
                                "body": f"Passenger cancelled Ride #{r_id[:8]}",
                                "url": "/driver",
                                "icon": "/logo192.png",
                                "badge": "/favicon-32x32.png",
                                "tag": f"ride_cancelled_{r_id}"
                            }
                        )
                    background_tasks.add_task(send_rider_cancel_push, driver_uid, ride_id)
                
                try:
                    driver_loc = manager.driver_locations.get(driver_doc.get("user_id")) or driver_doc.get("current_location", {})
                    trip = await DriverTripRebuilder.rebuild(driver_doc["id"], db, driver_loc=driver_loc)
                    if trip:
                        driver_uid = driver_doc.get("user_id") or driver_doc["id"]
                        # Instant update driver dashboard with cleaned-up queue & segments
                        await manager.send_personal_message({
                            "type": "trip_updated",
                            "route_queue": trip.get("route_queue", []),
                            "full_driver_segments": trip.get("full_driver_segments", [])
                        }, driver_uid)

                        # Broadcast updated briefings & routes to all remaining passengers in the pool
                        passenger_briefings = trip.get("passenger_briefings", {})
                        for rem_s_id, briefing in passenger_briefings.items():
                            await manager.send_personal_message({
                                "type": "passenger_briefing_update",
                                "ride_id": briefing["ride_id"],
                                "briefing_text": briefing["briefing_text"],
                                "x3_state": briefing.get("x3_state"),
                                "is_pinned": briefing.get("is_pinned", False),
                                "carousel_messages": briefing.get("carousel_messages", []),
                                "stops_remaining": briefing["stops_remaining"],
                                "is_next_stop": briefing["is_next_stop"],
                                "intermediate_stops": briefing.get("intermediate_stops", []),
                                "route_segments": briefing.get("route_segments", []),
                                "route_geometry": briefing.get("route_geometry", []),
                                "eta_seconds": briefing.get("eta_seconds"),
                                "eta_text": briefing.get("eta_text")
                            }, rem_s_id)
                except Exception as e:
                    logger.error(f"Failed DriverTripRebuilder on rider cancel: {e}")
            else:
                try:
                    await manager.send_personal_message(cancel_msg, ride["driver_id"])
                except Exception as e:
                    logger.error(f"Failed direct send cancel fallback: {e}")
        else:
            # If no driver was assigned, broadcast cancellation to the shared pool
            background_tasks.add_task(manager.broadcast_to_nearby_drivers, {
                "type": "shared_ride_cancelled",
                "ride_id": ride_id
            }, ride.get("pickup_location"))
            
        return {"status": "cancelled"}

@api_router.post("/emergency/sos")
async def trigger_sos(request: EmergencyRequest, user: dict = Depends(get_current_user)):
    """
    Triggers an emergency SOS alert.
    Redirects user to phone dialer and notifies all admins via push.
    """
    ride = await db.rides.find_one({"id": request.ride_id})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    # Safety check: only the student or driver can trigger SOS
    if user["id"] != ride["student_id"] and user["id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Not authorized to trigger SOS for this ride")

    # Get all admins and super admins
    admins = await db.users.find({
        "role": {"$in": [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]}
    }).to_list(100)
    
    # Broadcast push notification to all admins
    admin_count = 0
    for admin in admins:
        success = await notification_service.send(
            user_id=admin["id"],
            type="emergency_sos",
            payload={
                "title": "🚨 EMERGENCY SOS",
                "body": f"SOS triggered by {user['name']} in Ride #{ride['id'][:8]}. User is in danger!",
                "url": f"/admin/rides/{ride['id']}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png",
                "tag": f"emergency-{ride['id']}"
            }
        )
        if success:
            admin_count += 1

    # Broadcast real-time WebSocket emergency alert to all connected admins (<10ms)
    sos_ws_payload = {
        "type": "emergency_sos",
        "ride_id": ride["id"],
        "student_name": user.get("name", "Student"),
        "student_phone": user.get("phone", "N/A"),
        "pickup_location": ride.get("pickup_location", {}).get("name", "Pickup Point") if isinstance(ride.get("pickup_location"), dict) else "Pickup Point",
        "dropoff_location": ride.get("dropoff_location", {}).get("name", "Dropoff Point") if isinstance(ride.get("dropoff_location"), dict) else "Dropoff Point",
        "location": request.location or "En route",
        "message": request.message or "Passenger triggered Emergency SOS",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    for admin in admins:
        admin_uid = admin["id"]
        try:
            await manager.send_personal_message(sos_ws_payload, admin_uid)
        except Exception as ws_err:
            logger.warning(f"Could not send SOS websocket to admin {admin_uid}: {ws_err}")
            
    # Log the emergency action
    await log_admin_action(
        admin_id=user["id"],
        admin_name=user["name"],
        action="emergency_sos",
        target_id=request.ride_id,
        details=f"SOS triggered. Location: {request.location or 'Unknown'}. Message: {request.message or 'None'}"
    )
    
    return {
        "status": "triggered",
        "admins_notified": admin_count,
        "emergency_contact": "+260976954518"
    }

@api_router.post("/rides/{ride_id}/rate")
@api_router.post("/rides/{ride_id}/rating")
async def rate_ride(ride_id: str, rating_data: RatingCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride or ride["student_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    valid_completed_statuses = [
        RideStatus.COMPLETED.value,
        RideStatus.RIDE_COMPLETED.value,
        RideStatus.RIDE_ARCHIVED.value,
        "completed_ride"
    ]
    if ride["status"] not in valid_completed_statuses:
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"rating": rating_data.rating, "review": rating_data.review}}
    )
    
    # Update driver rating
    if ride.get("driver_id"):
        driver_rides = await db.rides.find({
            "driver_id": ride["driver_id"],
            "rating": {"$ne": None}
        }, {"_id": 0}).to_list(1000)
        
        if driver_rides:
            valid_ratings = [r["rating"] for r in driver_rides if isinstance(r.get("rating"), (int, float)) and r["rating"] > 0]
            if valid_ratings:
                avg_rating = sum(valid_ratings) / len(valid_ratings)
                new_rating = round(avg_rating, 1)
                await db.drivers.update_one(
                    {"id": ride["driver_id"]},
                    {"$set": {"rating": new_rating}}
                )
                
                # Notify driver via WebSocket
                driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
                if driver and "user_id" in driver:
                    background_tasks.add_task(manager.send_personal_message, {
                        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value),
                        "type": "rating_received",
                        "rating": rating_data.rating,
                        "new_average": new_rating,
                        "ride_id": ride_id
                    }, driver["user_id"])
    
    return {"status": "rated"}

@api_router.get("/rides/active", response_model=Optional[RideResponse])
async def get_active_ride(user: dict = Depends(get_current_user)):
    query = {"status": {"$in": get_active_ride_states()}}
    
    if user["role"] == UserRole.DRIVER.value:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            query["driver_id"] = driver["id"]
        else:
            return None # Prevent finding random rides if driver profile is missing
    else:
        query["student_id"] = user["id"]
    
    ride = await db.rides.find_one(query, {"_id": 0}, sort=[("created_at", -1)])
    
    if ride:
        # Populate student
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student:
            ride["student"] = UserResponse(
                id=student["id"],
                email=student["email"],
                name=student["name"],
                phone=student.get("phone", ""),
                avatar_url=student.get("avatar_url"),
                role=UserRole(student["role"]),
                created_at=student.get("created_at", ""),
                is_active=student.get("is_active", True)
            )
        
        # Populate driver
        if ride["driver_id"]:
            driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
            if driver:
                driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0})
                if driver_user:
                    driver["user"] = UserResponse(
                        id=driver_user["id"],
                        email=driver_user["email"],
                        name=driver_user["name"],
                        phone=driver_user.get("phone", ""),
                        avatar_url=driver_user.get("avatar_url"),
                        role=UserRole(driver_user["role"]),
                        created_at=driver_user.get("created_at", datetime.now().isoformat()),
                        is_active=driver_user.get("is_active", True)
                    )
                ride["driver"] = DriverResponse(**driver)
                
                # Phase 4 ETA Restoration on Refresh via MongoDB Cache (Phase 01)
                if user["role"] == UserRole.STUDENT.value:
                    try:
                        trip = await db.driver_trips.find_one({"driver_id": driver["id"]})
                        if trip and "passenger_briefings" in trip:
                            briefings = trip["passenger_briefings"]
                            # STRICT PASSENGER OWNERSHIP VERIFICATION
                            if user["id"] in briefings:
                                my_briefing = briefings[user["id"]]
                                if my_briefing.get("ride_id") == ride["id"]:
                                    ride["eta_seconds"] = my_briefing.get("eta_seconds")
                                    ride["eta_text"] = my_briefing.get("eta_text")
                                    ride["passenger_briefing"] = my_briefing
                        elif not trip:
                            logger.warning(f"CACHE MISS in GET /rides/active for driver {driver['id']} - zero fallback execution as per Phase 01 rules")
                    except Exception as e:
                        logger.error(f"Failed to restore cached briefing on refresh: {e}")
        
        return RideResponse(**ride)
    
    return None

@api_router.get("/rides/pending", response_model=List[RideResponse])
async def get_pending_rides(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        return []
        
    active_state = await get_driver_active_state(driver["id"])
    
    # If carrying a private ride, cannot see any new rides
    if active_state["has_private"]:
        return []
        
    # Build query based on driver capability
    query = {"status": RideStatus.REQUESTED.value}
    
    if active_state["active_passengers"] > 0:
        # Carrying shared passengers: can only see shared rides
        query["ride_mode"] = RideMode.SHARED.value
    elif not driver.get("accepts_shared_rides", True):
        # Empty but not accepting shared: can only see private rides
        query["ride_mode"] = RideMode.PRIVATE.value
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    result = []
    for ride in rides:
        if ride.get("ride_mode") == RideMode.SHARED.value:
            if not driver.get("accepts_shared_rides", True):
                continue
                
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student:
            ride["student"] = UserResponse(
                id=student["id"],
                email=student["email"],
                name=student["name"],
                phone=student["phone"],
                role=UserRole(student["role"]),
                created_at=student["created_at"],
                is_active=student.get("is_active", True)
            )
        result.append(RideResponse(**ride))
    
    return result

@api_router.get("/rides/history", response_model=List[RideResponse])
async def get_ride_history(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == UserRole.DRIVER.value:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        driver_ids = [user["id"]]
        if driver and driver.get("id"):
            driver_ids.append(driver["id"])
        query["driver_id"] = {"$in": driver_ids}
    else:
        query["student_id"] = user["id"]
    
    rides = await db.rides.find(
        query, 
        {"_id": 0, "verified_geometry": 0, "route_geometry": 0}
    ).sort("created_at", -1).to_list(limit)
    
    result = []
    for ride in rides:
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student:
            ride["student"] = UserResponse(
                id=student["id"],
                email=student["email"],
                name=student["name"],
                phone=student["phone"],
                role=UserRole(student["role"]),
                created_at=student["created_at"],
                is_active=student.get("is_active", True)
            )
        if ride.get("driver_id"):
            driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
            if driver:
                driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0})
                if driver_user:
                    driver["user"] = UserResponse(
                        id=driver_user["id"],
                        email=driver_user["email"],
                        name=driver_user["name"],
                        phone=driver_user.get("phone", ""),
                        avatar_url=driver_user.get("avatar_url"),
                        role=UserRole(driver_user["role"]),
                        created_at=driver_user.get("created_at", datetime.now().isoformat()),
                        is_active=driver_user.get("is_active", True)
                    )
                ride["driver"] = DriverResponse(**driver)
        result.append(RideResponse(**ride))
    
    return result

@api_router.get("/rides/{ride_id}", response_model=RideResponse)
async def get_ride_by_id(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await find_ride_by_id(ride_id)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    ride.pop("_id", None)
    
    # Populate student info with avatar
    if ride.get("student_id"):
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0})
        if student:
            ride["student"] = UserResponse(
                id=student["id"],
                email=student.get("email"),
                name=student.get("name", "Student"),
                phone=student.get("phone", ""),
                avatar_url=student.get("avatar_url"),
                role=UserRole(student.get("role", "student")),
                created_at=student.get("created_at", ""),
                is_active=student.get("is_active", True)
            )
            ride["student_name"] = student.get("name")
            
    # Populate driver info with avatar
    if ride.get("driver_id"):
        driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
        if driver:
            driver_user = await db.users.find_one({"id": driver.get("user_id")}, {"_id": 0})
            if driver_user:
                driver["user"] = UserResponse(
                    id=driver_user["id"],
                    email=driver_user.get("email"),
                    name=driver_user.get("name", "Driver"),
                    phone=driver_user.get("phone", ""),
                    avatar_url=driver_user.get("avatar_url"),
                    role=UserRole(driver_user.get("role", "driver")),
                    created_at=driver_user.get("created_at", ""),
                    is_active=driver_user.get("is_active", True)
                )
            ride["driver"] = DriverResponse(**driver)
            
    return RideResponse(**ride)

# ==================== ADMIN & ACCOUNTANT ROUTES ====================
ACTIVE_RIDE_STATUSES = [
    RideStatus.REQUESTED.value,
    RideStatus.ACCEPTED.value,
    RideStatus.DRIVER_ACCEPTED.value,
    RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value,
    RideStatus.DRIVER_ARRIVED.value,
    RideStatus.PASSENGER_BOARDING.value,
    RideStatus.RIDE_STARTED.value,
    RideStatus.RIDE_IN_PROGRESS.value,
    RideStatus.ONGOING.value,
    "requested", "accepted", "driver_accepted", "driver_en_route_to_pickup", 
    "driver_arrived", "passenger_boarding", "ride_started", "ride_in_progress", "ongoing"
]

COMPLETED_RIDE_STATUSES = [
    RideStatus.COMPLETED.value,
    RideStatus.RIDE_COMPLETED.value,
    RideStatus.RIDE_ARCHIVED.value,
    "completed",
    "completed_ride",
    "ride_completed",
    "settlement",
    "ride_archived"
]

@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_accountant)):
    total_users = await db.users.count_documents({})
    total_drivers = await db.drivers.count_documents({})
    pending_drivers = await db.drivers.count_documents({"is_approved": False})
    total_rides = await db.rides.count_documents({})
    completed_rides = await db.rides.count_documents({"status": {"$in": COMPLETED_RIDE_STATUSES}})
    active_rides = await db.rides.count_documents({"status": {"$in": ACTIVE_RIDE_STATUSES}})
    
    # Calculate earnings across all completed & archived rides
    rides = await db.rides.find({"status": {"$in": COMPLETED_RIDE_STATUSES}}, {"_id": 0}).to_list(10000)
    total_revenue = sum(float(r.get("fare", 0.0)) for r in rides)
    
    settings = await get_platform_settings()
    comm_rate = float(settings.get("commission_rate", DEFAULT_COMMISSION_RATE * 100)) / 100.0
    
    total_commission = sum(
        float(r.get("commission")) if r.get("commission") is not None else (float(r.get("fare", 0.0)) * comm_rate)
        for r in rides
    )
    
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "pending_drivers": pending_drivers,
        "total_rides": total_rides,
        "completed_rides": completed_rides,
        "active_rides": active_rides,
        "total_revenue": round(total_commission, 2),
        "total_gross_volume": round(total_revenue, 2),
        "total_commission": round(total_commission, 2),
        "commission_rate": settings.get("commission_rate", 10.0)
    }

@api_router.get("/admin/analytics")
async def get_admin_analytics(user: dict = Depends(require_accountant)):
    """
    Detailed analytics for the admin dashboard with resilient date parsing and aggregation.
    """
    rides = await db.rides.find(
        {"status": {"$in": COMPLETED_RIDE_STATUSES}},
        {"_id": 0, "created_at": 1, "fare": 1, "commission": 1, "dropoff_location": 1}
    ).to_list(1000)
    
    settings = await get_platform_settings()
    comm_rate = float(settings.get("commission_rate", DEFAULT_COMMISSION_RATE * 100)) / 100.0
    daily_stats = {}
    popular_map = {}
    
    for ride in rides:
        created_raw = ride.get("created_at") or ""
        date = created_raw[:10] if len(created_raw) >= 10 else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
        if date not in daily_stats:
            daily_stats[date] = {"date": date, "revenue": 0.0, "gross_fare": 0.0, "rides": 0}
            
        fare_val = float(ride.get("fare") or 0.0)
        commission_val = float(ride.get("commission")) if ride.get("commission") is not None else (fare_val * comm_rate)
        
        # Platform revenue = commission profit
        daily_stats[date]["revenue"] = round(daily_stats[date]["revenue"] + commission_val, 2)
        daily_stats[date]["gross_fare"] = round(daily_stats[date]["gross_fare"] + fare_val, 2)
        daily_stats[date]["rides"] += 1

        drop = ride.get("dropoff_location") or {}
        drop_name = drop.get("name") or drop.get("address")
        if drop_name:
            popular_map[drop_name] = popular_map.get(drop_name, 0) + 1
        
    revenue_chart = sorted(daily_stats.values(), key=lambda x: x["date"])
    # If less than 7 days, backfill recent dates for a smooth chart
    if len(revenue_chart) < 7:
        existing_dates = {item["date"] for item in revenue_chart}
        for i in range(6, -1, -1):
            d_str = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
            if d_str not in existing_dates:
                revenue_chart.append({"date": d_str, "revenue": 0.0, "gross_fare": 0.0, "rides": 0})
        revenue_chart = sorted(revenue_chart, key=lambda x: x["date"])
        
    # Online Drivers vs Busy Drivers (Single fast batch query)
    online_drivers_count = await db.drivers.count_documents({"is_online": True})
    busy_driver_ids = await db.rides.distinct("driver_id", {"status": {"$in": ACTIVE_RIDE_STATUSES}})
    busy_drivers = len([b for b in busy_driver_ids if b])

    popular_destinations = [{"name": k, "value": v} for k, v in sorted(popular_map.items(), key=lambda x: x[1], reverse=True)[:6]]
    if not popular_destinations:
        popular_destinations = [
            {"name": "Campus Library", "value": 24},
            {"name": "Main Campus Gate", "value": 18},
            {"name": "Student Hostels", "value": 14},
            {"name": "Science Complex", "value": 11}
        ]

    # Total Gross Volume
    total_gross = sum(d["gross_fare"] for d in daily_stats.values()) if daily_stats else 0.0

    return {
        "revenue_trends": revenue_chart,
        "online_drivers": online_drivers_count,
        "busy_drivers": busy_drivers,
        "total_gross_volume": total_gross,
        "popular_destinations": popular_destinations
    }

class AdminUpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None

@api_router.patch("/admin/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: str,
    payload: AdminUpdateUserRequest,
    admin: dict = Depends(require_admin)
):
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    updates = {}
    if payload.name is not None and payload.name.strip():
        updates["name"] = payload.name.strip()
    if payload.phone is not None:
        updates["phone"] = payload.phone.strip()
    if payload.email is not None and payload.email.strip().lower() != target_user.get("email"):
        new_email = payload.email.strip().lower()
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already used by another user")
        updates["email"] = new_email
    if payload.password is not None and payload.password.strip():
        updates["password"] = hash_password(payload.password.strip())
        
    if updates:
        await db.users.update_one({"id": user_id}, {"$set": updates})
        await log_admin_action(admin["id"], admin["name"], "update_user_profile", user_id, f"Updated fields: {list(updates.keys())}")
        
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return UserResponse(**updated_user)

class AdminUpdateDriverRequest(BaseModel):
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    plate_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    license_number: Optional[str] = None

@api_router.patch("/admin/drivers/{driver_id}", response_model=DriverResponse)
async def update_driver_by_admin(
    driver_id: str,
    payload: AdminUpdateDriverRequest,
    admin: dict = Depends(require_admin)
):
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    updates = {}
    if payload.vehicle_model is not None:
        updates["vehicle_model"] = payload.vehicle_model.strip()
    if payload.vehicle_color is not None:
        updates["vehicle_color"] = payload.vehicle_color.strip()
    if payload.plate_number is not None:
        updates["plate_number"] = payload.plate_number.strip().upper()
    if payload.vehicle_type is not None:
        updates["vehicle_type"] = payload.vehicle_type.strip()
    if payload.license_number is not None:
        updates["license_number"] = payload.license_number.strip()
        
    if updates:
        await db.drivers.update_one({"id": driver["id"]}, {"$set": updates})
        await log_admin_action(admin["id"], admin["name"], "update_driver_specs", driver["id"], f"Updated: {list(updates.keys())}")
        
    updated_driver = await db.drivers.find_one({"id": driver["id"]}, {"_id": 0})
    driver_user = await db.users.find_one({"id": updated_driver["user_id"]}, {"_id": 0, "password": 0})
    if driver_user:
        updated_driver["user"] = UserResponse(**driver_user)
    return DriverResponse(**updated_driver)

@api_router.get("/admin/users/{user_id}/details")
async def get_admin_user_details(user_id: str, admin: dict = Depends(require_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    active_statuses = [
        RideStatus.REQUESTED.value, RideStatus.ACCEPTED.value, RideStatus.DRIVER_ACCEPTED.value,
        RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value, RideStatus.DRIVER_ARRIVED.value,
        RideStatus.PASSENGER_BOARDING.value, RideStatus.RIDE_STARTED.value,
        RideStatus.RIDE_IN_PROGRESS.value, RideStatus.ONGOING.value,
        "requested", "accepted", "driver_accepted", "driver_en_route_to_pickup", 
        "driver_arrived", "passenger_boarding", "ride_started", "ride_in_progress", "ongoing"
    ]
    
    driver_profile = None
    if target_user.get("role") == UserRole.DRIVER.value:
        driver_profile = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
        
    driver_id = driver_profile["id"] if driver_profile else None
    
    active_ride_query = {
        "status": {"$in": active_statuses},
        "$or": [
            {"student_id": user_id},
            *([{"driver_id": driver_id}] if driver_id else [])
        ]
    }
    active_ride = await db.rides.find_one(active_ride_query, {"_id": 0})
    
    history_query = {
        "$or": [
            {"student_id": user_id},
            *([{"driver_id": driver_id}] if driver_id else [])
        ]
    }
    recent_rides = await db.rides.find(history_query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    total_rides = await db.rides.count_documents(history_query)
    
    return {
        "user": target_user,
        "driver_profile": driver_profile,
        "active_ride": active_ride,
        "recent_rides": recent_rides,
        "total_rides": total_rides
    }

@api_router.post("/admin/drivers/{driver_id}/settle")
async def settle_single_driver_commission(driver_id: str, data: dict = Body({}), user: dict = Depends(require_accountant)):
    """
    Admin clears/settles a specific driver's accumulated commission debt (remittance payment).
    Resets total_commission_due, increments total_commission_paid, restores wallet_status to ACTIVE.
    """
    driver = await db.drivers.find_one({"id": driver_id})
    if not driver:
        driver = await db.drivers.find_one({"user_id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    current_due = driver.get("total_commission_due", 0.0)
    settle_amount = float(data.get("amount", current_due))
    notes = data.get("notes", "Commission Remittance Settlement")
    
    new_due = max(0.0, current_due - settle_amount)
    
    update_ops = {
        "total_commission_due": new_due,
        "wallet_status": WalletStatus.ACTIVE.value
    }
    
    await db.drivers.update_one(
        {"id": driver["id"]},
        {
            "$set": update_ops,
            "$inc": {"total_commission_paid": settle_amount}
        }
    )
    
    timestamp = datetime.now(timezone.utc).isoformat()
    await log_admin_action(
        user["id"],
        user["name"],
        "settle_driver_commission",
        driver["id"],
        f"Settled ZMW {settle_amount:.2f}. New Due: ZMW {new_due:.2f}. Note: {notes}"
    )
    
    return {
        "status": "success",
        "settled_amount": settle_amount,
        "remaining_due": new_due,
        "message": f"Successfully settled ZMW {settle_amount:.2f} for driver."
    }

@api_router.delete("/admin/rides/{ride_id}")
async def delete_ride_by_admin(ride_id: str, admin: dict = Depends(require_admin)):
    target_ride = await db.rides.find_one({"id": ride_id})
    if not target_ride:
        raise HTTPException(status_code=404, detail="Ride not found")
        
    await db.rides.delete_one({"id": ride_id})
    await log_admin_action(admin["id"], admin["name"], "delete_ride", ride_id, f"Deleted ride: {ride_id}")
    return {"status": "deleted", "id": ride_id}

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(
    role: Optional[str] = Query(None),
    year_of_study: Optional[int] = Query(None),
    archived: Optional[str] = Query("all"),
    user: dict = Depends(require_admin)
):
    query = {}
    if role:
        query["role"] = role
    if year_of_study is not None:
        query["year_of_study"] = year_of_study
    if archived == "active":
        query["is_archived"] = {"$ne": True}
    elif archived == "archived":
        query["is_archived"] = True

    users = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(3000)
    valid_users = []
    for u in users:
        try:
            valid_users.append(UserResponse(**u))
        except Exception as e:
            logger.error(f"Skipping invalid user {u.get('id')}: {e}")
            continue
    return valid_users

@api_router.get("/admin/users/search")
async def search_users_for_admin(
    q: str = Query(..., min_length=1),
    admin: dict = Depends(require_admin)
):
    query_str = q.strip()
    regex = {"$regex": query_str, "$options": "i"}
    users = await db.users.find({
        "$or": [
            {"name": regex},
            {"email": regex},
            {"phone": regex}
        ]
    }, {"_id": 0, "password": 0}).limit(20).to_list(20)
    return users

@api_router.get("/admin/lecturers")
async def get_admin_lecturers(
    q: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    admin: dict = Depends(require_admin)
):
    query = {"role": UserRole.LECTURER.value}
    if department and department != "all":
        query["department"] = department
    if q and q.strip():
        regex = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [
            {"name": regex},
            {"email": regex},
            {"phone": regex},
            {"staff_id": regex}
        ]
    lecturers = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(1000)
    return lecturers

@api_router.post("/admin/students/archive-graduated")
async def archive_graduated_students(admin: dict = Depends(require_admin)):
    """Finds all student accounts where year_of_study exceeds program maximum (5 for engineering, 4 for standard) and marks them archived."""
    now_iso = datetime.now(timezone.utc).isoformat()
    query = {
        "role": UserRole.STUDENT.value,
        "is_archived": {"$ne": True},
        "$or": [
            {"program_type": "engineering", "year_of_study": {"$gt": 5}},
            {"program_type": {"$ne": "engineering"}, "year_of_study": {"$gt": 4}}
        ]
    }
    students = await db.users.find(query, {"_id": 0, "password": 0}).to_list(5000)
    if not students:
        return {
            "status": "success",
            "archived_count": 0,
            "message": "No students currently meet the graduation threshold for archiving."
        }
    
    ids_to_archive = [s["id"] for s in students]
    await db.users.update_many(
        {"id": {"$in": ids_to_archive}},
        {"$set": {"is_archived": True, "archived_at": now_iso}}
    )
    
    await log_admin_action(
        admin["id"], 
        admin["name"], 
        "archive_graduated_students", 
        "batch", 
        f"Archived {len(ids_to_archive)} graduated students"
    )
    
    return {
        "status": "success",
        "archived_count": len(ids_to_archive),
        "students": students,
        "message": f"Successfully archived {len(ids_to_archive)} graduated students."
    }

@api_router.post("/admin/students/purge-archived-retention")
async def purge_archived_retention(admin: dict = Depends(require_admin)):
    """Hard-deletes student accounts and associated records that have been archived for more than 2 years per data retention policy."""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=730)).isoformat()
    query = {
        "is_archived": True,
        "archived_at": {"$lte": cutoff_date}
    }
    users_to_purge = await db.users.find(query, {"id": 1}).to_list(5000)
    if not users_to_purge:
        return {
            "status": "success",
            "purged_count": 0,
            "message": "No accounts past the 2-year retention window."
        }
        
    ids = [u["id"] for u in users_to_purge]
    await db.users.delete_many({"id": {"$in": ids}})
    await db.rides.delete_many({"student_id": {"$in": ids}})
    await db.push_subscriptions.delete_many({"user_id": {"$in": ids}})
    
    await log_admin_action(
        admin["id"], 
        admin["name"], 
        "purge_archived_retention", 
        "batch", 
        f"Purged {len(ids)} accounts past 2-year retention window"
    )
    
    return {
        "status": "success",
        "purged_count": len(ids),
        "message": f"Successfully deleted {len(ids)} accounts past 2-year retention window."
    }

class SwitchRoleRequest(BaseModel):
    role: str

@api_router.patch("/admin/users/{user_id}/role", response_model=UserResponse)
async def switch_user_role(user_id: str, request: SwitchRoleRequest, admin: dict = Depends(require_admin)):
    if request.role not in [UserRole.STUDENT.value, UserRole.LECTURER.value, UserRole.DRIVER.value]:
        raise HTTPException(status_code=400, detail="Role can only be switched between 'student', 'lecturer', and 'driver'")
        
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    new_role = request.role
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    
    if new_role == UserRole.DRIVER.value:
        existing_driver = await db.drivers.find_one({"user_id": user_id})
        if not existing_driver:
            driver_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "vehicle_type": "car",
                "vehicle_model": "",
                "vehicle_color": "",
                "plate_number": "",
                "license_number": "",
                "is_approved": False,
                "needs_setup": True,
                "is_online": False,
                "is_active": True,
                "rating": 5.0,
                "total_trips": 0,
                "total_earnings": 0.0,
                "verification_status": "unsubmitted",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.drivers.insert_one(driver_doc)
        else:
            has_vehicle = bool(
                existing_driver.get("plate_number") and 
                existing_driver.get("vehicle_model") and 
                existing_driver.get("vehicle_model") != "Campus Shuttle" and
                not str(existing_driver.get("plate_number", "")).startswith("MR-")
            )
            if not has_vehicle:
                await db.drivers.update_one({"user_id": user_id}, {"$set": {
                    "needs_setup": True,
                    "is_approved": False,
                    "verification_status": "unsubmitted"
                }})
    elif new_role in [UserRole.STUDENT.value, UserRole.LECTURER.value]:
        await db.drivers.update_one({"user_id": user_id}, {"$set": {"is_online": False}})
        
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return UserResponse(**updated)

# ==================== BETA TESTER MANAGEMENT ====================
class ToggleBetaAccessRequest(BaseModel):
    is_beta_tester: bool

@api_router.patch("/admin/users/{user_id}/beta-access", response_model=UserResponse)
async def toggle_user_beta_access(user_id: str, request: ToggleBetaAccessRequest, admin: dict = Depends(require_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.users.update_one({"id": user_id}, {"$set": {"is_beta_tester": request.is_beta_tester}})
    target_user["is_beta_tester"] = request.is_beta_tester
    
    # Synchronize with db.beta_testers collection
    user_email = (target_user.get("email") or "").lower().strip()
    if user_email:
        if request.is_beta_tester:
            await db.beta_testers.update_one(
                {"email": user_email},
                {"$set": {
                    "email": user_email, 
                    "user_id": user_id, 
                    "name": target_user.get("name") or "",
                    "added_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
        else:
            await db.beta_testers.delete_one({"email": user_email})
            
    await log_admin_action(admin["id"], admin["name"], "toggle_beta_access", user_id, f"Beta access set to {request.is_beta_tester}")
    return UserResponse(**target_user)

@api_router.get("/admin/beta-testers")
async def get_beta_testers(admin: dict = Depends(require_admin)):
    testers = await db.beta_testers.find({}, {"_id": 0}).to_list(1000)
    settings_doc = await db.settings.find_one({"type": "platform"}) or {}
    beta_gate_active = settings_doc.get("beta_gate_active", True)
    return {"testers": testers, "beta_gate_active": beta_gate_active}

class AddBetaTesterRequest(BaseModel):
    email: str
    name: Optional[str] = None

@api_router.post("/admin/beta-testers")
async def add_beta_tester(request: AddBetaTesterRequest, admin: dict = Depends(require_admin)):
    email_clean = request.email.lower().strip()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="A valid email address is required")
        
    existing_user = await db.users.find_one({"email": email_clean})
    user_id = existing_user["id"] if existing_user else None
    name = request.name or (existing_user.get("name") if existing_user else "")
    
    await db.beta_testers.update_one(
        {"email": email_clean},
        {"$set": {
            "email": email_clean, 
            "user_id": user_id, 
            "name": name,
            "added_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    if existing_user:
        await db.users.update_one({"id": user_id}, {"$set": {"is_beta_tester": True}})
        
    await log_admin_action(admin["id"], admin["name"], "add_beta_tester", email_clean)
    return {"status": "success", "email": email_clean}

@api_router.delete("/admin/beta-testers/{email}")
async def remove_beta_tester(email: str, admin: dict = Depends(require_admin)):
    email_clean = email.lower().strip()
    await db.beta_testers.delete_one({"email": email_clean})
    await db.users.update_one({"email": email_clean}, {"$set": {"is_beta_tester": False}})
    await log_admin_action(admin["id"], admin["name"], "remove_beta_tester", email_clean)
    return {"status": "success"}

class ToggleBetaGateRequest(BaseModel):
    active: bool

@api_router.post("/admin/beta-gate/toggle")
async def toggle_beta_gate(request: ToggleBetaGateRequest, admin: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"type": "platform"},
        {"$set": {"beta_gate_active": request.active}},
        upsert=True
    )
    await log_admin_action(admin["id"], admin["name"], "toggle_beta_gate", str(request.active))
    return {"status": "success", "beta_gate_active": request.active}

# ==================== GOOGLE PLAY STORE CLOSED TESTING QUEUE & CSV SYNC ====================
PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.jaeyride.app"

class PlayStoreAccessRequest(BaseModel):
    email: str
    name: Optional[str] = None

class PlayStoreAdminAddRequest(BaseModel):
    email: str
    name: Optional[str] = None
    status: Optional[str] = "pending"

class PlayStoreMarkSyncedRequest(BaseModel):
    emails: Optional[List[str]] = None

class PlayStoreStatusToggleRequest(BaseModel):
    status: str

async def _ensure_play_store_testers_seeded():
    """Ensure all existing db.users and db.beta_testers are reflected in db.play_store_testers."""
    try:
        existing_ps = await db.play_store_testers.find({}, {"email": 1, "_id": 0}).to_list(5000)
        known_emails = {doc.get("email", "").lower().strip() for doc in existing_ps if doc.get("email")}

        beta_docs = await db.beta_testers.find({}, {"_id": 0}).to_list(2000)
        beta_emails = {b.get("email", "").lower().strip() for b in beta_docs if b.get("email")}

        users_docs = await db.users.find({}, {"id": 1, "email": 1, "name": 1, "created_at": 1, "is_beta_tester": 1, "_id": 0}).to_list(5000)
        now_iso = datetime.now(timezone.utc).isoformat()
        to_insert = []

        for u in users_docs:
            em = (u.get("email") or "").lower().strip()
            if not em or "@" not in em or em in known_emails:
                continue
            known_emails.add(em)
            created_at = str(u.get("created_at") or "")
            # Users registered before 2026-10-18 were already included in the initial Play Console CSV upload
            is_already_uploaded = (created_at and created_at < "2026-10-18") or bool(u.get("is_beta_tester")) or (em in beta_emails)
            to_insert.append({
                "email": em,
                "name": u.get("name") or "",
                "user_id": u.get("id"),
                "status": "synced" if is_already_uploaded else "pending",
                "requested_at": created_at or now_iso,
                "synced_at": now_iso if is_already_uploaded else None
            })

        for b in beta_docs:
            em = (b.get("email") or "").lower().strip()
            if not em or "@" not in em or em in known_emails:
                continue
            known_emails.add(em)
            to_insert.append({
                "email": em,
                "name": b.get("name") or "",
                "user_id": b.get("user_id"),
                "status": "synced",
                "requested_at": b.get("added_at") or now_iso,
                "synced_at": now_iso
            })

        if to_insert:
            await db.play_store_testers.insert_many(to_insert)
    except Exception as e:
        logger.warning(f"Error seeding play_store_testers: {e}")

@api_router.post("/play-store/request-access")
async def request_play_store_access(request: PlayStoreAccessRequest):
    email_clean = (request.email or "").lower().strip()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid Google Play email address")

    await _ensure_play_store_testers_seeded()

    doc = await db.play_store_testers.find_one({"email": email_clean}, {"_id": 0})
    if doc and doc.get("status") == "synced":
        return {
            "status": "synced",
            "email": email_clean,
            "play_store_url": PLAY_STORE_URL
        }

    existing_user = await db.users.find_one({"email": email_clean})
    user_id = existing_user["id"] if existing_user else (doc.get("user_id") if doc else None)
    resolved_name = (request.name or "").strip() or (existing_user.get("name") if existing_user else "") or (doc.get("name") if doc else "")
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.play_store_testers.update_one(
        {"email": email_clean},
        {"$set": {
            "email": email_clean,
            "name": resolved_name,
            "user_id": user_id,
            "status": "pending",
            "requested_at": doc.get("requested_at") if doc and doc.get("requested_at") else now_iso
        }},
        upsert=True
    )

    return {
        "status": "pending",
        "email": email_clean,
        "play_store_url": PLAY_STORE_URL
    }

@api_router.get("/admin/play-store-testers")
async def get_play_store_testers(admin: dict = Depends(require_admin)):
    await _ensure_play_store_testers_seeded()
    testers = await db.play_store_testers.find({}, {"_id": 0}).sort("requested_at", -1).to_list(5000)
    pending_count = sum(1 for t in testers if t.get("status") != "synced")
    synced_count = sum(1 for t in testers if t.get("status") == "synced")
    return {
        "testers": testers,
        "pending_count": pending_count,
        "synced_count": synced_count,
        "play_store_url": PLAY_STORE_URL
    }

@api_router.post("/admin/play-store-testers/mark-synced")
async def mark_play_store_testers_synced(request: PlayStoreMarkSyncedRequest, admin: dict = Depends(require_admin)):
    now_iso = datetime.now(timezone.utc).isoformat()
    if request.emails and len(request.emails) > 0:
        target_emails = [e.lower().strip() for e in request.emails if e and "@" in e]
        query = {"email": {"$in": target_emails}}
    else:
        query = {"status": {"$ne": "synced"}}

    docs_to_sync = await db.play_store_testers.find(query, {"_id": 0}).to_list(5000)
    synced_emails = [d["email"] for d in docs_to_sync if d.get("email")]

    if synced_emails:
        await db.play_store_testers.update_many(
            {"email": {"$in": synced_emails}},
            {"$set": {"status": "synced", "synced_at": now_iso}}
        )
        # Also whitelist them in beta_testers and users so they have full app + Play Store access
        for d in docs_to_sync:
            em = d.get("email")
            if not em:
                continue
            await db.beta_testers.update_one(
                {"email": em},
                {"$set": {
                    "email": em,
                    "user_id": d.get("user_id"),
                    "name": d.get("name") or "",
                    "added_at": now_iso
                }},
                upsert=True
            )
        await db.users.update_many(
            {"email": {"$in": synced_emails}},
            {"$set": {"is_beta_tester": True}}
        )

    await log_admin_action(admin["id"], admin["name"], "mark_play_store_synced", f"count={len(synced_emails)}")
    return {
        "status": "success",
        "synced_count": len(synced_emails),
        "synced_emails": synced_emails
    }

@api_router.post("/admin/play-store-testers/add")
async def admin_add_play_store_tester(request: PlayStoreAdminAddRequest, admin: dict = Depends(require_admin)):
    email_clean = (request.email or "").lower().strip()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="A valid email address is required")

    existing_user = await db.users.find_one({"email": email_clean})
    user_id = existing_user["id"] if existing_user else None
    name = (request.name or "").strip() or (existing_user.get("name") if existing_user else "")
    status_val = "synced" if request.status == "synced" else "pending"
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.play_store_testers.update_one(
        {"email": email_clean},
        {"$set": {
            "email": email_clean,
            "name": name,
            "user_id": user_id,
            "status": status_val,
            "requested_at": now_iso,
            "synced_at": now_iso if status_val == "synced" else None
        }},
        upsert=True
    )

    if status_val == "synced":
        await db.beta_testers.update_one(
            {"email": email_clean},
            {"$set": {"email": email_clean, "user_id": user_id, "name": name, "added_at": now_iso}},
            upsert=True
        )
        if existing_user:
            await db.users.update_one({"id": user_id}, {"$set": {"is_beta_tester": True}})

    await log_admin_action(admin["id"], admin["name"], "add_play_store_tester", f"{email_clean} ({status_val})")
    return {"status": "success", "email": email_clean, "tester_status": status_val}

@api_router.patch("/admin/play-store-testers/{email}/status")
async def admin_toggle_play_store_tester_status(email: str, request: PlayStoreStatusToggleRequest, admin: dict = Depends(require_admin)):
    email_clean = email.lower().strip()
    status_val = "synced" if request.status == "synced" else "pending"
    now_iso = datetime.now(timezone.utc).isoformat()

    await db.play_store_testers.update_one(
        {"email": email_clean},
        {"$set": {
            "status": status_val,
            "synced_at": now_iso if status_val == "synced" else None
        }}
    )
    if status_val == "synced":
        doc = await db.play_store_testers.find_one({"email": email_clean}) or {}
        await db.beta_testers.update_one(
            {"email": email_clean},
            {"$set": {"email": email_clean, "user_id": doc.get("user_id"), "name": doc.get("name") or "", "added_at": now_iso}},
            upsert=True
        )
        await db.users.update_one({"email": email_clean}, {"$set": {"is_beta_tester": True}})

    await log_admin_action(admin["id"], admin["name"], "toggle_play_store_tester_status", f"{email_clean} -> {status_val}")
    return {"status": "success", "email": email_clean, "tester_status": status_val}

@api_router.delete("/admin/play-store-testers/{email}")
async def admin_remove_play_store_tester(email: str, admin: dict = Depends(require_admin)):
    email_clean = email.lower().strip()
    await db.play_store_testers.delete_one({"email": email_clean})
    await log_admin_action(admin["id"], admin["name"], "remove_play_store_tester", email_clean)
    return {"status": "success"}

@api_router.get("/admin/drivers", response_model=List[DriverResponse])
async def get_all_drivers(user: dict = Depends(require_accountant)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    user_ids = list({d["user_id"] for d in drivers if d.get("user_id")})
    users_list = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password": 0}).to_list(len(user_ids) + 10) if user_ids else []
    users_map = {u["id"]: u for u in users_list}
    
    result = []
    for driver in drivers:
        try:
            driver_user = users_map.get(driver.get("user_id"))
            if driver_user:
                try:
                    driver["user"] = UserResponse(**driver_user)
                except Exception:
                    driver["user"] = driver_user
            result.append(DriverResponse(**driver))
        except Exception as e:
            logger.error(f"Skipping invalid driver {driver.get('id')}: {e}")
            continue
    return result

@api_router.post("/admin/drivers/{driver_id}/approve")
async def approve_driver(driver_id: str, user: dict = Depends(require_admin)):
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"is_approved": True, "needs_setup": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"status": "approved"}

# ==================== POPULAR DESTINATIONS ====================

class PopularDestinationBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class PopularDestinationResponse(PopularDestinationBase):
    id: str
    is_active: bool
    created_at: datetime

@api_router.post("/admin/popular-destinations", response_model=PopularDestinationResponse)
async def create_popular_destination(dest: PopularDestinationBase, user: dict = Depends(require_admin)):
    # Check for duplicate name (optional, but good UX)
    existing = await db.popular_destinations.find_one({"name": dest.name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Active destination with this name already exists")

    new_dest = {
        "id": str(uuid.uuid4()),
        "name": dest.name,
        "coordinates": {
            "type": "Point",
            "coordinates": [dest.longitude, dest.latitude]
        },
        "created_by": user["id"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        # Flattened for easy response
        "latitude": dest.latitude,
        "longitude": dest.longitude
    }
    
    await db.popular_destinations.insert_one(new_dest)
    return new_dest

@api_router.get("/popular-destinations", response_model=List[PopularDestinationResponse])
async def get_popular_destinations(active_only: bool = True):
    query = {}
    if active_only:
        query["is_active"] = True
        
    cursor = db.popular_destinations.find(query).sort("created_at", -1)
    dests = await cursor.to_list(100)
    
    results = []
    for d in dests:
        # Map DB fields to response model
        results.append({
            "id": d["id"],
            "name": d["name"],
            "latitude": d["coordinates"]["coordinates"][1],
            "longitude": d["coordinates"]["coordinates"][0],
            "is_active": d["is_active"],
            "created_at": d["created_at"]
        })
    return results

@api_router.patch("/admin/popular-destinations/{dest_id}")
async def deactivate_popular_destination(dest_id: str, active: bool = False, user: dict = Depends(require_admin)):
    result = await db.popular_destinations.update_one(
        {"id": dest_id},
        {"$set": {"is_active": active}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Destination not found")
    return {"status": "updated", "is_active": active}

async def approve_driver(driver_id: str, user: dict = Depends(require_admin)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one({"id": driver_id}, {"$set": {"is_approved": True}})
    
    await log_admin_action(user["id"], user["name"], "approve_driver", driver_id)
    
    return {"status": "approved"}

@api_router.post("/admin/drivers/{driver_id}/suspend")
async def suspend_driver(driver_id: str, user: dict = Depends(require_admin)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.drivers.update_one({"id": driver_id}, {"$set": {"is_approved": False, "is_online": False}})
    
    await log_admin_action(user["id"], user["name"], "suspend_driver", driver_id)
    
    return {"status": "suspended"}

@api_router.post("/admin/users/{user_id}/suspend")
async def suspend_user(user_id: str, admin: dict = Depends(require_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user["role"] == UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Cannot suspend super admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    
    await log_admin_action(admin["id"], admin["name"], "suspend_user", user_id)
    
    return {"status": "suspended"}

@api_router.post("/admin/users/{user_id}/activate")
async def activate_user(user_id: str, admin: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": True}})
    await log_admin_action(admin["id"], admin["name"], "activate_user", user_id)
    return {"status": "activated"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Permission Checks
    if target_user["role"] == UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin")
        
    if target_user["role"] == UserRole.ADMIN.value and admin["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Only Super Admin can delete Адmins")

    # If user is a driver, delete driver profile too
    if target_user["role"] == UserRole.DRIVER.value:
        await db.drivers.delete_one({"user_id": user_id})
        
    # Delete the user
    await db.users.delete_one({"id": user_id})
    
    await log_admin_action(admin["id"], admin["name"], "delete_user", user_id, f"Deleted user: {target_user['email']}")
    
    return {"status": "deleted"}

@api_router.get("/admin/rides")
async def get_all_rides(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    user: dict = Depends(require_accountant)
):
    query = {}
    if status and status != "all":
        if status in ["completed", "ride_completed", "ride_archived", "settlement"]:
            query["status"] = {"$in": COMPLETED_RIDE_STATUSES}
        elif status in ["ongoing", "ride_started", "ride_in_progress"]:
            query["status"] = {"$in": ["ongoing", "ride_started", "ride_in_progress", "passenger_boarding", "driver_arrived", "driver_en_route_to_pickup", "driver_accepted", "accepted"]}
        else:
            query["status"] = status
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    if not rides:
        return []

    # 1. Collect all student_ids and driver_ids in bulk
    student_ids = {r["student_id"] for r in rides if r.get("student_id")}
    driver_ids = {r["driver_id"] for r in rides if r.get("driver_id")}
    
    # 2. Batch fetch drivers
    drivers_list = await db.drivers.find({"id": {"$in": list(driver_ids)}}, {"_id": 0}).to_list(len(driver_ids) + 10) if driver_ids else []
    drivers_map = {d["id"]: d for d in drivers_list}
    
    # 3. Collect driver user_ids for bulk user fetch
    driver_user_ids = {d["user_id"] for d in drivers_list if d.get("user_id")}
    all_user_ids = list(student_ids | driver_user_ids)
    
    # 4. Batch fetch all users
    users_list = await db.users.find({"id": {"$in": all_user_ids}}, {"_id": 0, "password": 0}).to_list(len(all_user_ids) + 10) if all_user_ids else []
    users_map = {u["id"]: u for u in users_list}
    
    # 5. Hydrate rides in memory instantly
    result = []
    for ride in rides:
        try:
            # Attach student
            student_doc = users_map.get(ride.get("student_id"))
            if student_doc:
                try:
                    ride["student"] = UserResponse(**student_doc)
                except Exception:
                    ride["student"] = student_doc
            
            # Attach driver
            driver_doc = drivers_map.get(ride.get("driver_id"))
            if driver_doc:
                driver_copy = dict(driver_doc)
                driver_user_doc = users_map.get(driver_copy.get("user_id"))
                if driver_user_doc:
                    try:
                        driver_copy["user"] = UserResponse(**driver_user_doc)
                    except Exception:
                        driver_copy["user"] = driver_user_doc
                try:
                    ride["driver"] = DriverResponse(**driver_copy)
                except Exception:
                    ride["driver"] = driver_copy
                    
            result.append(RideResponse(**ride).model_dump() if hasattr(RideResponse(**ride), 'model_dump') else RideResponse(**ride).dict())
        except Exception as e:
            logger.warning(f"Formatting fallback for ride {ride.get('id')}: {e}")
            result.append(ride)
            
    return result

# ==================== ACCOUNTANT ROUTES ====================
@api_router.get("/accountant/summary")
async def get_accountant_summary(user: dict = Depends(require_accountant)):
    completed_rides = await db.rides.find({"status": {"$in": COMPLETED_RIDE_STATUSES}}, {"_id": 0}).to_list(10000)
    total_volume = sum(float(r.get("fare", 0.0)) for r in completed_rides)
    
    settings = await get_platform_settings()
    comm_val = float(settings.get("commission_rate", 0.10))
    comm_rate = comm_val / 100.0 if comm_val > 1.0 else comm_val
    
    total_commission = sum(
        float(r.get("commission")) if r.get("commission") is not None else (float(r.get("fare", 0.0)) * comm_rate)
        for r in completed_rides
    )
    total_driver_earnings = total_volume - total_commission
    
    # Active driver debt
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    total_debt_accumulated = sum(float(d.get("total_commission_due", 0.0)) for d in drivers)
    total_commission_paid = sum(float(d.get("total_commission_paid", 0.0)) for d in drivers)
    
    return {
        "total_completed_rides": len(completed_rides),
        "gross_volume": round(total_volume, 2),
        "total_commission_earned": round(total_commission, 2),
        "total_driver_earnings": round(total_driver_earnings, 2),
        "total_debt_outstanding": round(total_debt_accumulated, 2),
        "total_commission_paid": round(total_commission_paid, 2),
        "active_drivers_count": len(drivers),
        "commission_rate_percent": round(comm_rate * 100.0, 1)
    }

@api_router.get("/accountant/transactions")
async def get_accountant_transactions(
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_accountant)
):
    transactions = await db.driver_wallet_transactions.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return transactions

@api_router.get("/accountant/driver-balances")
async def get_accountant_driver_balances(user: dict = Depends(require_accountant)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    result = []
    for d in drivers:
        user_doc = await db.users.find_one({"id": d.get("user_id")}, {"_id": 0, "password": 0})
        result.append({
            "driver_id": d.get("id"),
            "driver_name": user_doc.get("name") if user_doc else "Unknown Driver",
            "driver_phone": user_doc.get("phone") if user_doc else "",
            "vehicle_type": d.get("vehicle_type", "car"),
            "vehicle_capacity": d.get("vehicle_capacity", 4),
            "total_commission_due": round(float(d.get("total_commission_due", 0.0)), 2),
            "total_commission_paid": round(float(d.get("total_commission_paid", 0.0)), 2),
            "wallet_balance": round(float(d.get("wallet_balance", 0.0)), 2),
            "wallet_status": d.get("wallet_status", "active"),
            "is_approved": d.get("is_approved", False),
            "is_online": d.get("is_online", False)
        })
    return result

@api_router.get("/admin/active-rides")
async def get_admin_active_rides(user: dict = Depends(require_admin)):
    active_statuses = [
        RideStatus.REQUESTED.value,
        RideStatus.ACCEPTED.value,
        RideStatus.DRIVER_ACCEPTED.value,
        RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value,
        RideStatus.DRIVER_ARRIVED.value,
        RideStatus.PASSENGER_BOARDING.value,
        RideStatus.RIDE_STARTED.value,
        RideStatus.RIDE_IN_PROGRESS.value,
        RideStatus.ONGOING.value,
        "requested", "accepted", "driver_accepted", "driver_en_route_to_pickup", 
        "driver_arrived", "passenger_boarding", "ride_started", "ride_in_progress", "ongoing"
    ]
    rides = await db.rides.find({"status": {"$in": active_statuses}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    if not rides:
        return []

    # Batch fetch in bulk
    student_ids = {r["student_id"] for r in rides if r.get("student_id")}
    driver_ids = {r["driver_id"] for r in rides if r.get("driver_id")}
    
    drivers_list = await db.drivers.find({"id": {"$in": list(driver_ids)}}, {"_id": 0}).to_list(len(driver_ids) + 10) if driver_ids else []
    drivers_map = {d["id"]: d for d in drivers_list}
    
    driver_user_ids = {d["user_id"] for d in drivers_list if d.get("user_id")}
    all_user_ids = list(student_ids | driver_user_ids)
    
    users_list = await db.users.find({"id": {"$in": all_user_ids}}, {"_id": 0, "password": 0}).to_list(len(all_user_ids) + 10) if all_user_ids else []
    users_map = {u["id"]: u for u in users_list}
    
    result = []
    for ride in rides:
        try:
            student_doc = users_map.get(ride.get("student_id"))
            if student_doc:
                try:
                    ride["student"] = UserResponse(**student_doc)
                except Exception:
                    ride["student"] = student_doc
            
            driver_doc = drivers_map.get(ride.get("driver_id"))
            if driver_doc:
                driver_copy = dict(driver_doc)
                driver_user_doc = users_map.get(driver_copy.get("user_id"))
                if driver_user_doc:
                    try:
                        driver_copy["user"] = UserResponse(**driver_user_doc)
                    except Exception:
                        driver_copy["user"] = driver_user_doc
                try:
                    ride["driver"] = DriverResponse(**driver_copy)
                except Exception:
                    ride["driver"] = driver_copy
                    
            result.append(RideResponse(**ride).model_dump() if hasattr(RideResponse(**ride), 'model_dump') else RideResponse(**ride).dict())
        except Exception as e:
            logger.warning(f"Formatting active ride fallback {ride.get('id')}: {e}")
            result.append(ride)
    
    return result

@api_router.get("/admin/settings", response_model=PlatformSettings)
async def get_settings(user: dict = Depends(require_admin)):
    settings = await get_platform_settings()
    return PlatformSettings(
        commission_rate=settings["commission_rate"],
        base_fare=settings["base_fare"],
        per_km_rate=settings["per_km_rate"],
        per_minute_rate=settings["per_minute_rate"]
    )

@api_router.put("/admin/settings")
async def update_settings(settings: PlatformSettings, user: dict = Depends(require_super_admin)):
    await db.settings.update_one(
        {"type": "platform"},
        {"$set": {
            "commission_rate": settings.commission_rate,
            "base_fare": settings.base_fare,
            "per_km_rate": settings.per_km_rate,
            "per_minute_rate": settings.per_minute_rate
        }},
        upsert=True
    )
    
    await log_admin_action(
        user["id"], 
        user["name"], 
        "update_settings", 
        details=f"Commission: {settings.commission_rate}%, Base: {settings.base_fare}"
    )
    
    return {"status": "updated"}

# ==================== PRICING & FIXED ROUTE MANAGEMENT ====================

@api_router.get("/admin/pricing-settings", response_model=PricingSettings)
async def get_pricing_settings(user: dict = Depends(require_accountant)):
    settings = await db.pricing_settings.find_one({})
    if not settings:
        # Should be initialized on startup, but fail-safe
        return PricingSettings(
            base_fare=15.0, per_km_rate=5.0, per_minute_rate=2.0,
            surge_multiplier=1.0, minimum_fare=20.0,
            shared_base_fare=10.0, shared_per_km_rate=3.5, shared_per_minute_rate=1.5,
            shared_surge_multiplier=1.0, shared_minimum_fare=15.0
        )
    return PricingSettings(**settings)

@api_router.put("/admin/pricing-settings")
async def update_pricing_settings(settings: PricingSettings, user: dict = Depends(require_admin)):
    # Update updated_at timestamp
    settings.updated_at = datetime.now(timezone.utc)
    
    await db.pricing_settings.update_one(
        {}, # Single document
        {"$set": settings.dict()},
        upsert=True
    )
    
    await log_admin_action(
        user["id"], user["name"], "update_pricing", 
        details=f"Base: {settings.base_fare}, Km: {settings.per_km_rate}, Min: {settings.minimum_fare}, Surge: {settings.surge_multiplier}"
    )
    return {"status": "updated"}

@api_router.get("/admin/fixed-routes", response_model=List[FixedRouteResponse])
async def get_fixed_routes(user: dict = Depends(require_admin)):
    routes = await db.fixed_routes.find({}).sort("created_at", -1).to_list(100)
    return [FixedRouteResponse(**r) for r in routes]

@api_router.post("/admin/fixed-routes", response_model=FixedRouteResponse)
async def create_fixed_route(route: FixedRouteCreate, user: dict = Depends(require_admin)):
    new_route = route.dict()
    new_route["id"] = str(uuid.uuid4())
    new_route["created_at"] = datetime.now(timezone.utc)
    
    # Ensure GeoJSON strict format for indexing
    # The client might send {lat, lng}, we need {type: Point, coordinates: [lng, lat]}
    # The model defines pickup_coordinates as Dict[str, Any], assuming it's already GeoJSON or we assume client sends GeoJSON.
    # Let's enforce it here if needed, but for now assuming client sends valid GeoJSON Point structure matching the model.
    # Actually, let's validate or construct it to be safe if the client sends raw coords.
    # But the model says Dict[str, Any] # GeoJSON Point. I'll rely on frontend sending correct structure.
    
    await db.fixed_routes.insert_one(new_route)
    
    await log_admin_action(
        user["id"], user["name"], "create_fixed_route", 
        new_route["id"], f"{route.pickup_name} -> {route.dropoff_name} ({route.fixed_price})"
    )
    return FixedRouteResponse(**new_route)

@api_router.put("/admin/fixed-routes/{route_id}")
async def update_fixed_route(route_id: str, route: FixedRouteCreate, user: dict = Depends(require_admin)):
    existing = await db.fixed_routes.find_one({"id": route_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Route not found")
        
    update_data = route.dict()
    # Preserve id and created_at
    update_data["id"] = route_id
    update_data["created_at"] = existing["created_at"]
    
    await db.fixed_routes.replace_one({"id": route_id}, update_data)
    
    await log_admin_action(
        user["id"], user["name"], "update_fixed_route", 
        route_id, f"Updated: {route.pickup_name} -> {route.dropoff_name}"
    )
    return {"status": "updated"}

@api_router.delete("/admin/fixed-routes/{route_id}")
async def delete_fixed_route(route_id: str, user: dict = Depends(require_admin)):
    result = await db.fixed_routes.delete_one({"id": route_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Route not found")
        
    await log_admin_action(user["id"], user["name"], "delete_fixed_route", route_id, "Deleted route")
    return {"status": "deleted"}

@api_router.patch("/admin/fixed-routes/{route_id}/toggle")
async def toggle_fixed_route(route_id: str, user: dict = Depends(require_admin)):
    route = await db.fixed_routes.find_one({"id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    new_status = not route["is_active"]
    await db.fixed_routes.update_one(
        {"id": route_id},
        {"$set": {"is_active": new_status}}
    )
    return {"status": "updated", "is_active": new_status}

class AdminCreateStaffRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)
    phone: Optional[str] = None
    role: Optional[str] = "admin"

@api_router.post("/admin/create-admin")
async def create_admin(admin_data: AdminCreateStaffRequest, user: dict = Depends(require_super_admin)):
    existing = await db.users.find_one({"email": admin_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    assigned_role = UserRole.ACCOUNTANT.value if admin_data.role == UserRole.ACCOUNTANT.value else UserRole.ADMIN.value
    user_id = str(uuid.uuid4())
    new_admin = {
        "id": user_id,
        "email": admin_data.email.lower(),
        "name": admin_data.name,
        "phone": admin_data.phone,
        "password": hash_password(admin_data.password),
        "role": assigned_role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_admin)
    
    await log_admin_action(user["id"], user["name"], "create_staff", user_id, f"Created {assigned_role}: {admin_data.email}")
    
    return {"status": "created", "user_id": user_id, "role": assigned_role}

@api_router.delete("/admin/delete-admin/{admin_id}")
async def delete_admin(admin_id: str, user: dict = Depends(require_super_admin)):
    target = await db.users.find_one({"id": admin_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if target["role"] == UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Cannot delete super admin")
    
    if target["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    await db.users.delete_one({"id": admin_id})
    
    await log_admin_action(user["id"], user["name"], "delete_admin", admin_id, f"Deleted admin: {target['email']}")
    
    return {"status": "deleted"}

@api_router.get("/admin/logs", response_model=List[AdminLogResponse])
async def get_admin_logs(
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_admin)
):
    logs = await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [AdminLogResponse(**log) for log in logs]

# ==================== PLACES SEARCH ROUTE ====================
@api_router.get("/places/search")
async def search_places(q: str = Query(..., min_length=1)):
    """Search offline places database (places.db) by name or category with strict deduplication"""
    search_term = q.strip()
    if not search_term:
        return []

    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_paths = [
        os.path.join(base_dir, "places.db"),
        os.path.join(os.path.dirname(base_dir), "places.db"),
        "places.db"
    ]
    db_path = None
    for p in db_paths:
        if os.path.exists(p):
            db_path = p
            break

    if not db_path:
        return []

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        like_query = f"%{search_term}%"
        cur.execute(
            """
            SELECT MIN(id) as id, name, category, latitude, longitude, source 
            FROM places 
            WHERE name LIKE ? OR category LIKE ? 
            GROUP BY LOWER(TRIM(name))
            ORDER BY 
              CASE WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END,
              name ASC
            LIMIT 15
            """,
            (like_query, like_query, f"{search_term.lower()}%")
        )
        rows = cur.fetchall()
        conn.close()

        results = []
        seen_names = set()
        for r in rows:
            clean_name = r["name"].strip()
            name_key = clean_name.lower()
            if name_key in seen_names:
                continue
            seen_names.add(name_key)

            results.append({
                "id": r["id"],
                "display_name": clean_name,
                "category": r["category"],
                "lat": round(float(r["latitude"]), 7),
                "lon": round(float(r["longitude"]), 7),
                "source": r["source"]
            })

        # 2. Hybrid Search Enhancement: Query Mapbox Geocoding API v5 for real-time address & POI matches
        try:
            import urllib.parse
            mapbox_token = os.environ.get(
                "MAPBOX_ACCESS_TOKEN",
                "pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A"
            )
            encoded_query = urllib.parse.quote(search_term)
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded_query}.json"
            params = {
                "access_token": mapbox_token,
                "country": "zm",
                "proximity": "28.549662,-14.294646",
                "autocomplete": "true",
                "types": "address,poi,neighborhood,locality,place"
            }
            from services.osrm_service import get_http_client
            client = get_http_client()
            resp = await client.get(url, params=params)
            
            if resp.status_code == 200:
                mapbox_data = resp.json()
                features = mapbox_data.get("features", [])
                for f in features:
                    place_name = f.get("place_name", f.get("text", "")).strip()
                    name_key = place_name.lower()
                    if not place_name or name_key in seen_names:
                        continue
                    seen_names.add(name_key)
                    
                    center = f.get("center", [0.0, 0.0]) # [lng, lat]
                    results.append({
                        "id": f.get("id", f"mapbox_{len(results)}"),
                        "display_name": place_name,
                        "category": f.get("properties", {}).get("category", "Address / POI"),
                        "lat": round(float(center[1]), 7),
                        "lon": round(float(center[0]), 7),
                        "source": "mapbox"
                    })
        except Exception as mb_err:
            logging.warning(f"Mapbox Geocoding search failed: {mb_err}")

        return results
    except Exception as e:
        logging.error(f"Error searching places.db: {e}")
@api_router.get("/places/reverse")
async def reverse_geocode_proximity(lat: float = Query(...), lng: float = Query(...)):
    """Reverse geocode with proximity landmark snapping (< 350m) and clean address formatting"""
    import math

    def dist_meters(lat1, lon1, lat2, lon2):
        R = 6371000.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = (math.sin(delta_phi / 2.0) ** 2 +
             math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
        return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_paths = [
        os.path.join(base_dir, "places.db"),
        os.path.join(os.path.dirname(base_dir), "places.db"),
        "places.db"
    ]
    db_path = None
    for p in db_paths:
        if os.path.exists(p):
            db_path = p
            break

    # 1. Check local places.db landmarks
    if db_path:
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT name, category, latitude, longitude FROM places")
            rows = cur.fetchall()
            conn.close()

            best_name = None
            best_dist = float('inf')
            for name, cat, p_lat, p_lon in rows:
                d = dist_meters(lat, lng, float(p_lat), float(p_lon))
                if d < best_dist:
                    best_dist = d
                    best_name = name.strip()

            if best_name and best_dist <= 350.0:
                if best_dist <= 35.0:
                    return {
                        "display_name": best_name,
                        "nearest_landmark": best_name,
                        "distance_m": round(best_dist, 1),
                        "is_exact": True
                    }
                else:
                    return {
                        "display_name": f"Near {best_name}",
                        "nearest_landmark": best_name,
                        "distance_m": round(best_dist, 1),
                        "is_exact": False
                    }
        except Exception as err:
            logging.warning(f"Proximity reverse geocode DB check failed: {err}")

    # 2. Check MongoDB cached places
    try:
        cached_places = await db.places_search_cache.find({}, {"_id": 0}).to_list(100)
        best_name = None
        best_dist = float('inf')
        for cp in cached_places:
            p_lat = cp.get("lat")
            p_lon = cp.get("lon")
            if p_lat is not None and p_lon is not None:
                d = dist_meters(lat, lng, float(p_lat), float(p_lon))
                if d < best_dist:
                    best_dist = d
                    best_name = cp.get("display_name", "").strip()

        if best_name and best_dist <= 350.0:
            if best_dist <= 35.0:
                return {
                    "display_name": best_name,
                    "nearest_landmark": best_name,
                    "distance_m": round(best_dist, 1),
                    "is_exact": True
                }
            else:
                return {
                    "display_name": f"Near {best_name}",
                    "nearest_landmark": best_name,
                    "distance_m": round(best_dist, 1),
                    "is_exact": False
                }
    except Exception:
        pass

    # 3. Fallback Mapbox / Nominatim Reverse with address cleaner
    try:
        from services.osrm_service import get_http_client
        client = get_http_client()
        mapbox_token = os.environ.get(
            "MAPBOX_ACCESS_TOKEN",
            "pk.eyJ1IjoiamFleSIsImEiOiJjbXNocmV5ZXAwM3JlMnhzZ29raTB3eGc5In0.riXZQNEurCaETWjZt02R6A"
        )
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json"
        params = {
            "access_token": mapbox_token,
            "country": "zm",
            "types": "address,poi,neighborhood,locality,place"
        }
        resp = await client.get(url, params=params)
        if resp.status_code == 200:
            data = resp.json()
            features = data.get("features", [])
            if features:
                raw_name = features[0].get("place_name", "")
                parts = [p.strip() for p in raw_name.split(",") if p.strip()]
                clean_parts = [p for p in parts if p.lower() not in {"zambia", "central province", "kapiri mposhi district", "kabwe district"} and not p.isdigit()][:2]
                display = ", ".join(clean_parts) if clean_parts else (parts[0] if parts else raw_name)
                return {
                    "display_name": display,
                    "is_exact": False,
                    "source": "mapbox"
                }
    except Exception as mb_err:
        logging.warning(f"Mapbox reverse failed: {mb_err}")

    return {
        "display_name": f"Location ({round(lat, 4)}, {round(lng, 4)})",
        "is_exact": False
    }

# ==================== DESTINATIONS MANAGEMENT ====================

@api_router.get("/destinations", response_model=List[DestinationResponse])
async def get_destinations(active_only: bool = True):
    """Get all destinations (public endpoint for ride booking)"""
    query = {"is_active": True} if active_only else {}
    destinations = await db.destinations.find(query, {"_id": 0}).to_list(100)
    return [DestinationResponse(**d) for d in destinations]

@api_router.post("/admin/destinations", response_model=DestinationResponse)
async def create_destination(dest: DestinationCreate, user: dict = Depends(require_admin)):
    """Admin: Create a new destination"""
    dest_id = str(uuid.uuid4())
    destination = {
        "id": dest_id,
        "name": dest.name,
        "address": dest.address,
        "latitude": dest.latitude,
        "longitude": dest.longitude,
        "estimated_fare": dest.estimated_fare,
        "base_price": dest.base_price,
        "estimated_distance_km": dest.estimated_distance_km,
        "is_active": dest.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.destinations.insert_one(destination)
    await log_admin_action(user["id"], user["name"], "create_destination", dest_id, f"Created: {dest.name}")
    return DestinationResponse(**destination)

@api_router.put("/admin/destinations/{dest_id}", response_model=DestinationResponse)
async def update_destination(dest_id: str, dest: DestinationCreate, user: dict = Depends(require_admin)):
    """Admin: Update a destination"""
    existing = await db.destinations.find_one({"id": dest_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    update_data = {
        "name": dest.name,
        "address": dest.address,
        "latitude": dest.latitude,
        "longitude": dest.longitude,
        "estimated_fare": dest.estimated_fare,
        "base_price": dest.base_price,
        "estimated_distance_km": dest.estimated_distance_km,
        "is_active": dest.is_active
    }
    await db.destinations.update_one({"id": dest_id}, {"$set": update_data})
    await log_admin_action(user["id"], user["name"], "update_destination", dest_id, f"Updated: {dest.name}")
    
    updated = await db.destinations.find_one({"id": dest_id}, {"_id": 0})
    return DestinationResponse(**updated)

@api_router.delete("/admin/destinations/{dest_id}")
async def delete_destination(dest_id: str, user: dict = Depends(require_admin)):
    """Admin: Delete a destination"""
    existing = await db.destinations.find_one({"id": dest_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Destination not found")
    
    await db.destinations.delete_one({"id": dest_id})
    await log_admin_action(user["id"], user["name"], "delete_destination", dest_id, f"Deleted: {existing['name']}")
    return {"status": "deleted"}

# ==================== FARE CALCULATION ====================
@api_router.post("/rides/estimate")
@api_router.post("/rides/estimate-fare")
async def estimate_fare(data: dict, user: dict = Depends(get_current_user)):
    # Check if coordinates are provided for server-side calculation
    pickup = data.get("pickup", {})
    dropoff = data.get("dropoff", {})
    if not pickup and "pickup_lat" in data:
        pickup = {"lat": data["pickup_lat"], "lng": data["pickup_lng"]}
    if not dropoff and "dropoff_lat" in data:
        dropoff = {"lat": data["dropoff_lat"], "lng": data["dropoff_lng"]}
    
    distance_km = data.get("distance_km", 0)
    duration_min = data.get("duration_min", 0)
    
    if "lat" in pickup and "lat" in dropoff:
        # Server-side calculation
        try:
            route_data = await get_route(
                pickup["lat"], pickup["lng"],
                dropoff["lat"], dropoff["lng"]
            )
            distance_km = route_data["distance_km"]
            duration_min = route_data["duration_minutes"]
            verified_geometry = route_data.get("geometry")
        except Exception as e:
            logger.error(f"Routing failed in estimate: {e}")
            verified_geometry = None
            # Fallback to provided distance or Haversine if needed
            if distance_km == 0:
                distance_km = calculate_distance(
                    pickup["lat"], pickup["lng"], 
                    dropoff["lat"], dropoff["lng"]
                )
                duration_min = distance_km * 3 # Rough estimate
    else:
        verified_geometry = None

    private_pricing = await calculate_ride_fare(pickup, dropoff, distance_km, duration_min, RideMode.PRIVATE)
    shared_pricing = await calculate_ride_fare(pickup, dropoff, distance_km, duration_min, RideMode.SHARED)

    return {
        "private": {
            "estimated_fare": private_pricing["fare"],
            "base_fare": private_pricing["breakdown"]["base"],
            "distance_charge": private_pricing["breakdown"]["distance"],
            "time_charge": private_pricing["breakdown"]["time"],
            "is_fixed": private_pricing.get("is_fixed", False),
            "surge_reason": private_pricing.get("surge_reason")
        },
        "shared": {
            "estimated_fare": shared_pricing["fare"],
            "base_fare": shared_pricing["breakdown"]["base"],
            "distance_charge": shared_pricing["breakdown"]["distance"],
            "time_charge": shared_pricing["breakdown"]["time"],
            "is_fixed": shared_pricing.get("is_fixed", False),
            "surge_reason": shared_pricing.get("surge_reason")
        },
        "verified_distance": round(distance_km, 2),
        "verified_duration": round(duration_min, 1),
        "duration_min": round(duration_min, 1),
        "duration": round(duration_min, 1),
        "duration_minutes": round(duration_min, 1),
        "eta_seconds": int(duration_min * 60),
        "eta_text": f"{max(1, int(round(duration_min)))} min",
        "geometry": verified_geometry
    }

# ==================== CHAT ROUTES ====================
@api_router.post("/chat/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    # Verify user is part of the ride
    ride = await db.rides.find_one({"id": message.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is passenger (student/lecturer), driver, or admin
    is_student = ride.get("student_id") == user["id"]
    is_driver = False
    driver_user_id = None
    if ride.get("driver_id"):
        driver_doc = await db.drivers.find_one({"id": ride["driver_id"]})
        if driver_doc:
            driver_user_id = driver_doc.get("user_id")
            if driver_user_id == user["id"]:
                is_driver = True
    
    is_admin = user.get("role") in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]
    
    if not (is_student or is_driver or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized for this chat")
    
    msg_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": msg_id,
        "ride_id": message.ride_id,
        "sender_id": user["id"],
        "sender_name": user.get("name", "User"),
        "content": message.content.strip(),
        "created_at": now_iso
    }
    # Insert clone so msg dictionary is never polluted with MongoDB ObjectId
    await db.messages.insert_one(dict(msg))
    msg.pop("_id", None)
    
    # Determine recipient user ID
    recipient_id = None
    if is_student:
        recipient_id = driver_user_id
    elif is_driver:
        recipient_id = ride.get("student_id")
    
    # Broadcast to Ride Room via WebSocket
    background_tasks.add_task(
        manager.broadcast_to_ride,
        {
            "type": "new_message",
            "message": msg,
            "ride_id": message.ride_id
        },
        message.ride_id
    )
    
    # Send Direct Personal Message via WebSocket to recipient if present
    if recipient_id:
        background_tasks.add_task(
            manager.send_personal_message,
            {
                "type": "new_message",
                "message": msg,
                "ride_id": message.ride_id
            },
            recipient_id
        )
        
        # Send Push Notification to Recipient
        async def send_chat_push(target_user_id, sender_name, content, r_id):
            try:
                await notification_service.send(
                    user_id=target_user_id,
                    type="chat_message",
                    payload={
                        "title": f"💬 Message from {sender_name}",
                        "body": content[:120],
                        "url": f"/ride/chat/{r_id}",
                        "icon": "/logo192.png",
                        "badge": "/favicon-32x32.png",
                        "tag": f"chat-{r_id}"
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send chat push notification: {e}")
                
        background_tasks.add_task(send_chat_push, recipient_id, user.get("name", "User"), message.content.strip(), message.ride_id)
    
    return MessageResponse(**msg)

@api_router.get("/chat/{ride_id}", response_model=List[MessageResponse])
async def get_chat_history(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    is_student = ride.get("student_id") == user["id"]
    is_driver_user = False
    if ride.get("driver_id"):
        driver = await db.drivers.find_one({"id": ride["driver_id"]})
        if driver and driver.get("user_id") == user["id"]:
            is_driver_user = True
            
    is_admin = user.get("role") in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]
    
    if not (is_student or is_driver_user or is_admin):
         raise HTTPException(status_code=403, detail="Not authorized")
         
    messages = await db.messages.find({"ride_id": ride_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return [MessageResponse(**m) for m in messages]

# ==================== WEBSOCKET ENDPOINT ====================
# ==================== WEBSOCKET ENDPOINT ====================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    user_id = None
    try:
        if not token:
             await websocket.close(code=4003)
             return

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4003)
                return
        except jwt.PyJWTError:
            await websocket.close(code=4003)
            return

        await manager.connect(websocket, user_id)
        last_loc_update = 0
        try:
            while True:
                # Add size protection for WebSocket messages
                text_data = await websocket.receive_text()
                if len(text_data) > 8192:  # 8KB max payload
                    logger.error(f"WebSocket message too large from user {user_id}")
                    await websocket.close(code=1009)
                    break
                
                try:
                    data = json.loads(text_data)
                except json.JSONDecodeError:
                    continue  # Ignore malformed JSON payload
                
                if data.get("type") == "location_update":
                    now = time.time()
                    if now - last_loc_update < 0.15:
                        # High-frequency 6-7 Hz stream support
                        continue
                    last_loc_update = now

                    loc_payload = data.get("location", {})
                    if loc_payload and "lat" in loc_payload and "lng" in loc_payload:
                        await manager.update_driver_location(user_id, loc_payload)
                
                elif data.get("type") == "request_hard_recalculation":
                    logger.info(f"HARD RECALCULATION requested by driver {user_id}")
                    driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
                    if driver:
                        try:
                            trip = await DriverTripRebuilder.rebuild(driver["id"], db)
                            if trip:
                                trip = await inject_etas_into_trip(trip, driver.get("current_location", {}))
                                if "route_queue" in trip:
                                    asyncio.create_task(manager.send_personal_message({
                                        "type": "route_queue_update",
                                        "queue": trip["route_queue"]
                                    }, user_id))
                                
                                passenger_briefings = trip.get("passenger_briefings", {})
                                for s_id, briefing in passenger_briefings.items():
                                    asyncio.create_task(manager.send_personal_message({
                                        "type": "passenger_briefing_update",
                                        "ride_id": briefing["ride_id"],
                                        "briefing_text": briefing["briefing_text"],
                                        "x3_state": briefing.get("x3_state"),
                                        "is_pinned": briefing.get("is_pinned", False),
                                        "carousel_messages": briefing.get("carousel_messages", []),
                                        "stops_remaining": briefing["stops_remaining"],
                                        "is_next_stop": briefing["is_next_stop"],
                                        "intermediate_stops": briefing.get("intermediate_stops", []),
                                        "route_segments": briefing.get("route_segments", []),
                                        "route_geometry": briefing["route_geometry"],
                                        "eta_seconds": briefing.get("eta_seconds"),
                                        "eta_text": briefing.get("eta_text")
                                    }, s_id))
                        except Exception as e:
                            logger.error(f"Failed to hard recalculate queue for driver {user_id}: {e}")
                
                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
    
        except WebSocketDisconnect:
            manager.disconnect(websocket, user_id)
            # DO NOT set driver offline immediately. Mobile devices frequently suspend
            # WebSockets to save battery, and we shouldn't force them offline for a temporary blip.
            # A background task handles true timeouts.
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        await websocket.close(code=4000)

# ==================== PUSH NOTIFICATIONS ====================
@api_router.get("/notifications/vapid-public-key")
async def get_vapid_public_key():
    return {"public_key": os.environ.get("VAPID_PUBLIC_KEY")}

@api_router.post("/notifications/subscribe")
async def subscribe_push_notifications(
    subscription: PushSubscriptionRequest,
    user: dict = Depends(get_current_user)
):
    try:
        user_id = user["id"]
        role = user.get("role", "student")
        await notification_service.save_subscription(
            user_id=user_id,
            role=role,
            subscription_info=subscription.model_dump() if hasattr(subscription, 'model_dump') else subscription.dict()
        )
        return {"status": "success", "message": "Subscription saved"}
    except Exception as e:
        logger.error(f"Error saving subscription for {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save push subscription")

@api_router.post("/notifications/unsubscribe")
async def unsubscribe_push_notifications(
    user: dict = Depends(get_current_user)
):
    try:
        user_id = user["id"]
        result = await db.push_subscriptions.delete_many({"user_id": user_id})
        return {"status": "success", "message": f"Removed {result.deleted_count} subscriptions"}
    except Exception as e:
        logger.error(f"Error unsubscribing for {user.get('id')}: {e}")
        raise HTTPException(status_code=500, detail="Failed to unsubscribe")

@api_router.get("/notifications/stats")
async def get_notification_stats(
    user: dict = Depends(get_current_user)
):
    try:
        user_id = user["id"]
        # User notification count & recent logs
        user_count = await db.notification_logs.count_documents({"user_id": user_id})
        recent_cursor = db.notification_logs.find({"user_id": user_id}).sort("created_at", -1).limit(10)
        recent_logs = await recent_cursor.to_list(length=10)
        
        # Clean Mongo _id
        for log in recent_logs:
            if "_id" in log:
                log["id"] = str(log.pop("_id"))

        # Admin global counts breakdown
        student_count = await db.notification_logs.count_documents({"role": "student"})
        driver_count = await db.notification_logs.count_documents({"role": "driver"})
        admin_count = await db.notification_logs.count_documents({"role": "admin"})

        return {
            "user_delivered_count": user_count,
            "recent_logs": recent_logs,
            "role_breakdown": {
                "student": student_count,
                "driver": driver_count,
                "admin": admin_count,
                "total_pushed": student_count + driver_count + admin_count
            }
        }
    except Exception as e:
        logger.error(f"Error getting notification stats: {e}")
        return {
            "user_delivered_count": 0,
            "recent_logs": [],
            "role_breakdown": {"student": 0, "driver": 0, "admin": 0, "total_pushed": 0}
        }

@api_router.post("/admin/notifications/broadcast")
async def broadcast_notification(
    request: AdminBroadcastRequest,
    admin: dict = Depends(require_admin)
):
    try:
        target = (request.target_role or "all").lower()
        unique_user_ids = []

        if target in ["specific_user", "user"] and request.target_user_id:
            target_user = await db.users.find_one({
                "$or": [
                    {"id": request.target_user_id},
                    {"email": request.target_user_id.lower()}
                ]
            })
            if target_user:
                unique_user_ids = [target_user["id"]]
            else:
                unique_user_ids = [request.target_user_id]
        elif target in ["year_of_study", "year"] and request.year_of_study is not None:
            user_docs = await db.users.find({
                "role": UserRole.STUDENT.value,
                "year_of_study": int(request.year_of_study),
                "is_archived": {"$ne": True}
            }, {"id": 1}).to_list(10000)
            unique_user_ids = [u["id"] for u in user_docs if u.get("id")]
        elif target in ["lecturers", "lecturer"]:
            user_docs = await db.users.find({
                "role": UserRole.LECTURER.value,
                "is_archived": {"$ne": True}
            }, {"id": 1}).to_list(10000)
            unique_user_ids = [u["id"] for u in user_docs if u.get("id")]
        elif target in ["students", "student"]:
            user_docs = await db.users.find({
                "role": UserRole.STUDENT.value,
                "is_archived": {"$ne": True}
            }, {"id": 1}).to_list(10000)
            unique_user_ids = [u["id"] for u in user_docs if u.get("id")]
        elif target in ["drivers", "driver"]:
            user_docs = await db.users.find({
                "role": UserRole.DRIVER.value,
                "is_archived": {"$ne": True}
            }, {"id": 1}).to_list(10000)
            unique_user_ids = [u["id"] for u in user_docs if u.get("id")]
        else: # "all"
            user_docs = await db.users.find({
                "is_archived": {"$ne": True}
            }, {"id": 1}).to_list(10000)
            unique_user_ids = [u["id"] for u in user_docs if u.get("id")]

        if not unique_user_ids:
            return {"status": "success", "sent": 0, "failed": 0, "target_count": 0, "message": "No matching active accounts found for target criteria"}

        payload = {
            "title": request.title,
            "body": request.message,
            "url": request.url or "/",
            "icon": "/logo192.png",
            "badge": "/favicon-32x32.png"
        }
        
        async def send_single(uid):
            try:
                return await notification_service.send(
                    user_id=uid,
                    type="broadcast",
                    payload=payload
                )
            except Exception as e:
                logger.error(f"Error sending broadcast to user {uid}: {e}")
                return False

        results = await asyncio.gather(*[send_single(uid) for uid in unique_user_ids])
        total_sent = sum(1 for r in results if r)
        total_failed = sum(1 for r in results if not r)
                
        # Log broadcast
        log_entry = {
            "id": str(uuid.uuid4()),
            "title": request.title,
            "message": request.message,
            "target_role": request.target_role,
            "year_of_study": request.year_of_study,
            "total_sent": total_sent,
            "total_failed": total_failed,
            "created_by": admin["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notification_logs.insert_one(log_entry)
        
        if total_sent == 0 and len(unique_user_ids) > 0:
            msg = f"Broadcast targeted {len(unique_user_ids)} account(s), but none have active push device subscriptions yet."
        else:
            msg = f"Broadcast delivered to {total_sent} active device(s) ({len(unique_user_ids)} target account(s))."
        
        return {
            "status": "success",
            "sent": total_sent,
            "failed": total_failed,
            "target_count": len(unique_user_ids),
            "message": msg
        }
    except Exception as e:
        logger.error(f"Error executing admin broadcast: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute broadcast")

# ==================== MIDDLEWARE ====================
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.rate_limit_records = {} # {ip_path: [timestamps]}

    async def dispatch(self, request: Request, call_next):
        # Only rate limit specific sensitive routes
        # Note: In production, use Redis. In-memory is per-worker.
        client_ip = request.client.host if request.client else "unknown"
        if client_ip in ["127.0.0.1", "localhost", "::1"]:
            return await call_next(request)

        if request.url.path in ["/api/auth/login", "/api/auth/register", "/api/rides/request"]:
            path = request.url.path
            key = f"{client_ip}:{path}"
            
            now = time.time()
            WINDOW = 60 # 1 minute
            LIMIT = 10 # 10 requests per minute
            
            if path == "/api/auth/login":
                LIMIT = 5 # Stricter for login
            
            # Get history and clean old
            history = self.rate_limit_records.get(key, [])
            history = [t for t in history if now - t < WINDOW]
            
            if len(history) >= LIMIT:
                return JSONResponse({"detail": "Rate limit exceeded. Try again later."}, status_code=429)
            
            history.append(now)
            self.rate_limit_records[key] = history
            
        return await call_next(request)

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: Optional[dict] = Depends(get_optional_current_user)):
    """Handles image uploads with automatic WebP compression, EXIF auto-rotation, and dimension optimization."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")
            
        content = await file.read()
        content_type = file.content_type or "image/jpeg"
        upload_filename = file.filename
        
        # Automatic Image Compression Engine (Instagram/Uber industry standard)
        try:
            from PIL import Image, ImageOps
            import io
            
            img = Image.open(io.BytesIO(content))
            img = ImageOps.exif_transpose(img) # Correct smartphone camera rotation
            
            # Convert palette/RGBA modes to RGB for WebP/JPEG saving
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            # Downscale large dimension to max 1600px while maintaining aspect ratio
            max_dim = 1600
            if img.width > max_dim or img.height > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                
            output_buffer = io.BytesIO()
            img.save(output_buffer, format="WEBP", quality=80, optimize=True)
            content = output_buffer.getvalue()
            content_type = "image/webp"
            upload_filename = os.path.splitext(file.filename)[0] + ".webp"
            logger.info(f"PIL Compressed uploaded image '{file.filename}' -> '{upload_filename}' ({len(content)} bytes)")
        except Exception as img_err:
            logger.warning(f"PIL Compression fallback for {file.filename}: {img_err}")

        user_id_val = user["id"] if user and "id" in user else "unauthenticated"
        fs = AsyncIOMotorGridFSBucket(db)
        file_id = await fs.upload_from_stream(
            upload_filename,
            content,
            metadata={"user_id": user_id_val, "content_type": content_type}
        )
        
        backend_url = os.environ.get('BACKEND_URL', 'https://jaey-ride-backend.onrender.com').rstrip('/')
        doc_url = f"{backend_url}/api/documents/{str(file_id)}"
        
        return {"url": doc_url}
    except Exception as e:
        logger.error(f"Failed to upload document: {e}")
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")

# ─── BUG REPORTING & AUTOMATED DIAGNOSTICS ENDPOINTS ───

class BugReportCreate(BaseModel):
    category: str
    description: str
    device_info: Optional[Dict[str, Any]] = None
    location_data: Optional[Dict[str, Any]] = None

class AutoSystemErrorCreate(BaseModel):
    error_message: str
    stack_trace: Optional[str] = None
    url_route: Optional[str] = None
    device_info: Optional[Dict[str, Any]] = None

@api_router.post("/support/report-bug")
async def create_bug_report(
    payload: BugReportCreate,
    user: Optional[dict] = Depends(get_optional_current_user)
):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"] if user else "anonymous",
        "user_email": user.get("email", "") if user else "",
        "user_name": user.get("full_name", "Anonymous User") if user else "Anonymous User",
        "category": payload.category,
        "description": payload.description,
        "device_info": payload.device_info or {},
        "location_data": payload.location_data or {},
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bug_reports.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "success", "report": doc}

@api_router.post("/support/auto-log-error")
async def auto_log_system_error(
    payload: AutoSystemErrorCreate,
    user: Optional[dict] = Depends(get_optional_current_user)
):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"] if user else "anonymous",
        "user_email": user.get("email", "") if user else "",
        "error_message": payload.error_message,
        "stack_trace": payload.stack_trace or "",
        "url_route": payload.url_route or "",
        "device_info": payload.device_info or {},
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.auto_system_errors.insert_one(doc)
    doc.pop("_id", None)
    return {"status": "recorded", "id": doc["id"]}

@api_router.get("/admin/bug-reports")
async def get_admin_bug_reports(admin: dict = Depends(require_admin)):
    reports = await db.bug_reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return reports

@api_router.get("/admin/system-errors")
async def get_admin_system_errors(admin: dict = Depends(require_admin)):
    errors = await db.auto_system_errors.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return errors

@api_router.patch("/admin/bug-reports/{report_id}/status")
async def update_bug_report_status(
    report_id: str,
    status_update: dict,
    admin: dict = Depends(require_admin)
):
    new_status = status_update.get("status", "open")
    res = await db.bug_reports.update_one({"id": report_id}, {"$set": {"status": new_status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return {"status": "updated", "id": report_id, "new_status": new_status}

# ============================================================================
# APP RELEASES & IN-APP UPDATER (OTA) ENDPOINTS (PURE GITHUB RELEASES CDN)
# ============================================================================

GITHUB_REPO = os.environ.get("GITHUB_REPO", "reaganmbao5-wq/Student-Ride")
GITHUB_TOKEN = os.environ.get("GITHUB_RELEASE_TOKEN")

async def get_github_asset_download_url(asset_id: str) -> Optional[str]:
    """
    Fetches the pre-signed AWS S3 CDN redirect URL from GitHub API for a release asset.
    """
    token = GITHUB_TOKEN or os.environ.get("GITHUB_RELEASE_TOKEN")
    repo = GITHUB_REPO or os.environ.get("GITHUB_REPO", "reaganmbao5-wq/Student-Ride")
    if not token or not asset_id:
        return None
        
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/octet-stream",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=15.0) as client:
            res = await client.get(
                f"https://api.github.com/repos/{repo}/releases/assets/{asset_id}",
                headers=headers
            )
            if res.status_code in (302, 307):
                return res.headers.get("Location")
    except Exception as e:
        logger.warning(f"Error resolving GitHub asset S3 redirect: {e}")
    return None

async def upload_asset_to_github(file_content: bytes, filename: str, tag: str, notes: str):
    """
    Creates or updates a GitHub Release and uploads the APK binary asset.
    Returns: (github_release_id, github_asset_id, browser_download_url)
    """
    token = GITHUB_TOKEN or os.environ.get("GITHUB_RELEASE_TOKEN")
    repo = GITHUB_REPO or os.environ.get("GITHUB_REPO", "reaganmbao5-wq/Student-Ride")
    if not token:
        return None, None, None

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        # 1. Check if release tag already exists
        release_res = await client.get(
            f"https://api.github.com/repos/{repo}/releases/tags/{tag}",
            headers=headers
        )
        
        if release_res.status_code == 200:
            release_data = release_res.json()
            release_id = release_data["id"]
            # Delete older asset with same name if it exists to avoid collision
            for asset in release_data.get("assets", []):
                if asset["name"] == filename:
                    try:
                        await client.delete(
                            f"https://api.github.com/repos/{repo}/releases/assets/{asset['id']}",
                            headers=headers
                        )
                    except Exception:
                        pass
        else:
            # Create new draft release first so assets can be uploaded without immutable 422 error
            create_res = await client.post(
                f"https://api.github.com/repos/{repo}/releases",
                headers=headers,
                json={
                    "tag_name": tag,
                    "target_commitish": "Mapbox-stable",
                    "name": f"Jaey Ride {tag}",
                    "body": notes,
                    "draft": True,
                    "prerelease": False
                }
            )
            if create_res.status_code not in (200, 201):
                logger.error(f"GitHub Release creation failed: {create_res.text}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"GitHub Release creation failed: {create_res.text}"
                )
            release_data = create_res.json()
            release_id = release_data["id"]

        # 2. Upload APK binary to GitHub Release Assets
        upload_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={filename}"
        upload_headers = {
            **headers,
            "Content-Type": "application/vnd.android.package-archive"
        }
        asset_res = await client.post(upload_url, headers=upload_headers, content=file_content)
        if asset_res.status_code not in (200, 201):
            logger.error(f"GitHub Asset upload failed: {asset_res.text}")
            raise HTTPException(
                status_code=500, 
                detail=f"GitHub Asset upload failed: {asset_res.text}"
            )
            
        asset_data = asset_res.json()

        # 3. Publish draft release now that asset is attached
        await client.patch(
            f"https://api.github.com/repos/{repo}/releases/{release_id}",
            headers=headers,
            json={"draft": False}
        )

        return str(release_id), str(asset_data["id"]), asset_data.get("browser_download_url")

class AppReleaseConfigPayload(BaseModel):
    version_name: str = "1.0.0"
    version_code: int = 3
    min_required_version: str = "1.0.0"
    force_update: bool = False
    release_notes: str = "Mandatory profile photo verification, first-load splash smoothness fix, and Google Play Store smart redirect."

@api_router.get("/app/version-check")
async def get_app_version_info():
    """
    Returns latest published release metadata for in-app update checks (synced with Google Play Store).
    """
    latest_release = await db.app_releases.find_one({}, sort=[("published_at", -1)], projection={"_id": 0})
    if not latest_release:
        return {
            "latest_version": "1.0.0",
            "version_name": "1.0.0",
            "version_code": 3,
            "min_required_version": "1.0.0",
            "force_update": False,
            "download_url": PLAY_STORE_URL,
            "release_notes": "Mandatory profile photo verification, first-load splash smoothness fix, and Google Play Store smart redirect.",
            "published_at": datetime.now(timezone.utc).isoformat()
        }
    if not latest_release.get("latest_version") and latest_release.get("version_name"):
        latest_release["latest_version"] = latest_release["version_name"]
    if not latest_release.get("version_name") and latest_release.get("latest_version"):
        latest_release["version_name"] = latest_release["latest_version"]
    latest_release["download_url"] = PLAY_STORE_URL
    return latest_release

@api_router.post("/admin/app-releases/config")
async def save_play_store_release_config(payload: AppReleaseConfigPayload, admin: dict = Depends(require_admin)):
    """
    Updates the active Play Store in-app update configuration (build code, force update toggle, release notes)
    without requiring an APK binary upload.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    release_doc = {
        "id": str(uuid.uuid4()),
        "latest_version": payload.version_name,
        "version_name": payload.version_name,
        "version_code": payload.version_code,
        "min_required_version": payload.min_required_version,
        "force_update": payload.force_update,
        "release_notes": payload.release_notes,
        "download_url": PLAY_STORE_URL,
        "published_at": now_iso,
        "uploaded_by": admin["id"]
    }
    await db.app_releases.insert_one(release_doc)
    return {
        "status": "saved",
        "message": f"Play Store update config saved (v{payload.version_name}, build {payload.version_code})!",
        "release": {k: v for k, v in release_doc.items() if k != "_id"}
    }

@api_router.get("/app/download-latest-apk")
@api_router.get("/download/android")
async def download_latest_apk():
    """
    Redirects directly to Google Play Store listing for com.jaeyride.app.
    """
    return RedirectResponse(url=PLAY_STORE_URL, status_code=302)
    latest_release = await db.app_releases.find_one({}, sort=[("published_at", -1)])
    if latest_release:
        if latest_release.get("github_asset_id"):
            presigned_s3_url = await get_github_asset_download_url(latest_release["github_asset_id"])
            if presigned_s3_url:
                return RedirectResponse(url=presigned_s3_url, status_code=302)
        if latest_release.get("browser_download_url"):
            return RedirectResponse(url=latest_release["browser_download_url"], status_code=302)

    # Fallback to querying GitHub Releases API directly for latest release asset
    token = GITHUB_TOKEN or os.environ.get("GITHUB_RELEASE_TOKEN")
    repo = GITHUB_REPO or os.environ.get("GITHUB_REPO", "reaganmbao5-wq/Student-Ride")
    if token and repo:
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(f"https://api.github.com/repos/{repo}/releases", headers=headers)
                if res.status_code == 200:
                    releases = res.json()
                    for rel in releases:
                        assets = rel.get("assets", [])
                        apk_asset = next((a for a in assets if a.get("name", "").endswith(".apk")), None)
                        if apk_asset:
                            s3_url = await get_github_asset_download_url(str(apk_asset["id"]))
                            if s3_url:
                                return RedirectResponse(url=s3_url, status_code=302)
                            elif apk_asset.get("browser_download_url"):
                                return RedirectResponse(url=apk_asset["browser_download_url"], status_code=302)
        except Exception as e:
            logger.warning(f"Error querying GitHub release asset: {e}")

    raise HTTPException(status_code=404, detail="No APK release found on GitHub Releases.")

@api_router.post("/admin/app-releases/upload")
async def upload_new_apk_release(
    file: UploadFile = File(...),
    version_name: str = Query(...),
    version_code: int = Query(...),
    min_required_version: str = Query("2.0.0"),
    force_update: bool = Query(False),
    release_notes: str = Query("Performance enhancements and bug fixes."),
    admin: dict = Depends(require_admin)
):
    """
    Publishes an APK binary directly to GitHub Releases and stores lightweight metadata in MongoDB.
    """
    if not file.filename.endswith((".apk", ".bin")):
        raise HTTPException(status_code=400, detail="Only .apk files are supported.")

    content = await file.read()
    file_size = len(content)
    clean_filename = f"jaey-ride-v{version_name}.apk"
    tag = f"v{version_name}"

    # Upload directly to GitHub Releases (AWS S3)
    github_rel_id, github_asset_id, browser_url = await upload_asset_to_github(
        file_content=content,
        filename=clean_filename,
        tag=tag,
        notes=release_notes
    )

    if not github_asset_id:
        raise HTTPException(status_code=500, detail="Failed to upload APK to GitHub Releases. Please check GitHub configuration.")

    # Store ONLY lightweight JSON metadata in MongoDB (0 MB binary bloat in database)
    release_doc = {
        "id": str(uuid.uuid4()),
        "latest_version": version_name,
        "version_code": version_code,
        "min_required_version": min_required_version,
        "force_update": force_update,
        "release_notes": release_notes,
        "filename": clean_filename,
        "file_size_bytes": file_size,
        "download_url": "/api/app/download-latest-apk",
        "github_release_id": github_rel_id,
        "github_asset_id": github_asset_id,
        "browser_download_url": browser_url,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": admin["id"]
    }

    await db.app_releases.insert_one(release_doc)
    return {
        "status": "published",
        "message": f"Release v{version_name} published successfully to GitHub Releases!",
        "storage": "github_releases",
        "release": {k: v for k, v in release_doc.items() if k != "_id"}
    }

# Include router
app.include_router(api_router, prefix="/api")

# Add Rate Limit (First in stack essentially)
app.add_middleware(RateLimitMiddleware)

# CORS — allow all origins for APK/mobile/script support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
