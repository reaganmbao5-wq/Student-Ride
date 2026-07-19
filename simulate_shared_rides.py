import requests
import jwt
import os
import sys
import time
from dotenv import load_dotenv

load_dotenv('backend/.env')
JWT_SECRET = os.environ.get('JWT_SECRET', 'mulungushi-rides-secret-key-2024')

# Determine target
TARGET = "https://student-ride-backend-manual.onrender.com/api"
if "--local" in sys.argv:
    TARGET = "http://localhost:8000/api"

print(f"Targeting API: {TARGET}")

num_students = 4
if "--2" in sys.argv:
    num_students = 2

students = [
    {"id": "qa_student_a", "name": "Student A", "lat": -14.398, "lng": 28.275, "address": "Kabwe Mall"},
    {"id": "qa_student_b", "name": "Student B", "lat": -14.405, "lng": 28.280, "address": "Mulungushi Main Campus"},
    {"id": "qa_student_c", "name": "Student C", "lat": -14.400, "lng": 28.285, "address": "Town Centre"},
    {"id": "qa_student_d", "name": "Student D", "lat": -14.390, "lng": 28.270, "address": "Nkrumah College"}
]

print(f"Simulating {num_students} shared ride requests...")

for i in range(num_students):
    student = students[i]
    # Generate JWT Token for student
    token = jwt.encode({'sub': student['id'], 'role': 'student'}, JWT_SECRET, algorithm='HS256')
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    
    # 5km radius roughly ~0.045 degrees in lat/lng from center (e.g., -14.40, 28.28)
    payload = {
        "pickup_location": {"lat": student['lat'], "lng": student['lng'], "address": student['address']},
        "dropoff_location": {"lat": -14.380, "lng": 28.250, "address": "General Hospital"},
        "ride_mode": "shared",
        "passenger_count": 1
    }
    
    print(f"\n[{student['name']}] Requesting shared ride...")
    try:
        response = requests.post(f"{TARGET}/rides/request", json=payload, headers=headers)
        if response.status_code == 200:
            print(f"✅ Success! Ride ID: {response.json().get('id')}")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error: {e}")
        
    time.sleep(1) # small delay

print("\nSimulation complete! Check your Driver App.")
