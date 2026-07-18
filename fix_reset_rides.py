import os
from pymongo import MongoClient

def fix_reset_rides():
    url = 'mongodb+srv://admin:reaganmbao31?@cluster0.mucpxu8.mongodb.net/mulungushi_rides?appName=Cluster0'
    client = MongoClient(url)
    db = client['mulungushi_rides']
    
    # We set them to "finding_driver" incorrectly, we should set them to "requested"
    incorrect_rides = list(db.rides.find({"status": "finding_driver"}))
    
    print(f"Found {len(incorrect_rides)} rides with incorrect status 'finding_driver'.")
    
    for ride in incorrect_rides:
        print(f"Fixing ride {ride.get('_id')} for student {ride.get('student_id')} to 'requested'...")
        db.rides.update_one(
            {"_id": ride['_id']},
            {
                "$set": {
                    "status": "requested"
                }
            }
        )
        
    print("\nDone! Rides are now correctly 'requested'.")

if __name__ == '__main__':
    fix_reset_rides()
