from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import time
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from services.osrm_service import get_route
import jwt
import bcrypt
import asyncio
from enum import Enum
import json
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'mulungushi-rides-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Super Admin Email
SUPER_ADMIN_EMAIL = "Reaganmbao5@gmail.com"
DEFAULT_COMMISSION_RATE = 15.0

# Create the main app
app = FastAPI(title="Mulungushi Rides API")

# Configure CORS
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex='https?://.*',
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

@app.get("/")
async def health_check():
    return {"status": "ok", "service": "student-ride-backend"}

@app.on_event("startup")
async def startup_db_client():
    try:
        # Create geospatial index for driver location
        await db.drivers.create_index([("location", "2dsphere")])
        
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
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        # We don't raise here to allow app to start even if DB is flaky

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================
class UserRole(str, Enum):
    STUDENT = "student"
    DRIVER = "driver"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"

class RideStatus(str, Enum):
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    DRIVER_ARRIVED = "driver_arrived"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

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

# ==================== MODELS ====================
class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: str

class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.STUDENT

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
    current_location: Optional[Dict[str, float]] = None
    wallet_balance: float = 0.0
    wallet_status: WalletStatus = WalletStatus.ACTIVE
    minimum_required_balance: float = 50.0
    total_commission_due: float = 0.0
    total_commission_paid: float = 0.0
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

class MessageCreate(BaseModel):
    ride_id: str
    content: str
    
# ==================== PRICING MODELS ====================
class PricingSettings(BaseModel):
    base_fare: float = Field(..., gt=0)
    per_km_rate: float = Field(..., gt=0)
    per_minute_rate: float = Field(..., gt=0)
    surge_multiplier: float = Field(1.0, ge=1.0, le=5.0)
    minimum_fare: float = Field(..., gt=0)
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).to_list(1000)
    return users

@api_router.get("/admin/drivers", response_model=List[DriverResponse])
async def get_all_drivers(user: dict = Depends(require_admin)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    result = []
    for driver in drivers:
        driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0, "password_hash": 0})
        if driver_user:
            driver["user"] = UserResponse(**driver_user)
        result.append(driver)
    return result

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

async def calculate_ride_fare(pickup_loc: Dict[str, Any], dropoff_loc: Dict[str, Any], distance_km: float, duration_min: float) -> Dict[str, Any]:
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
    
    base_fare = settings.get("base_fare", 15.0)
    per_km = settings.get("per_km_rate", 5.0)
    per_min = settings.get("per_minute_rate", 2.0)
    surge = settings.get("surge_multiplier", 1.0)
    min_fare = settings.get("minimum_fare", 20.0)
    
    dist_cost = distance_km * per_km
    time_cost = duration_min * per_min
    
    subtotal = base_fare + dist_cost + time_cost
    surge_total = subtotal * surge
    
    final_fare = max(surge_total, min_fare)
    final_fare = round(final_fare, 2)
    
    return {
        "fare": final_fare,
        "is_fixed": False,
        "route_name": "Standard Ride",
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
        self.active_connections: Dict[str, WebSocket] = {}
        self.driver_locations: Dict[str, Dict] = {}
        self.ride_connections: Dict[str, List[str]] = {}  # ride_id -> [user_ids]

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected via WebSocket")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.driver_locations:
            del self.driver_locations[user_id]
        logger.info(f"User {user_id} disconnected")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")

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
        
        # Create GeoJSON point
        # MongoDB expects [longitude, latitude]
        geo_location = {
            "type": "Point",
            "coordinates": [location["lng"], location["lat"]]
        }
        
        # Update in database
        await db.drivers.update_one(
            {"user_id": driver_id},
            {"$set": {
                "current_location": location,
                "location": geo_location
            }}
        )

    async def broadcast_to_nearby_drivers(self, message: dict, location: dict, radius_km: float = 10):
        """Broadcast ride request to nearby online drivers using geospatial query"""
        # Convert radius to meters
        max_distance_meters = radius_km * 1000
        
        online_drivers = await db.drivers.find({
            "is_online": True,
            "is_approved": True,
            "wallet_status": {"$ne": WalletStatus.RESTRICTED.value},
            "current_ride_id": None, # Filter out busy drivers
            "location": {
                "$near": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [location["lng"], location["lat"]]
                    },
                    "$maxDistance": max_distance_meters
                }
            }
        }, {"_id": 0}).to_list(20) # Limit to 20 closest
        
        for driver in online_drivers:
            driver_id = driver["user_id"]
            if driver_id in self.active_connections:
                await self.send_personal_message(message, driver_id)

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

