import os
from pymongo import MongoClient

def reset_rides_for_qa():
    url = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/mulungushi_rides?appName=Cluster0'
    client = MongoClient(url)
    db = client['mulungushi_rides']
    
    inactive_states = ['completed', 'cancelled', 'declined', 'expired', 'finished', 'ride_archived']
    active_rides = list(db.rides.find({"status": {"$nin": inactive_states}}))
    
    print(f"Found {len(active_rides)} active rides to process.")
    
    for ride in active_rides:
        student_id = ride.get('student_id')
        driver_id = ride.get('driver_id')
        
        # We want qa_driver_a to have exactly 1 accepted (e.g. qa_student_b)
        if driver_id == 'qa_driver_a' and student_id == 'qa_student_b':
            print(f"Keeping ride for student {student_id} with qa_driver_a as accepted.")
            continue
            
        # Reset all other rides to 'finding_driver' so they show up as requests for qa_driver_a
        print(f"Resetting ride {ride.get('_id')} for student {student_id} to finding_driver...")
        
        db.rides.update_one(
            {"_id": ride['_id']},
            {
                "$set": {
                    "status": "finding_driver",
                    "ride_mode": "shared" # Ensure they are shared so they go to the Shared pool
                },
                "$unset": {
                    "driver_id": "",
                    "driver_name": "",
                    "driver_phone": "",
                    "driver_location": "",
                    "vehicle_details": "",
                    "accepted_at": ""
                }
            }
        )
        
    print("\nDone! qa_driver_a has 1 accepted ride, and the rest are looking for a driver.")

if __name__ == '__main__':
    reset_rides_for_qa()
