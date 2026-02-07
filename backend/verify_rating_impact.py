
import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

def login(email, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    return resp.json()

def run_test():
    print("--- starting rating impact verification ---")

    # 1. Login Driver & Get Initial Rating
    driver_auth = login("driver@test.com", "driver123")
    driver_token = driver_auth["access_token"]
    driver_headers = {"Authorization": f"Bearer {driver_token}"}
    
    # Toggle Online to make sure we are visible (and to get profile)
    requests.post(f"{BASE_URL}/drivers/toggle-online", headers=driver_headers)
    
    # Get Profile for Rating
    profile_resp = requests.get(f"{BASE_URL}/drivers/me", headers=driver_headers)
    initial_rating = profile_resp.json().get("rating", 5.0)
    print(f"Initial Driver Rating: {initial_rating}")

    # 2. Login Student & Request Ride
    student_auth = login("student@test.com", "student123")
    student_token = student_auth["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}

    ride_req = {
        "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "Test Pickup"},
        "dropoff_location": {"lat": -14.43, "lng": 28.46, "address": "Test Dropoff"},
        "estimated_fare": 50.0,
        "estimated_distance": 2.5,
        "estimated_duration": 10
    }
    
    print("Requesting Ride...")
    ride_resp = requests.post(f"{BASE_URL}/rides/request", json=ride_req, headers=student_headers)
    ride_id = ride_resp.json()["id"]
    print(f"Ride Requested (ID: {ride_id})")

    # 3. Driver Accepts & Completes
    print("Driver Accepting...")
    requests.post(f"{BASE_URL}/rides/{ride_id}/accept", headers=driver_headers)
    
    print("Driver Arriving...")
    requests.post(f"{BASE_URL}/rides/{ride_id}/arrived", headers=driver_headers)
    
    print("Starting Trip...")
    requests.post(f"{BASE_URL}/rides/{ride_id}/start", headers=driver_headers)
    
    print("Completing Trip...")
    requests.post(f"{BASE_URL}/rides/{ride_id}/complete", headers=driver_headers)

    # 4. Student Rates LOW (1 Star)
    print("Student Rating 1 Star...")
    rate_resp = requests.post(f"{BASE_URL}/rides/{ride_id}/rate", json={"rating": 1, "review": "Very bad service simulation"}, headers=student_headers)
    if rate_resp.status_code != 200:
        print(f"Rating Failed! {rate_resp.text}")
        return

    # 5. Check Driver Rating Again
    time.sleep(1) # checking for async update
    profile_resp_new = requests.get(f"{BASE_URL}/drivers/me", headers=driver_headers)
    new_rating = profile_resp_new.json().get("rating")
    
    print(f"New Driver Rating: {new_rating}")
    
    if new_rating < initial_rating:
        print("SUCCESS: Driver rating decreased!")
    elif new_rating == initial_rating:
        print("WARNING: Rating did not change (might need more 1-star ratings to move the average if many rides exist).")
    else:
        print("FAIL: Rating increased?")

if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"Test Failed: {e}")
