import os
import json
from datetime import datetime
from pymongo import MongoClient

def check_active_rides():
    url = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/mulungushi_rides?appName=Cluster0'
    client = MongoClient(url)
    db = client['mulungushi_rides']
    
    # Active states
    inactive_states = ['completed', 'cancelled', 'declined', 'expired', 'finished']
    
    active_rides = list(db.rides.find({"status": {"$nin": inactive_states}}))
    
    print(f"Found {len(active_rides)} active rides")
    
    for ride in active_rides:
        print("\n--------------------------------------------------")
        print(f"Ride ID: {ride.get('_id')}")
        print(f"Status: {ride.get('status')}")
        print(f"Ride Mode: {ride.get('ride_mode', 'N/A')}")
        print(f"Created At: {ride.get('created_at', ride.get('createdAt'))}")
        print(f"Student ID: {ride.get('student_id')}")
        
        if 'student_name' in ride:
            print(f"Student Name (Cached): {ride.get('student_name')}")
            
        if 'driver_id' in ride:
            print(f"Driver ID: {ride.get('driver_id')}")
            
        student = db.users.find_one({"_id": ride.get("student_id")})
        if student:
            print(f"Student Details: {student.get('first_name')} {student.get('last_name')} ({student.get('email')})")
            
        if ride.get("driver_id"):
            driver = db.users.find_one({"_id": ride.get("driver_id")})
            if driver:
                print(f"Driver Details: {driver.get('first_name')} {driver.get('last_name')} ({driver.get('email')})")
                
        if ride.get("shared_students"):
            print(f"Shared Students: {ride.get('shared_students')}")
            
    print("\n--------------------------------------------------")

if __name__ == '__main__':
    check_active_rides()
