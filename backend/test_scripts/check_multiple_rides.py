from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["student_ride"]
rides = list(db.rides.find({"driver_id": "ghost-driver-0", "status": {"$in": ["accepted", "driver_arrived", "ongoing"]}}))
for r in rides:
    print(f"Ride ID: {r['id']}, Student: {r['student_id']}, Status: {r['status']}")
