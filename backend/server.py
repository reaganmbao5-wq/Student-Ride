from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import asyncio
from enum import Enum
import json

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
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

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
    email: str
    name: str
    phone: str
    role: UserRole
    created_at: str
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
    vehicle_type: VehicleType
    plate_number: str
    vehicle_model: str
    vehicle_color: str
    rating: float = 5.0
    total_rides: int = 0
    total_earnings: float = 0.0
    is_online: bool = False
    is_approved: bool = False
    current_location: Optional[Dict[str, float]] = None
    created_at: str

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

class RideRequest(BaseModel):
    pickup_location: Dict[str, Any]  # {lat, lng, address}
    dropoff_location: Dict[str, Any]  # {lat, lng, address}
    estimated_fare: float
    estimated_distance: float  # in km
    estimated_duration: int  # in minutes

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
    duration: int
    rating: Optional[int] = None
    review: Optional[str] = None
    created_at: str
    accepted_at: Optional[str] = None
    completed_at: Optional[str] = None

class MessageCreate(BaseModel):
    ride_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    ride_id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: str

class RatingCreate(BaseModel):
    ride_id: str
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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ==================== HELPER FUNCTIONS ====================
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

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
    if user["role"] not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

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
    settings = await db.settings.find_one({"type": "platform"}, {"_id": 0})
    if not settings:
        settings = {
            "type": "platform",
            "commission_rate": DEFAULT_COMMISSION_RATE,
            "base_fare": 10.0,
            "per_km_rate": 5.0,
            "per_minute_rate": 1.0
        }
        await db.settings.insert_one(settings)
    return settings

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
        # Update in database
        await db.drivers.update_one(
            {"user_id": driver_id},
            {"$set": {"current_location": location}}
        )

    async def broadcast_to_nearby_drivers(self, message: dict, location: dict, radius_km: float = 10):
        """Broadcast ride request to nearby online drivers"""
        online_drivers = await db.drivers.find({
            "is_online": True,
            "is_approved": True
        }, {"_id": 0}).to_list(100)
        
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

# ==================== DRIVER ROUTES ====================
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
        "is_online": False,
        "is_approved": False,
        "current_location": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.drivers.insert_one(driver)
    
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

# ==================== RIDE ROUTES ====================
@api_router.post("/rides/request", response_model=RideResponse)
async def request_ride(ride_data: RideRequest, user: dict = Depends(get_current_user)):
    settings = await get_platform_settings()
    
    commission = ride_data.estimated_fare * (settings["commission_rate"] / 100)
    driver_earning = ride_data.estimated_fare - commission
    
    ride_id = str(uuid.uuid4())
    ride = {
        "id": ride_id,
        "student_id": user["id"],
        "driver_id": None,
        "pickup_location": ride_data.pickup_location,
        "dropoff_location": ride_data.dropoff_location,
        "status": RideStatus.REQUESTED.value,
        "fare": ride_data.estimated_fare,
        "commission": commission,
        "driver_earning": driver_earning,
        "distance": ride_data.estimated_distance,
        "duration": ride_data.estimated_duration,
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

@api_router.post("/rides/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    if ride["status"] != RideStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail="Ride already taken or cancelled")
    
    # Update ride
    now = datetime.now(timezone.utc).isoformat()
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {
            "driver_id": driver["id"],
            "status": RideStatus.ACCEPTED.value,
            "accepted_at": now
        }}
    )
    
    ride["driver_id"] = driver["id"]
    ride["status"] = RideStatus.ACCEPTED.value
    ride["accepted_at"] = now
    
    # Notify student
    await manager.send_personal_message({
        "type": "ride_accepted",
        "ride": ride,
        "driver": driver
    }, ride["student_id"])
    
    # Add both to ride room
    manager.add_to_ride(ride_id, ride["student_id"])
    manager.add_to_ride(ride_id, user["id"])
    
    return RideResponse(**ride)

@api_router.post("/rides/{ride_id}/arrived")
async def driver_arrived(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride or ride["driver_id"] != driver["id"]:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": RideStatus.DRIVER_ARRIVED.value}}
    )
    
    await manager.send_personal_message({
        "type": "driver_arrived",
        "ride_id": ride_id
    }, ride["student_id"])
    
    return {"status": "arrived"}

@api_router.post("/rides/{ride_id}/start")
async def start_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride or ride["driver_id"] != driver["id"]:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": RideStatus.ONGOING.value}}
    )
    
    await manager.send_personal_message({
        "type": "ride_started",
        "ride_id": ride_id
    }, ride["student_id"])
    
    return {"status": "ongoing"}

@api_router.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, user: dict = Depends(require_driver)):
    driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
    ride = await db.rides.find_one({"id": ride_id}, {"_id": 0})
    
    if not ride or ride["driver_id"] != driver["id"]:
        raise HTTPException(status_code=404, detail="Ride not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.rides.update_one(
        {"id": ride_id},
        {"$set": {"status": RideStatus.COMPLETED.value, "completed_at": now}}
    )
    
    # Update driver stats
    await db.drivers.update_one(
        {"id": driver["id"]},
        {
            "$inc": {
                "total_rides": 1,
                "total_earnings": ride["driver_earning"]
            }
        }
    )
    
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
            await db.drivers.update_one(
                {"id": ride["driver_id"]},
                {"$set": {"rating": round(avg_rating, 1)}}
            )
    
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
    return [UserResponse(**u) for u in users]

@api_router.get("/admin/drivers", response_model=List[DriverResponse])
async def get_all_drivers(user: dict = Depends(require_admin)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(1000)
    result = []
    for driver in drivers:
        driver_user = await db.users.find_one({"id": driver["user_id"]}, {"_id": 0, "password": 0})
        if driver_user:
            driver["user"] = UserResponse(**driver_user)
        result.append(DriverResponse(**driver))
    return result

@api_router.post("/admin/drivers/{driver_id}/approve")
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

# ==================== FARE CALCULATION ====================
@api_router.post("/rides/estimate-fare")
async def estimate_fare(data: dict, user: dict = Depends(get_current_user)):
    distance_km = data.get("distance_km", 0)
    duration_min = data.get("duration_min", 0)
    
    settings = await get_platform_settings()
    
    fare = settings["base_fare"] + (distance_km * settings["per_km_rate"]) + (duration_min * settings["per_minute_rate"])
    fare = round(fare, 2)
    
    return {
        "estimated_fare": fare,
        "base_fare": settings["base_fare"],
        "distance_charge": round(distance_km * settings["per_km_rate"], 2),
        "time_charge": round(duration_min * settings["per_minute_rate"], 2)
    }

# ==================== WEBSOCKET ENDPOINT ====================
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "location_update":
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

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
