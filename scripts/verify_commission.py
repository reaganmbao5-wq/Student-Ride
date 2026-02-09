import requests
import json
import time

BASE_URL = "http://localhost:8000/api"
STUDENT_EMAIL = "student@test.com"
DRIVER_EMAIL = "driver@test.com"
PASSWORD = "student123" 
DRIVER_PASS = "driver123"

def run_test():
    try:
        # 1. Login Student
        print("Logging in Student...")
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": STUDENT_EMAIL, "password": PASSWORD})
        if resp.status_code != 200:
            print(f"Student Login Failed: {resp.status_code} {resp.text}")
            return
        student_token = resp.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        # 2. Login Driver
        print("Logging in Driver...")
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": DRIVER_EMAIL, "password": DRIVER_PASS})
        if resp.status_code != 200:
            print(f"Driver Login Failed: {resp.status_code} {resp.text}")
            return
        driver_token = resp.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Get initial wallet balance
        resp = requests.get(f"{BASE_URL}/drivers/me", headers=driver_headers)
        if resp.status_code != 200:
            print(f"Get Profile Failed: {resp.status_code} {resp.text}")
            return
        driver_profile = resp.json()
        initial_balance = driver_profile["wallet_balance"]
        initial_due = driver_profile["total_commission_due"]
        print(f"Initial Wallet Balance: {initial_balance}")
        
        # 3. Request Ride (Student)
        print("Requesting Ride...")
        req_data = {
            "pickup_location": {"lat": -14.42, "lng": 28.45, "address": "Test Pickup"},
            "dropoff_location": {"lat": -14.43, "lng": 28.46, "address": "Test Dropoff"},
            "estimated_fare": 50.0,
            "estimated_distance": 2.0,
            "estimated_duration": 10
        }
        resp = requests.post(f"{BASE_URL}/rides/request", json=req_data, headers=student_headers)
        if resp.status_code != 200:
             print(f"Ride Request Failed: {resp.status_code} {resp.text}")
             return
             
        ride = resp.json()
        ride_id = ride["id"]
        print(f"Ride Requested: {ride_id}, Calculated Fare: {ride['fare']}")
        
        # 4. Accept Ride (Driver)
        print("Accepting Ride...")
        resp = requests.post(f"{BASE_URL}/rides/{ride_id}/accept", headers=driver_headers)
        if resp.status_code != 200:
             print(f"Accept Failed: {resp.status_code} {resp.text}")
             return
        
        # 5. Complete Ride
        print("Completing Ride...")
        requests.post(f"{BASE_URL}/rides/{ride_id}/arrived", headers=driver_headers)
        requests.post(f"{BASE_URL}/rides/{ride_id}/start", headers=driver_headers)
        resp = requests.post(f"{BASE_URL}/rides/{ride_id}/complete", headers=driver_headers)
        if resp.status_code != 200:
             print(f"Complete Failed: {resp.status_code} {resp.text}")
             return
        print(f"Completion Response: {resp.json()}")
        
        # 6. Verify Wallet
        print("Verifying Wallet Update...")
        driver_profile = requests.get(f"{BASE_URL}/drivers/me", headers=driver_headers).json()
        final_balance = driver_profile["wallet_balance"]
        final_due = driver_profile["total_commission_due"]
        
        commission = ride["commission"]
        
        print(f"Final Balance: {final_balance} (Expected: {initial_balance - commission})")
        
        if abs(final_balance - (initial_balance - commission)) < 0.1:
            print("SUCCESS: Balance deducted correctly.")
        else:
            print("FAILED: Balance mismatch.")

        if abs(final_due - (initial_due + commission)) < 0.1:
            print("SUCCESS: Commission Due updated correctly.")
        else:
            print("FAILED: Commission Due mismatch.")
            
    except Exception as e:
        print(f"Unexpected Error: {e}")

if __name__ == "__main__":
    run_test()