# ==================== DRIVER ROUTES ====================
@api_router.get("/drivers/nearby", response_model=List[NearbyDriverResponse])
async def get_nearby_drivers(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.5, le=20.0),
    user: dict = Depends(get_current_user)
):
    """
    Fetch nearby AVAILABLE drivers for the pickup map.
    Filters: Online, Approved, Active Wallet, Not in Ride.
    Limit: 20 drivers.
    """
    max_distance_meters = radius_km * 1000
    
    online_drivers = await db.drivers.find({
        "is_online": True,
        "is_approved": True,
        "wallet_status": {"$ne": WalletStatus.RESTRICTED.value},
        "current_ride_id": None,
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
    
    results = []
    for d in online_drivers:
        # Extract lat/lng safely
        loc = d.get("current_location", {})
        lat = loc.get("lat")
        lng = loc.get("lng")
        heading = loc.get("heading", 0.0)
        
        if lat is not None and lng is not None:
            results.append(NearbyDriverResponse(
                id=d["user_id"],
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
        "rating": 5.0,
        "total_rides": 0,
        "total_earnings": 0.0,
        "total_earnings": 0.0,
        "is_online": False,
        "is_approved": False,
        "current_ride_id": None, # For locking
        "current_location": None,
        "location": None, # GeoJSON for indexing
        "wallet_balance": 0.0,
        "wallet_status": WalletStatus.ACTIVE.value,
        "minimum_required_balance": 50.0,
        "total_commission_due": 0.0,
        "total_commission_paid": 0.0,
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

@api_router.post("/drivers/location")
async def update_location(location: LocationUpdate, user: dict = Depends(require_driver)):
    loc_data = {"lat": location.latitude, "lng": location.longitude}
    await manager.update_driver_location(user["id"], loc_data)
    return {"status": "updated"}

@api_router.get("/drivers/earnings")
async def get_driver_earnings(user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    # Get rides
    rides = await db.rides.find({
        "driver_id": driver["id"],
        "status": RideStatus.COMPLETED.value
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

# ==================== DESTINATION ROUTES ====================

@api_router.get("/destinations", response_model=List[DestinationResponse])
async def get_destinations(active_only: bool = Query(False)):
    query = {}
    if active_only:
        query["is_active"] = True
    active_destinations = await db.destinations.find(query, {"_id": 0}).to_list(100)
    return active_destinations

@api_router.post("/admin/destinations", response_model=DestinationResponse)
async def create_destination(destination: DestinationCreate, user: dict = Depends(require_admin)):
    dest_id = str(uuid.uuid4())
    new_dest = {
        "id": dest_id,
        "name": destination.name,
        "address": destination.address,
        "latitude": destination.latitude,
        "longitude": destination.longitude,
        "estimated_fare": destination.estimated_fare,
        "is_active": destination.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.destinations.insert_one(new_dest)
    
    await log_admin_action(user["id"], user["name"], "create_destination", dest_id, f"Created {destination.name}")
    
    return DestinationResponse(**new_dest)

@api_router.delete("/admin/destinations/{dest_id}")
async def delete_destination(dest_id: str, user: dict = Depends(require_admin)):
    result = await db.destinations.delete_one({"id": dest_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    await log_admin_action(user["id"], user["name"], "delete_destination", dest_id)
    return {"status": "deleted"}

# ==================== RIDE ROUTES ====================
@api_router.post("/rides/request", response_model=RideResponse)
async def request_ride(ride_data: RideRequest, user: dict = Depends(get_current_user)):
    try:
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
            duration
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
        
        # Broadcast to available drivers
        await manager.broadcast_to_nearby_drivers({
            "type": "new_ride_request",
            "ride": ride
        }, ride_data.pickup_location)
        
        ride["student"] = UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            phone=user["phone"],
            role=UserRole(user["role"]),
            created_at=user["created_at"],
            is_active=user.get("is_active", True)
        )
        
        return RideResponse(**ride)
    except Exception as e:
        logger.error(f"Error in request_ride: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    # Check if driver is already on a ride
    if driver.get("current_ride_id"):
        raise HTTPException(status_code=400, detail="You are already on a ride")

    # ATOMIC UPDATE: Only update if status is REQUESTED
    now = datetime.now(timezone.utc).isoformat()
    ride = await db.rides.find_one_and_update(
        {"id": ride_id, "status": RideStatus.REQUESTED.value},
        {"$set": {
            "driver_id": driver["id"],
            "status": RideStatus.ACCEPTED.value,
            "accepted_at": now
        }},
        return_document=True
    )
    
    if not ride:
        # Check if ride exists at all to give better error
        existing = await db.rides.find_one({"id": ride_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Ride not found")
        raise HTTPException(status_code=400, detail="Ride already taken or cancelled")

    # Lock driver
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"current_ride_id": ride_id}}
    )
    
    # Notify student
    await manager.send_personal_message({
        "type": "ride_accepted",
        "ride": ride,
        "driver": driver
    }, ride["student_id"])
    
    # Add both to ride room
    manager.add_to_ride(ride_id, ride["student_id"])
    manager.add_to_ride(ride_id, user["id"])
    
    ride["driver"] = driver # Include driver details in response if needed, though schema has driver_id
    return RideResponse(**ride)

@api_router.post("/rides/{ride_id}/arrived")
async def driver_arrived(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    # ATOMIC UPDATE: Only update if status is ACCEPTED and assigned to this driver
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.ACCEPTED.value
        },
        {"$set": {"status": RideStatus.DRIVER_ARRIVED.value}},
        return_document=True
    )
    
    if not ride:
        raise HTTPException(status_code=400, detail="Invalid transition. Ride must be ACCEPTED and assigned to you.")
    
    await manager.send_personal_message({
        "type": "driver_arrived",
        "ride_id": ride_id
    }, ride["student_id"])
    
    return {"status": "arrived"}

@api_router.post("/rides/{ride_id}/start")
async def start_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    # ATOMIC UPDATE: Only update if status is DRIVER_ARRIVED and assigned to this driver
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.DRIVER_ARRIVED.value
        },
        {"$set": {"status": RideStatus.ONGOING.value}},
        return_document=True
    )
    
    if not ride:
         raise HTTPException(status_code=400, detail="Invalid transition. Ride must be in DRIVER_ARRIVED state.")
    
    await manager.send_personal_message({
        "type": "ride_started",
        "ride_id": ride_id
    }, ride["student_id"])
    
    return {"status": "ongoing"}

@api_router.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
         raise HTTPException(status_code=404, detail="Driver profile not found")

    # ATOMIC UPDATE: Only update if status is ONGOING and assigned to this driver
    # This prevents double completion and double deduction
    ride = await db.rides.find_one_and_update(
        {
            "id": ride_id, 
            "driver_id": driver["id"], 
            "status": RideStatus.ONGOING.value
        },
        {"$set": {"status": RideStatus.COMPLETED.value, "completed_at": datetime.now(timezone.utc).isoformat()}},
        return_document=True
    )
    
    if not ride:
        raise HTTPException(status_code=400, detail="Invalid transition. Ride must be ONGOING.")
    
    now = datetime.now(timezone.utc).isoformat()
    commission_amount = ride["commission"]
    
    # Deduct from wallet
    new_balance = driver.get("wallet_balance", 0.0) - commission_amount
    total_due = driver.get("total_commission_due", 0.0) + commission_amount
    
    wallet_status = WalletStatus.ACTIVE.value
    is_still_online = driver["is_online"]
    
    if new_balance < driver.get("minimum_required_balance", 50.0):
        wallet_status = WalletStatus.RESTRICTED.value
        is_still_online = False
        
    await db.drivers.update_one(
        {"id": driver["id"]},
        {
            "$inc": {
                "total_rides": 1,
                "total_earnings": ride["driver_earning"]
            },
            "$set": { # Unset current_ride_id separately or here? 
                      # Wait, $set is already above. Merge them.
                "wallet_balance": new_balance,
                "total_commission_due": total_due,
                "wallet_status": wallet_status,
                "is_online": is_still_online,
                "current_ride_id": None 
            }
        }
    )
    
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
    
    await manager.send_personal_message({
        "type": "ride_completed",
        "ride_id": ride_id,
        "fare": ride["fare"]
    }, ride["student_id"])
    
    manager.remove_from_ride(ride_id, ride["student_id"])
    manager.remove_from_ride(ride_id, user["id"])
    
    return {"status": "completed", "fare": ride["fare"]}

@api_router.post("/rides/{ride_id}/cancel")
async def cancel_ride(ride_id: str, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    # Check permission
    if ride["student_id"] != user["id"] and user["role"] not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if not driver or ride["driver_id"] != driver["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if ride["status"] in [RideStatus.COMPLETED.value, RideStatus.CANCELLED.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel this ride")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": RideStatus.CANCELLED.value}}
    )
    
    # Unlock driver if assigned
    if ride["driver_id"]:
        await db.drivers.update_one(
            {"id": ride["driver_id"]},
            {"$set": {"current_ride_id": None}}
        )
    
    # Notify both parties
    if ride["driver_id"]:
        driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
        if driver:
            await manager.send_personal_message({
                "type": "ride_cancelled",
                "ride_id": ride_id
            }, driver["user_id"])
    
    await manager.send_personal_message({
        "type": "ride_cancelled",
        "ride_id": ride_id
    }, ride["student_id"])
    
    return {"status": "cancelled"}

@api_router.post("/rides/{ride_id}/rate")
async def rate_ride(ride_id: str, rating_data: RatingCreate, user: dict = Depends(get_current_user)):
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride or ride["student_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != RideStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Can only rate completed rides")
    
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"rating": rating_data.rating, "review": rating_data.review}}
    )
    
    # Update driver rating
    if ride["driver_id"]:
        driver_rides = await db.rides.find({
            "driver_id": ride["driver_id"],
            "rating": {"$ne": None}
        }, {"_id": 0}).to_list(1000)
        
        if driver_rides:
            avg_rating = sum(r["rating"] for r in driver_rides) / len(driver_rides)
            new_rating = round(avg_rating, 1)
            await db.drivers.update_one(
                {"id": ride["driver_id"]},
                {"$set": {"rating": new_rating}}
            )
            
            # Notify driver via WebSocket
            driver = await db.drivers.find_one({"id": ride["driver_id"]}, {"_id": 0})
            if driver and "user_id" in driver:
                await manager.send_personal_message({
                    "type": "rating_received",
                    "rating": rating_data.rating,
                    "new_average": new_rating,
                    "ride_id": ride_id
                }, driver["user_id"])
    
    return {"status": "rated"}

@api_router.get("/rides/active", response_model=Optional[RideResponse])
async def get_active_ride(user: dict = Depends(get_current_user)):
    query = {"status": {"$in": [
        RideStatus.REQUESTED.value,
        RideStatus.ACCEPTED.value,
        RideStatus.DRIVER_ARRIVED.value,
        RideStatus.ONGOING.value
    ]}}
    
    if user["role"] == UserRole.DRIVER.value:
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            query["driver_id"] = driver["id"]
    else:
        query["student_id"] = user["id"]
    
    ride = await db.rides.find_one(query, {"_id": 0})
    
    if ride:
        # Populate student
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
                        phone=driver_user["phone"],
                        role=UserRole(driver_user["role"]),
                        created_at=driver_user["created_at"],
                        is_active=driver_user.get("is_active", True)
                    )
                ride["driver"] = DriverResponse(**driver)
        
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
        query["student_id"] = user["id"]
    
    rides = await db.rides.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
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
    rides = await db.rides.find({
        "status": RideStatus.REQUESTED.value
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
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
        await manager.send_personal_message({
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
    active_rides = await db.rides.count_documents({"status": {"$in": [
        RideStatus.REQUESTED.value,
        RideStatus.ACCEPTED.value,
        RideStatus.DRIVER_ARRIVED.value,
        RideStatus.ONGOING.value
    ]}})
    
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
            surge_multiplier=1.0, minimum_fare=20.0
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

    settings = await get_platform_settings()
    
    fare = settings["base_fare"] + (distance_km * settings["per_km_rate"]) + (duration_min * settings["per_minute_rate"])
    fare = round(fare, 2)
    
    return {
        "estimated_fare": fare,
        "base_fare": settings["base_fare"],
        "distance_charge": round(distance_km * settings["per_km_rate"], 2),
        "time_charge": round(duration_min * settings["per_minute_rate"], 2),
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
        "created_at": datetime.now(timezone.utc).isoformat()
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
                data = await websocket.receive_json()
                
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
                            "status": {"$in": [RideStatus.ACCEPTED.value, RideStatus.DRIVER_ARRIVED.value, RideStatus.ONGOING.value]}
                        }, {"_id": 0})
                        
                        if active_ride:
                            await manager.send_personal_message({
                                "type": "driver_location",
                                "location": data.get("location"),
                                "ride_id": active_ride["id"]
                            }, active_ride["student_id"])
                
                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
    
        except WebSocketDisconnect:
            manager.disconnect(user_id)
            # Set driver offline if disconnected
            await db.drivers.update_one(
                {"user_id": user_id},
                {"$set": {"is_online": False}}
            )
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        await websocket.close(code=4000)

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

# Include router
app.include_router(api_router)

# Add Rate Limit (First in stack essentially)
app.add_middleware(RateLimitMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
