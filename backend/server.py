from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query, File, UploadFile, Response, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson import ObjectId
import os
import time
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
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
        
    cumulative_seconds = 0
    eta_dict = {} # Maps ride_id -> seconds
    
    for stop in route_queue:
        stop_lat = stop["coordinates"].get("lat")
        stop_lng = stop["coordinates"].get("lng")
        
        if stop_lat and stop_lng:
            leg_seconds = await calculate_eta(curr_lat, curr_lng, stop_lat, stop_lng)
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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'mulungushi_rides')]
notification_service = NotificationService(db)

# Resend API Configuration
resend.api_key = os.environ.get('RESEND_API_KEY')

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'mulungushi-rides-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 14  # 14 days

# Super Admin Email
SUPER_ADMIN_EMAIL = "Reaganmbao5@gmail.com"
DEFAULT_COMMISSION_RATE = 15.0

# Create the main app
sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", "https://fb662cce0aa16c927aedc2da33dff16a@o4511784708472832.ingest.de.sentry.io/4511785200844880"),
    integrations=[FastApiIntegration()],
    send_default_pii=True,
    traces_sample_rate=1.0,
    attach_stacktrace=True,
    include_local_variables=True
)

app = FastAPI(title="Mulungushi Rides API")

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
    "ride_in_progress", "arriving_destination", "ride_completed", "settlement"
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
    DRIVER = "driver"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

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
    id_token: str

class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    created_at: Optional[str] = None
    is_active: bool = True

class DriverProfile(BaseModel):
    vehicle_type: VehicleType
    plate_number: str
    vehicle_model: str
    vehicle_color: str
    vehicle_capacity: int = 4
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
    current_location: Optional[Dict[str, float]] = None
    wallet_balance: float = 0.0
    wallet_status: WalletStatus = WalletStatus.ACTIVE
    minimum_required_balance: float = 50.0
    total_commission_due: float = 0.0
    total_commission_paid: float = 0.0
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
    pickup_location: Dict[str, Any]
    dropoff_location: Dict[str, Any]
    status: RideStatus
    ride_mode: RideMode = RideMode.PRIVATE
    passenger_count: int = 1
    fare: float
    commission: float
    driver_earning: float
    distance: float
    duration: float
    verified_distance: Optional[float] = None
    verified_duration: Optional[float] = None
    verified_geometry: Optional[List[List[float]]] = None
    route_source: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None
    created_at: str
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
    base_fare: float = Field(..., gt=0)
    per_km_rate: float = Field(..., gt=0)
    per_minute_rate: float = Field(..., gt=0)
    surge_multiplier: float = Field(1.0, ge=1.0, le=5.0)
    minimum_fare: float = Field(..., gt=0)
    
    shared_base_fare: float = Field(10.0, gt=0)
    shared_per_km_rate: float = Field(3.5, gt=0)
    shared_per_minute_rate: float = Field(1.5, gt=0)
    shared_surge_multiplier: float = Field(1.0, ge=1.0, le=5.0)
    shared_minimum_fare: float = Field(15.0, gt=0)
    
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FixedRouteBase(BaseModel):
    pickup_name: str
    dropoff_name: str
    pickup_coordinates: Dict[str, Any] # GeoJSON Point
    dropoff_coordinates: Dict[str, Any] # GeoJSON Point
    tolerance_radius_meters: float = Field(..., ge=50, le=1000)
    fixed_price: float = Field(..., gt=0)
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
    target_role: str # "all", "student", "driver"

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
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role", UserRole.STUDENT.value)
    if role not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@api_router.get("/users/me", response_model=UserResponse)
async def get_current_user_profile(user: dict = Depends(get_current_user)):
    return user

class UpdateProfileRequest(BaseModel):
    phone: Optional[str] = None
    role: Optional[str] = None

@api_router.patch("/users/me")
async def update_my_profile(updates: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    """Let a user update their own phone number and optionally their role (student → driver)."""
    update_fields = {}
    if updates.phone is not None:
        update_fields["phone"] = updates.phone.strip()
    if updates.role in [UserRole.STUDENT.value, UserRole.DRIVER.value]:
        update_fields["role"] = updates.role
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update_fields})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return UserResponse(
        id=updated["id"],
        email=updated["email"],
        name=updated["name"],
        phone=updated.get("phone", ""),
        role=UserRole(updated["role"]),
        created_at=updated["created_at"],
        is_active=updated.get("is_active", True)
    )


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

async def get_platform_settings() -> dict:
    # Query the NEW pricing_settings collection
    settings = await db.pricing_settings.find_one({})
    
    # Also get commission rate from legacy/platform settings if needed, 
    # OR move commission to pricing_settings. Proper migration:
    # For now, let's keep commission in generic settings or migrate it.
    # The prompt asked for "pricing_settings" to have base_fare, etc.
    # It didn't explicitly say commission is there, but typically it is.
    # Let's fetch commission from old settings to be safe, or default.
    
    platform_settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    commission = DEFAULT_COMMISSION_RATE
    if platform_settings:
        commission = platform_settings.get("commission_rate", DEFAULT_COMMISSION_RATE)
        
    if not settings:
        return {
            "base_fare": 15.0,
            "per_km_rate": 5.0,
            "per_minute_rate": 2.0,
            "surge_multiplier": 1.0,
            "minimum_fare": 20.0,
            "commission_rate": commission,
            "updated_at": datetime.now(timezone.utc)
        }
    
    # Inject commission rate into the result so other parts of app don't break
    settings["commission_rate"] = commission
    return settings

