import requests
import uuid
import time

BASE_URL = "http://localhost:8000/api"

def test_direct_driver_signup():
    print("--- Starting Direct Driver Signup Verification ---")
    
    # 1. Generate unique user
    unique_id = str(uuid.uuid4())[:8]
    email = f"driver_direct_{unique_id}@test.com"
    password = "password123"
    name = f"Driver Direct {unique_id}"
    
    print(f"1. Registering User: {email}")
    
    # Register as STUDENT first (mimicking frontend flow)
    reg_payload = {
        "email": email,
        "password": password,
        "name": name,
        "phone": "0966000000",
        "role": "student"
    }
    
    try:
        reg_response = requests.post(f"{BASE_URL}/auth/register", json=reg_payload)
        reg_response.raise_for_status()
        data = reg_response.json()
        token = data["access_token"]
        user_id = data["user"]["id"]
        print(f"   Success! User ID: {user_id}")
        print(f"   Token received: {token[:10]}...")
    except Exception as e:
        print(f"   FAILED to register user: {e}")
        if 'reg_response' in locals():
            print(f"   Response: {reg_response.text}")
        return

    # 2. Register as Driver immediately using the token
    print("\n2. Registering as Driver (using new token)...")
    
    driver_payload = {
        "vehicle_type": "car",
        "plate_number": f"TEST-{unique_id}",
        "vehicle_model": "Toyota Vitz",
        "vehicle_color": "Silver"
    }
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        # Mimic the immediate follow-up request
        driver_response = requests.post(
            f"{BASE_URL}/drivers/register", 
            json=driver_payload,
            headers=headers
        )
        
        if driver_response.status_code == 200:
            print("   Success! Driver profile created.")
            driver_data = driver_response.json()
            print(f"   Driver ID: {driver_data['id']}")
            print(f"   Is Approved: {driver_data['is_approved']} (Should be False)")
        else:
            print(f"   FAILED with status {driver_response.status_code}")
            print(f"   Response: {driver_response.text}")
            return
            
    except Exception as e:
        print(f"   Exception during driver reg: {e}")
        return

    print("\n--- Verification PASSED: API Flow is Valid ---")

if __name__ == "__main__":
    test_direct_driver_signup()