async def calculate_ride_fare(pickup_loc: Dict[str, Any], dropoff_loc: Dict[str, Any], distance_km: float, duration_min: float, ride_mode: RideMode = RideMode.PRIVATE) -> Dict[str, Any]:
    """
    Centralized Pricing Engine.
    Hierarchy:
    1. Fixed Route (if match)
    2. Dynamic (Distance + Time) * Surge
    3. Minimum Fare Floor
    """
    
    # 1. Check Fixed Routes
    active_routes = await db.fixed_routes.find({"is_active": True}).to_list(100)
    
    pickup_point = (pickup_loc["lat"], pickup_loc["lng"])
    dropoff_point = (dropoff_loc["lat"], dropoff_loc["lng"])
    
    for route in active_routes:
        # Check Pickup
        # Ensure coordinates are extracted correctly from GeoJSON Point [lng, lat]
        r_p_lng = route["pickup_coordinates"]["coordinates"][0]
        r_p_lat = route["pickup_coordinates"]["coordinates"][1]
        
        r_d_lng = route["dropoff_coordinates"]["coordinates"][0]
        r_d_lat = route["dropoff_coordinates"]["coordinates"][1]
        
        p_dist = calculate_haversine_distance(
            pickup_point[0], pickup_point[1],
            r_p_lat, r_p_lng
        )
        # Check Dropoff
        d_dist = calculate_haversine_distance(
            dropoff_point[0], dropoff_point[1],
            r_d_lat, r_d_lng
        )
        
        # Convert tolerance to km
        tolerance_km = route["tolerance_radius_meters"] / 1000.0
        
        if p_dist <= tolerance_km and d_dist <= tolerance_km:
            logger.info(f"Fixed Route Match: {route['pickup_name']} -> {route['dropoff_name']}")
            return {
                "fare": route["fixed_price"],
                "is_fixed": True,
                "route_name": f"{route['pickup_name']} to {route['dropoff_name']}",
                "breakdown": {
                    "base": 0,
                    "distance": 0,
                    "time": 0,
                    "surge": 0
                }
            }

    # 2. Dynamic Pricing
    settings = await get_platform_settings()
    
    if ride_mode == RideMode.SHARED:
        base_fare = settings.get("shared_base_fare", settings.get("base_fare", 15.0) * 0.7)
        per_km = settings.get("shared_per_km_rate", settings.get("per_km_rate", 5.0) * 0.7)
        per_min = settings.get("shared_per_minute_rate", settings.get("per_minute_rate", 2.0) * 0.7)
        surge = settings.get("shared_surge_multiplier", settings.get("surge_multiplier", 1.0))
        min_fare = settings.get("shared_minimum_fare", settings.get("minimum_fare", 20.0) * 0.7)
    else:
        base_fare = settings.get("base_fare", 15.0)
        per_km = settings.get("per_km_rate", 5.0)
        per_min = settings.get("per_minute_rate", 2.0)
        surge = settings.get("surge_multiplier", 1.0)
        min_fare = settings.get("minimum_fare", 20.0)
    
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
    
    final_fare = max(surge_total, min_fare)
    final_fare = round(final_fare, 2)
    
    return {
        "fare": final_fare,
        "is_fixed": False,
        "route_name": "Standard Ride",
        "surge_reason": surge_reason,
        "breakdown": {
            "base": base_fare,
            "distance": round(dist_cost, 2),
            "time": round(time_cost, 2),
            "surge_multiplier": surge,
            "min_fare_applied": final_fare == min_fare
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
        self.ride_connections: Dict[str, List[str]] = {}  # ride_id -> [user_ids]

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected via WebSocket. Total connections: {len(self.active_connections[user_id])}")

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
        self.driver_last_active[driver_id] = time.time()
        logger.info(f"Updating location for driver {driver_id}: {location}")
        
        # Create GeoJSON point
        # MongoDB expects [longitude, latitude]
        geo_location = {
            "type": "Point",
            "coordinates": [location["lng"], location["lat"]]
        }
        
        # Update temporary location table with TTL
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
        
        # Also update drivers collection
        driver = await db.drivers.find_one_and_update(
            {"user_id": driver_id},
            {"$set": {
                "current_location": location,
                "location": geo_location
            }}
        )
        
        # Broadcast to student if driver is in an active ride
        if driver:
            active_rides = await db.rides.find({
                "driver_id": driver["id"],
                "status": {"$in": [
                    RideStatus.DRIVER_ACCEPTED.value,
                    RideStatus.DRIVER_EN_ROUTE_TO_PICKUP.value,
                    RideStatus.DRIVER_ARRIVED.value,
                    RideStatus.PASSENGER_BOARDING.value,
                    RideStatus.RIDE_STARTED.value,
                    RideStatus.RIDE_IN_PROGRESS.value,
                    RideStatus.ARRIVING_DESTINATION.value,
                    # Legacy fallback
                    RideStatus.ACCEPTED.value,
                    RideStatus.ONGOING.value
                ]}
            }, {"_id": 0}).to_list(None)
            
            if active_rides:
                # Broadcast location to all students in an active ride with this driver
                for active_ride in active_rides:
                    await self.send_personal_message({
                        "type": "driver_location",
                        "lat": location["lat"],
                        "lng": location["lng"],
                        "heading": location.get("heading", 0),
                        "ride_id": active_ride["id"]
                    }, active_ride["student_id"])
                
                # Broadcast back to the driver so their own map moves during simulation
                await self.send_personal_message({
                    "type": "driver_location",
                    "lat": location["lat"],
                    "lng": location["lng"],
                    "heading": location.get("heading", 0),
                    "ride_id": active_rides[0]["id"]
                }, driver["user_id"])

                # Phase X: Re-calculate passenger briefing and clipped geometry on location updates
                try:
                    trip = await DriverTripRebuilder.rebuild(driver["id"], db)
                    trip = await inject_etas_into_trip(trip, location)
                    if trip and "passenger_briefings" in trip:
                        for s_id, briefing in trip["passenger_briefings"].items():
                            await self.send_personal_message({
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
                            }, s_id)
                except Exception as ex:
                    logger.error(f"Failed to update passenger briefings on driver location update: {ex}")

    async def broadcast_to_nearby_drivers(self, message: dict, location: dict, radius_km: float = 3.0):
        """Broadcast ride request to nearby online drivers using geospatial query"""
        try:
            # Guard: if location is missing or not a dict, skip geo query and go straight to fallback
            if not location or not isinstance(location, dict):
                logger.warning(f"broadcast_to_nearby_drivers called with invalid location ({location!r}) for message type '{message.get('type')}'. Using all-online-drivers fallback.")
                online_drivers = await db.drivers.find({
                    "is_online": True,
                    "is_approved": True,
                    "wallet_status": {"$ne": WalletStatus.RESTRICTED.value}
                }, {"_id": 0}).to_list(50)
            else:
                max_distance_meters = radius_km * 1000
                logger.info(f"Broadcasting '{message.get('type')}' to drivers near {location} within {radius_km}km")

                loc_lng = float(location.get("lng", location.get("longitude", 0)))
                loc_lat = float(location.get("lat", location.get("latitude", 0)))

                try:
                    online_drivers = await db.drivers.find({
                        "is_online": True,
                        "is_approved": True,
                        "wallet_status": {"$ne": WalletStatus.RESTRICTED.value},
                        "location": {
                            "$near": {
                                "$geometry": {
                                    "type": "Point",
                                    "coordinates": [loc_lng, loc_lat]
                                },
                                "$maxDistance": max_distance_meters
                            }
                        }
                    }, {"_id": 0}).to_list(20)
                except Exception as geo_err:
                    logger.warning(f"Geospatial $near query failed: {geo_err}. Falling back to all online drivers.")
                    online_drivers = []

                if not online_drivers:
                    online_drivers = await db.drivers.find({
                        "is_online": True,
                        "is_approved": True,
                        "wallet_status": {"$ne": WalletStatus.RESTRICTED.value}
                    }, {"_id": 0}).to_list(50)

            ride = message.get("ride", {})
            ride_mode = ride.get("ride_mode", "private")
            passenger_count = ride.get("passenger_count", 1)
            
            eligible_drivers = []
            for driver in online_drivers:
                d_id = driver.get("user_id") or driver.get("id")
                active_state = await get_driver_active_state(d_id)
                eligibility = is_driver_eligible(driver, active_state, ride_mode, passenger_count)
                if eligibility["eligible"]:
                    eligible_drivers.append(driver)
                    
            logger.info(f"Found {len(eligible_drivers)} eligible nearby drivers for location {location}")
            
            delivered_count = 0
            for driver in eligible_drivers:
                candidate_ids = list(set([driver.get("user_id"), driver.get("id"), driver.get("driver_id")]))
                candidate_ids = [cid for cid in candidate_ids if cid]
                
                for cid in candidate_ids:
                    if cid in self.active_connections:
                        try:
                            await self.send_personal_message(message, cid)
                            logger.info(f"Broadcast sent to driver {cid}")
                            delivered_count += 1
                            break
                        except Exception as e:
                            logger.error(f"Failed to send broadcast to driver {cid}: {e}")

            # Safety Fallback: If targeted lookup missed or delivered to zero drivers, broadcast to all active connections
            if delivered_count == 0:
                logger.info("Targeted lookup delivered to 0 active connections. Executing fallback broadcast to all active WebSockets.")
                sanitized = sanitize_for_json(message)
                for user_id, sockets in list(self.active_connections.items()):
                    for ws in sockets:
                        try:
                            await ws.send_json(sanitized)
                            delivered_count += 1
                        except Exception as ex:
                            logger.error(f"Failed to send fallback broadcast to {user_id}: {ex}")
                logger.info(f"Fallback broadcast delivered to {delivered_count} active WebSocket connections.")

        except Exception as top_err:
            logger.error(f"broadcast_to_nearby_drivers FATAL ERROR for message type '{message.get('type')}': {top_err}", exc_info=True)

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
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email.lower(),
        "name": user_data.name,
        "phone": user_data.phone,
        "password": hash_password(user_data.password),
        "role": role.value,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    # Generate token
    token = create_token(user_id, role.value)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            name=user["name"],
            phone=user["phone"],
            role=role,
            created_at=user["created_at"],
            is_active=True
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended")
    
    token = create_token(user["id"], user["role"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            phone=user["phone"],
            role=UserRole(user["role"]),
            created_at=user["created_at"],
            is_active=user.get("is_active", True)
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        phone=user["phone"],
        role=UserRole(user["role"]),
        created_at=user["created_at"],
        is_active=user.get("is_active", True)
    )

@api_router.get("/auth/password-reset/redirect")
async def password_reset_redirect(token: str):
    """Redirects to the frontend reset page. Using the backend domain helps bypass PWA deep linking issues."""
    frontend_url = os.environ.get("REACT_APP_FRONTEND_URL", "https://mulungushistudentride.site")
    return RedirectResponse(url=f"{frontend_url}/reset-password?token={token}")

@api_router.post("/auth/password-reset/request")
async def request_password_reset(request: PasswordResetRequest):
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
        {"$set": {"reset_token": hashed_token, "reset_token_expires": expires_at.isoformat()}}
    )
    
    try:
        backend_url = os.environ.get('BACKEND_URL', 'https://student-ride-backend-manual.onrender.com').rstrip('/')
        reset_link = f"{backend_url}/api/auth/password-reset/redirect?token={reset_token}"
        
        from_email = os.environ.get("RESEND_FROM_EMAIL", "noreply@mulungushistudentride.site")
        
        # If we are using the test address, we cannot use a display name wrapper (e.g. MuluRides <...>)
        # Resend strictly validates this.
        sender = from_email if "onboarding@resend.dev" in from_email else f"MuluRides <{from_email}>"
        
        email_params = {
            "from": sender,
            "to": [user["email"]],
            "subject": "Reset your MuluRides Password",
            "html": f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Password Reset Request</h2>
                <p>Hello {user.get('name', 'User')},</p>
                <p>We received a request to reset your password. Click the button below to choose a new password:</p>
                <a href="{reset_link}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; margin: 20px 0;">Reset Password</a>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>This link will expire in 1 hour.</p>
                <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 30px;"/>
                <p style="font-size: 12px; color: #888;">MuluRides Support Team</p>
            </div>
            """
        }
        resend.Emails.send(email_params)
        logger.info(f"Password reset email sent to {user['email']}")
    except Exception as e:
        logger.error(f"Failed to send password reset email: {e}")
        # We don't fail the request so we don't leak user existence
    
    return {"status": "success", "message": "If an account with that email exists, a password reset link has been sent."}

@api_router.post("/auth/password-reset/confirm")
async def confirm_password_reset(request: PasswordResetConfirm):
    import base64
    
    try:
        if "." not in request.token:
            raise ValueError()
        b64_uid, _ = request.token.split(".", 1)
        # Add padding back if necessary
        padding = "=" * (4 - (len(b64_uid) % 4))
        user_id = base64.urlsafe_b64decode(b64_uid + padding).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token format")
        
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("reset_token") or not user.get("reset_token_expires"):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    # Check expiry
    expires_at = datetime.fromisoformat(user["reset_token_expires"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
        
    # Verify hash
    if not verify_password(request.token, user["reset_token"]):
        raise HTTPException(status_code=400, detail="Invalid reset token")
        
    # Update password
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {"password": hashed_password},
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )
    
    return {"status": "success", "message": "Password successfully reset"}

@api_router.post("/auth/google")
async def google_login(request: GoogleLoginRequest):
    try:
        # Verify the ID token with Google
        idinfo = id_token.verify_oauth2_token(
            request.id_token, google_requests.Request(), GOOGLE_CLIENT_ID
        )

        email = idinfo.get("email")
        name = idinfo.get("name")

        if not email:
            raise HTTPException(status_code=400, detail="No email provided by Google")

        # Check if user exists
        user = await db.users.find_one({"email": email.lower()}, {"_id": 0})
        is_new_user = False
        
        if not user:
            is_new_user = True
            # Create a new user account automatically
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email.lower(),
                "name": name,
                "phone": "",  # Google doesn't provide phone number by default
                "password": hash_password(secrets.token_urlsafe(32)), # Random unusable password
                "role": UserRole.STUDENT.value,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)

        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account suspended")

        # Check if driver profile is complete
        driver_profile_complete = False
        if user.get("role") == UserRole.DRIVER.value:
            profile = await db.drivers.find_one({"user_id": user["id"]})
            # A profile is "complete" if it exists and has verification status set (even if pending)
            if profile:
                driver_profile_complete = True

        # Generate JWT token
        token = create_token(user["id"], user["role"])
        
        return {
            "access_token": token,
            "is_new_user": is_new_user,
            "driver_profile_complete": driver_profile_complete,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "phone": user["phone"],
                "role": user["role"],
                "created_at": user["created_at"],
                "is_active": user.get("is_active", True)
            }
        }

    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")

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
    radius_km: float = Query(3.0, ge=0.5, le=20.0),
    user: dict = Depends(get_current_user)
):
    """
    Fetch nearby AVAILABLE drivers for the pickup map.
    Filters: Online, Approved, Active Wallet, Not in Ride.
    Limit: 20 drivers.
    """
    nearby_driver_ids = []
    
    # TRICK 1 - CACHE: Check memory cache first
    now = time.time()
    for driver_id, loc in list(manager.driver_locations.items()):
        # TRICK 4: Driver Activity Check
        last_active = manager.driver_last_active.get(driver_id, 0)
        if now - last_active > 600:
            manager.driver_locations.pop(driver_id, None)
            async def set_offline(uid):
                await db.drivers.update_one({"user_id": uid}, {"$set": {"is_online": False}})
            asyncio.create_task(set_offline(driver_id))
            continue
            
        if loc and "lat" in loc and "lng" in loc:
            dist = calculate_haversine_distance(latitude, longitude, loc["lat"], loc["lng"])
            if dist <= radius_km:
                nearby_driver_ids.append(driver_id)
                
    results = []
    
    # If cache is populated, fetch their statuses from main DB directly
    if nearby_driver_ids:
        online_drivers = await db.drivers.find({
            "user_id": {"$in": nearby_driver_ids},
            "is_online": True,
            "is_approved": True,
            "wallet_status": {"$ne": WalletStatus.RESTRICTED.value}
        }).to_list(100)
    else:
        # Fallback to DB geospatial query if cache empty
        max_distance_meters = radius_km * 1000
        online_drivers = await db.drivers.find({
            "is_online": True,
            "is_approved": True,
            "wallet_status": {"$ne": WalletStatus.RESTRICTED.value},
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [longitude, latitude]
                    },
                    "$maxDistance": max_distance_meters
                }
            }
        }).to_list(20)
        
    for d in online_drivers:
        driver_id = d["user_id"]
        
        # DISPATCH MATCHING RULES via centralized source of truth
        active_state = await get_driver_active_state(d["id"])
        eligibility = is_driver_eligible(d, active_state)
        
        if not eligibility["visibility"]:
            continue
            
        # Prefer cache location as it's more realtime
        loc = manager.driver_locations.get(driver_id) or d.get("current_location", {})
        lat = loc.get("lat")
        lng = loc.get("lng")
        heading = loc.get("heading", 0.0)
        
        if lat is not None and lng is not None:
            results.append(NearbyDriverResponse(
                id=driver_id,
                latitude=lat,
                longitude=lng,
                heading=heading,
                vehicle_type=d.get("vehicle_type", VehicleType.CAR)
            ))
            
    return results

@api_router.post("/drivers/register", response_model=DriverResponse)
async def register_driver(profile: DriverProfile, user: dict = Depends(get_current_user)):
    # Check if already a driver
    existing = await db.drivers.find_one({"user_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Already registered as driver")
    
    driver_id = str(uuid.uuid4())
    driver = {
        "id": driver_id,
        "user_id": user["id"],
        "vehicle_type": profile.vehicle_type.value,
        "plate_number": profile.plate_number.upper(),
        "vehicle_model": profile.vehicle_model,
        "vehicle_color": profile.vehicle_color,
        "vehicle_capacity": profile.vehicle_capacity,
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "is_online": False,
        "is_approved": False,
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        await db.drivers.insert_one(driver)
    except Exception as e:
        logger.error(f"Error checking driver existence: {e}")
        # Could be duplicate key if concurrent
        existing = await db.drivers.find_one({"user_id": user["id"]})
        if existing:
             raise HTTPException(status_code=400, detail="Already registered as driver")
        raise HTTPException(status_code=500, detail="Registration failed")
    
    # Update user role
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": UserRole.DRIVER.value}})
    
    return DriverResponse(**driver)

@api_router.get("/drivers/me", response_model=DriverResponse)
async def get_my_driver_profile(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
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
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    if not driver["is_approved"]:
        raise HTTPException(status_code=403, detail="Driver not approved yet")
    
    if driver.get("wallet_status") == WalletStatus.RESTRICTED.value:
        raise HTTPException(status_code=403, detail="Wallet restricted. Please top up to go online.")
    
    new_status = not driver["is_online"]
    await db.drivers.update_one(
        {"user_id": user["id"]},
        {"$set": {"is_online": new_status}}
    )
    
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
async def get_document(file_id: str, user: dict = Depends(get_current_user)):
    fs = AsyncIOMotorGridFSBucket(db)
    try:
        grid_out = await fs.open_download_stream(ObjectId(file_id))
        metadata = grid_out.metadata or {}
        doc_driver_id = metadata.get("driver_id")
        
        # Access rules
        if user["role"] not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
            if user["id"] != doc_driver_id:
                raise HTTPException(status_code=403, detail="Not authorized to view this document")
                
        content = await grid_out.read()
        return Response(content=content, media_type=metadata.get("content_type", "image/jpeg"))
    except Exception as e:
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
            "is_approved": status == "approved"
        }}
    )
    
    # Update role to driver only if approved
    if status == "approved":
        await db.users.update_one({"id": driver["user_id"]}, {"$set": {"role": UserRole.DRIVER.value}})
    
    await log_admin_action(user["id"], user["name"], "verify_driver", driver_id, f"Status: {status}")
    
    return {"status": "success", "verification_status": status}

@api_router.post("/drivers/location")
async def update_location(location: LocationUpdate, user: dict = Depends(require_driver)):
    loc_data = {"lat": location.latitude, "lng": location.longitude}
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
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    trip = await DriverTripRebuilder.rebuild(driver["id"], db)
    if not trip:
        return {"route_queue": [], "state": "available"}
        
    return trip

@api_router.get("/rides/driver/active", response_model=List[RideResponse])
async def get_active_rides_for_driver(user: dict = Depends(require_driver)):
    query = {"status": {"$in": get_active_ride_states()}}
    
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
        
    query["driver_id"] = driver["id"]
    
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
async def update_trip_status(req: UpdateTripStatusReq):
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
    
    # Get rides
    rides = await db.rides.find({
        "driver_id": driver["id"],
        "status": {"$in": [RideStatus.COMPLETED.value, RideStatus.RIDE_COMPLETED.value]}
    }, {"_id": 0}).to_list(1000)
    
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    
    today_earnings = sum(r["driver_earning"] for r in rides if datetime.fromisoformat(r["created_at"]).date() == today)
    week_earnings = sum(r["driver_earning"] for r in rides if datetime.fromisoformat(r["created_at"]).date() >= week_start)
    month_earnings = sum(r["driver_earning"] for r in rides if datetime.fromisoformat(r["created_at"]).date() >= month_start)
    
    return {
        "total_earnings": driver["total_earnings"],
        "today_earnings": today_earnings,
        "week_earnings": week_earnings,
        "month_earnings": month_earnings,
        "total_rides": driver["total_rides"],
        "rating": driver["rating"]
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
async def run_daily_settlement(user: dict = Depends(require_admin)):
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

@api_router.get("/admin/analytics")
async def get_admin_analytics(user: dict = Depends(require_admin)):
    """
    Detailed analytics for the admin dashboard.
    """
    # 1. Revenue & Ride Trends (Last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Simple aggregation using python since we're using Motor and small dataset
    # For large scale, we'd use MongoDB aggregation framework
    rides = await db.rides.find({
        "created_at": {"$gte": thirty_days_ago},
        "status": RideStatus.COMPLETED.value
    }).to_list(5000)
    
    daily_stats = {}
    dest_stats = {}
    
    for ride in rides:
        # Daily Stats
        date = datetime.fromisoformat(ride["created_at"]).strftime("%Y-%m-%d")
        if date not in daily_stats:
            daily_stats[date] = {"date": date, "revenue": 0.0, "rides": 0}
        daily_stats[date]["revenue"] += ride.get("fare", 0.0)
        daily_stats[date]["rides"] += 1
        
        # Destination Stats
        dest_name = ride["dropoff_location"].get("address", "Unknown")
        # Try to find common name if address is long
        if "," in dest_name:
            dest_name = dest_name.split(",")[0]
            
        if dest_name not in dest_stats:
            dest_stats[dest_name] = {"name": dest_name, "value": 0}
        dest_stats[dest_name]["value"] += 1
        
    revenue_chart = sorted(daily_stats.values(), key=lambda x: x["date"])
    destination_chart = sorted(dest_stats.values(), key=lambda x: x["value"], reverse=True)[:10]
    
    # Online Drivers vs Busy Drivers (Centralized Logic)
    online_drivers_list = await db.drivers.find({"is_online": True}).to_list(1000)
    online_drivers = len(online_drivers_list)
    busy_drivers = 0
    
    for d in online_drivers_list:
        active_state = await get_driver_active_state(d["id"])
        eligibility = is_driver_eligible(d, active_state)
        if not eligibility["visibility"]:
            busy_drivers += 1
            
    return {
        "revenue_trends": revenue_chart,
        "popular_destinations": destination_chart,
        "driver_activity": {
            "online": online_drivers,
            "busy": busy_drivers,
            "available": online_drivers - busy_drivers
        }
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
                "role": str(student_user.get("role", "student")),
                "created_at": student_user.get("created_at", ""),
                "is_active": student_user.get("is_active", True)
            }
            ride["student"] = student_obj
            ride["student_name"] = student_user["name"]
    elif ride.get("student") and isinstance(ride["student"], dict):
        if not ride.get("student_name"):
            ride["student_name"] = ride["student"].get("name")
    return ride

# ==================== RIDE ROUTES ====================
@api_router.post("/rides/request", response_model=RideResponse)
async def request_ride(ride_data: RideRequest, user: dict = Depends(get_current_user)):
    try:
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
        
        if route_data.get("source") != "osrm":
             logger.error("OSRM Routing failed. Rejecting ride request for safety.")
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
        
        # Commission calculation
        settings = await get_platform_settings()
        commission_rate = settings.get("commission_rate", DEFAULT_COMMISSION_RATE)
        
        commission = calculated_fare * (commission_rate / 100)
        driver_earning = calculated_fare - commission
        
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
    active_rides = await db.rides.find({
        "driver_id": driver_id,
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


@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, background_tasks: BackgroundTasks, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    # Check if ride exists and get its mode
    target_ride = await db.rides.find_one({"id": ride_id})
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

    # TRICK 3: Rate Limit Driver Requests
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

    # Lock driver (ONLY IF PRIVATE, though we can still set it for legacy compatibility)
    if ride_mode == RideMode.PRIVATE.value or active_state["active_rides_count"] == 0:
        await db.drivers.update_one(
            {"id": driver["id"]},
            {"$set": {"current_ride_id": ride_id}}
        )
        
    # Phase 3.2.6.X: DTM & Event Bus Wiring
    # CRITICAL: Broadcast to all active connections MUST be first to prevent UI freezing if other tasks crash
    background_tasks.add_task(manager.broadcast_to_all_active_connections, {
        "type": "shared_ride_accepted_by_other",
        "ride_id": ride_id
    })
    
    background_tasks.add_task(DriverTripManager.handle_ride_accepted, driver["id"], ride_id, db)
    background_tasks.add_task(internal_bus.publish, "ride_accepted", {"driver_id": driver["id"], "ride_id": ride_id})
    
    # Notify student
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "ride_mode": ride_mode,
            "type": "ride_accepted",
            "ride": target_ride,
            "driver": driver
        },
        target_ride["student_id"]
    )

    async def safe_broadcast_route(d_id):
        try:
            await broadcast_route_queue(d_id)
        except Exception as e:
            logger.error(f"Background task broadcast_route_queue failed: {e}")

    async def safe_rebuild(d_id, database):
        try:
            await DriverTripRebuilder.rebuild(d_id, database)
        except Exception as e:
            logger.error(f"Background task DriverTripRebuilder failed: {e}")

    background_tasks.add_task(safe_broadcast_route, driver["id"])
    background_tasks.add_task(safe_rebuild, driver["id"], db)
    
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
    
    await populate_ride_student(ride)
    ride["driver"] = driver # Include driver details in response if needed, though schema has driver_id
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
    
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value),
            "type": "driver_arrived",
            "ride_id": ride_id
        },
        ride["student_id"]
    )
    
    async def send_arrived_push(student_id, r_id):
        await notification_service.send(
            user_id=student_id,
            type="ride_arrived",
            payload={
                "title": "Driver Arrived",
                "body": "Your driver has arrived at the pickup location.",
                "url": f"/ride/{r_id}",
                "icon": "/logo192.png",
                "badge": "/favicon-32x32.png"
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
    
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value),
            "type": "ride_started",
            "ride_id": ride_id
        },
        ride["student_id"]
    )
    
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
    
    now = datetime.now(timezone.utc).isoformat()
    commission_amount = ride.get("commission", 0.0)
    
    # Deduct from wallet
    new_balance = driver.get("wallet_balance", 0.0) - commission_amount
    total_due = driver.get("total_commission_due", 0.0) + commission_amount
    
    wallet_status = WalletStatus.ACTIVE.value
    is_still_online = driver.get("is_online", True)
    
    if new_balance < driver.get("minimum_required_balance", 50.0):
        wallet_status = WalletStatus.RESTRICTED.value
        is_still_online = False
        
    remaining_active_rides = await db.rides.count_documents({
        "driver_id": driver["id"],
        "status": {"$in": get_active_ride_states()}
    })

    set_ops = {
        "wallet_balance": new_balance,
        "total_commission_due": total_due,
        "wallet_status": wallet_status,
        "is_online": is_still_online
    }
    
    if remaining_active_rides == 0:
        set_ops["current_ride_id"] = None

    await db.drivers.update_one(
        {"id": driver["id"]},
        {
            "$inc": {
                "total_rides": 1,
                "total_earnings": ride.get("driver_earning", 0.0)
            },
            "$set": set_ops
        }
    )
    
    # 3. ARCHIVED STATE
    # After settlement, the ride is fully complete and archived
    await db.rides.update_one({"id": ride_id}, {"$set": {"status": RideStatus.RIDE_ARCHIVED.value}})
    
    # We no longer send a WebSocket update here because the frontend transitions itself
    # and the driver is now waiting for their next ride.
    ride["status"] = RideStatus.RIDE_ARCHIVED.value
    
    # Log transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "driver_id": driver["id"],
        "type": TransactionType.COMMISSION_DEDUCTION.value,
        "amount": -commission_amount,
        "ride_id": ride_id,
        "description": f"Commission for ride {ride_id}",
        "timestamp": now
    }
    await db.driver_wallet_transactions.insert_one(transaction)
    
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "type": "ride_completed",
            "ride_id": ride_id,
            "fare": ride["fare"]
        },
        ride["student_id"]
    )
    
    # Notify Driver of Wallet Update and Ride Completion
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "type": "wallet_updated",
            "wallet_balance": new_balance,
            "wallet_status": wallet_status
        },
        user["id"]
    )
    
    background_tasks.add_task(
        manager.send_personal_message,
        {
            "type": "ride_completed",
            "ride_id": ride_id,
            "fare": ride["fare"]
        },
        user["id"]
    )
    
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
        await db.rides.update_one(
            {"id": ride_id},
            {"$set": {
                "status": RideStatus.REQUESTED.value,
                "driver_id": None
            }}
        )
        
        # Notify the student
        background_tasks.add_task(
            manager.send_personal_message,
            {
                "type": "driver_cancelled_reassigning",
                "ride_id": ride_id,
                "message": "Your driver had to cancel. Finding a new driver..."
            },
            ride["student_id"]
        )
        
        # Broadcast to pool that ride is back available
        driver_id_to_notify = ride.get("driver_id")
        ride["status"] = RideStatus.REQUESTED.value
        ride["driver_id"] = None
        await populate_ride_student(ride)
        background_tasks.add_task(manager.broadcast_to_nearby_drivers, {
            "type": "new_ride_request",
            "ride": ride
        }, ride.get("pickup_location"))
        
        if driver_id_to_notify:
            background_tasks.add_task(DriverTripRebuilder.rebuild, driver_id_to_notify, db)
            background_tasks.add_task(broadcast_route_queue, driver_id_to_notify)
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

        # Broadcast to room sockets joined to this ride
        background_tasks.add_task(manager.broadcast_to_ride, cancel_msg, ride_id)
        
        if ride.get("driver_id"):
            driver_doc = await db.drivers.find_one({"id": ride["driver_id"]})
            if driver_doc:
                # Send personal message to driver's user_id (for instant WebSocket UI update & toast)
                if driver_doc.get("user_id"):
                    background_tasks.add_task(
                        manager.send_personal_message,
                        cancel_msg,
                        driver_doc["user_id"]
                    )
                # Fallback to driver_doc id
                background_tasks.add_task(
                    manager.send_personal_message,
                    cancel_msg,
                    driver_doc["id"]
                )
                background_tasks.add_task(broadcast_route_queue, driver_doc["id"])
            else:
                background_tasks.add_task(
                    manager.send_personal_message,
                    cancel_msg,
                    ride["driver_id"]
                )
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
    
    print(f"ACTIVE RIDE QUERY FOR {user['id']}: found {ride['id'] if ride else 'None'}")
    
    if ride:
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

@api_router.get("/rides/history", response_model=List[RideResponse])
async def get_ride_history(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user["role"] == UserRole.DRIVER.value:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            query["driver_id"] = driver["id"]
        else:
            return [] # Prevent dumping entire DB history if driver profile doesn't exist yet
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
        result.append(RideResponse(**ride))
    
    return result

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
        # We no longer strictly filter shared rides by capacity here so the frontend can populate 
        # the masterSharedRidePool. The frontend will dynamically filter based on real-time capacity.
        if ride.get("ride_mode") == RideMode.SHARED.value:
            if not driver.get("accepts_shared_rides", True):
                continue
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

# ==================== CHAT ROUTES ====================
@api_router.post("/chat/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": message.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is part of ride
    is_student = ride["student_id"] == user["id"]
    is_driver = False
    if ride["driver_id"]:
        driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
        is_driver = driver and driver["user_id"] == user["id"]
    
    if not is_student and not is_driver:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    msg_id = str(uuid.uuid4())
    msg = {
        "id": msg_id,
        "ride_id": message.ride_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg)
    
    # Send to other party
    recipient_id = ride["student_id"] if is_driver else None
    if not is_driver and ride["driver_id"]:
        driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
        if driver:
            recipient_id = driver["user_id"]
    
    if recipient_id:
        background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
            "type": "new_message",
            "message": msg
        }, recipient_id)
    
    return MessageResponse(**msg)

@api_router.get("/chat/{ride_id}", response_model=List[MessageResponse])
async def get_chat_messages(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    messages = await db.messages.find({"ride_id": ride_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [MessageResponse(**m) for m in messages]

# ==================== ADMIN ROUTES ====================
@api_router.get("/admin/stats")
async def get_admin_stats(user: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_drivers = await db.drivers.count_documents({})
    pending_drivers = await db.drivers.count_documents({"is_approved": False})
    total_rides = await db.rides.count_documents({})
    completed_rides = await db.rides.count_documents({"status": RideStatus.COMPLETED.value})
    active_rides = await db.rides.count_documents({"status": {"$in": get_active_ride_states()}})
    
    # Calculate earnings
    rides = await db.rides.find({"status": RideStatus.COMPLETED.value}, {"_id": 0}).to_list(10000)
    total_revenue = sum(r["fare"] for r in rides)
    total_commission = sum(r["commission"] for r in rides)
    
    settings = await get_platform_settings()
    
    return {
        "total_users": total_users,
        "total_drivers": total_drivers,
        "pending_drivers": pending_drivers,
        "total_rides": total_rides,
        "completed_rides": completed_rides,
        "active_rides": active_rides,
        "total_revenue": total_revenue,
        "total_commission": total_commission,
        "commission_rate": settings["commission_rate"]
    }

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    valid_users = []
    for u in users:
        try:
            valid_users.append(UserResponse(**u))
        except Exception as e:
            logger.error(f"Skipping invalid user {u.get('id')}: {e}")
            continue
    return valid_users

@api_router.get("/admin/drivers", response_model=List[DriverResponse])
async def get_all_drivers(user: dict = Depends(require_admin)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    result = []
    for driver in drivers:
        try:
            driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0, "password": 0})
            if driver_user:
                driver["user"] = UserResponse(**driver_user)
            result.append(DriverResponse(**driver))
        except Exception as e:
            logger.error(f"Skipping invalid driver {driver.get('id')}: {e}")
            continue
    return result

@api_router.post("/admin/drivers/{driver_id}/approve")
async def approve_driver(driver_id: str, user: dict = Depends(require_admin)):
    result = await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"is_approved": True}}
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

@api_router.get("/admin/rides", response_model=List[RideResponse])
async def get_all_rides(
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_admin)
):
    query = {}
    if status:
        query["status"] = status
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    result = []
    for ride in rides:
        student = await db.users.find_one({"id": ride["student_id"]}, {"_id": 0, "password": 0})
        if student:
            ride["student"] = UserResponse(**student)
        
        if ride["driver_id"]:
            driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
            if driver:
                driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0, "password": 0})
                if driver_user:
                    driver["user"] = UserResponse(**driver_user)
                ride["driver"] = DriverResponse(**driver)
        
        result.append(RideResponse(**ride))
    
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
async def get_pricing_settings(user: dict = Depends(require_admin)):
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

@api_router.post("/admin/create-admin")
async def create_admin(admin_data: UserCreate, user: dict = Depends(require_super_admin)):
    existing = await db.users.find_one({"email": admin_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = str(uuid.uuid4())
    new_admin = {
        "id": user_id,
        "email": admin_data.email.lower(),
        "name": admin_data.name,
        "phone": admin_data.phone,
        "password": hash_password(admin_data.password),
        "role": UserRole.ADMIN.value,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_admin)
    
    await log_admin_action(user["id"], user["name"], "create_admin", user_id, f"Created admin: {admin_data.email}")
    
    return {"status": "created", "user_id": user_id}

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
@api_router.post("/rides/estimate-fare")
async def estimate_fare(data: dict, user: dict = Depends(get_current_user)):
    # Check if coordinates are provided for server-side calculation
    pickup = data.get("pickup", {})
    dropoff = data.get("dropoff", {})
    
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
        "geometry": verified_geometry
    }

# ==================== CHAT ROUTES ====================
@api_router.post("/chat/send", response_model=MessageResponse)
async def send_message(message: MessageCreate, user: dict = Depends(get_current_user)):
    # Verify user is part of the ride
    ride = await db.rides.find_one({"id": message.ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check if user is student or driver for this ride (or admin)
    is_student = ride["student_id"] == user["id"]
    is_driver = ride.get("driver_id") and ride["driver_id"] == (await db.drivers.find_one({"user_id": user["id"]}))["id"]
    
    if not (is_student or is_driver):
        raise HTTPException(status_code=403, detail="Not authorized for this chat")
    
    msg_id = str(uuid.uuid4())
    new_message = {
        "id": msg_id,
        "ride_id": message.ride_id,
        "sender_id": user["id"],
        "sender_name": user["name"],
        "content": message.content,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": datetime.now(timezone.utc)
    }
    
    await db.messages.insert_one(new_message)
    
    # Broadcast via WebSocket
    await manager.broadcast_to_ride({
        "type": "new_message",
        "message": new_message,
        "ride_id": message.ride_id
    }, message.ride_id)
    
    return MessageResponse(**new_message)

@api_router.get("/chat/{ride_id}", response_model=List[MessageResponse])
async def get_chat_history(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check authorization
    is_student = ride["student_id"] == user["id"]
    is_driver_user = False
    
    if ride.get("driver_id"):
        driver = await db.drivers.find_one({"id": ride["driver_id"]})
        if driver and driver["user_id"] == user["id"]:
            is_driver_user = True
            
    is_admin = user["role"] in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]
    
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
                    if now - last_loc_update < 3.0:
                        # Throttle: Ignore rapid updates
                        continue
                    last_loc_update = now

                    await manager.update_driver_location(user_id, data.get("location", {}))
                    
                    # If driver has active ride, broadcast to student
                    driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
                    if driver:
                        active_ride = await db.rides.find_one({
                            "driver_id": driver["id"],
                            "status": {"$in": get_active_ride_states()}
                        }, {"_id": 0})
                        
                        if active_ride:
                            background_tasks.add_task(manager.send_personal_message, {
        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),
                                "type": "driver_location",
                                "location": data.get("location"),
                                "ride_id": active_ride["id"]
                            }, active_ride["student_id"])
                
                elif data.get("type") == "request_hard_recalculation":
                    logger.info(f"HARD RECALCULATION requested by driver {user_id}")
                    driver = await db.drivers.find_one({"user_id": user_id}, {"_id": 0})
                    if driver:
                        try:
                            trip = await DriverTripRebuilder.rebuild(driver["id"], db)
                            if trip:
                                trip = await inject_etas_into_trip(trip, driver.get("current_location", {}))
                                if "route_queue" in trip:
                                    background_tasks.add_task(manager.send_personal_message, {
                                        "type": "route_queue_update",
                                        "queue": trip["route_queue"]
                                    }, user_id)
                                
                                passenger_briefings = trip.get("passenger_briefings", {})
                                for s_id, briefing in passenger_briefings.items():
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
                                    }, s_id)
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

@api_router.post("/admin/notifications/broadcast")
async def broadcast_notification(
    request: AdminBroadcastRequest,
    admin: dict = Depends(require_admin)
):
    try:
        query = {}
        if request.target_role != "all":
            query["role"] = request.target_role
            
        cursor = db.push_subscriptions.find(query)
        subscriptions = await cursor.to_list(length=10000)
        
        if not subscriptions:
            return {"status": "success", "sent": 0, "failed": 0, "message": "No active subscriptions found for target role"}

        payload = {
            "title": request.title,
            "body": request.message,
            "url": request.url or "/",
            "icon": "/logo192.png",
            "badge": "/favicon-32x32.png"
        }
        
        users_sent = set()
        total_sent = 0
        total_failed = 0
        
        for sub in subscriptions:
            user_id = sub["user_id"]
            if user_id not in users_sent:
                success = await notification_service.send(
                    user_id=user_id,
                    type="broadcast",
                    payload=payload
                )
                if success:
                    total_sent += 1
                else:
                    total_failed += 1
                users_sent.add(user_id)
                
        # Log broadcast
        log_entry = {
            "id": str(uuid.uuid4()),
            "title": request.title,
            "message": request.message,
            "target_role": request.target_role,
            "total_sent": total_sent,
            "total_failed": total_failed,
            "created_by": admin["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notification_logs.insert_one(log_entry)
        
        return {
            "status": "success", 
            "sent": total_sent, 
            "failed": total_failed,
            "message": f"Broadcast sent successfully: {total_sent} delivered, {total_failed} failed."
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
        if request.url.path in ["/api/auth/login", "/api/auth/register", "/api/rides/request"]:
            client_ip = request.client.host
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
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Handles image uploads for KYC documents using GridFS."""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file selected")
            
        content = await file.read()
        fs = AsyncIOMotorGridFSBucket(db)
        
        file_id = await fs.upload_from_stream(
            file.filename,
            content,
            metadata={"user_id": user["id"], "content_type": file.content_type}
        )
        
        backend_url = os.environ.get('BACKEND_URL', 'https://student-ride-backend-manual.onrender.com').rstrip('/')
        doc_url = f"{backend_url}/api/documents/{str(file_id)}"
        
        return {"url": doc_url}
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload file")

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
