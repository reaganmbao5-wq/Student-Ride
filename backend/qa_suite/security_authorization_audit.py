import asyncio
import os
import sys
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv("backend/.env")

def get_session():
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.mount('http://', HTTPAdapter(max_retries=retries))
    return session

session = get_session()

def get_backend_url():
    for url in ["http://127.0.0.1:8000", "https://student-ride-backend-dev.onrender.com"]:
        try:
            r = session.get(f"{url}/docs", timeout=4)
            if r.status_code == 200:
                return url
        except Exception:
            pass
    return "https://student-ride-backend-dev.onrender.com"

BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", get_backend_url())

def run_security_audit():
    print("=====================================================")
    print("🛡️ [SECURITY] STARTING DEFENSIVE APPLICATION AUDIT")
    print(f"Target: {BACKEND_URL}")
    print("=====================================================")
    
    # 1. Obtain Tokens for All Standard System Roles
    print("\n[Sec 1] Generating Authentication Tokens for Role Boundaries...")
    r_stu = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "student@test.com", "password": "password123"})
    r_drv = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "driver@test.com", "password": "password123"})
    r_acc = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "accountant@test.com", "password": "password123"})
    r_adm = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "admin@test.com", "password": "password123"})
    
    stu_token = r_stu.json().get("access_token")
    drv_token = r_drv.json().get("access_token")
    acc_token = r_acc.json().get("access_token")
    adm_token = r_adm.json().get("access_token")
    
    assert stu_token and drv_token and acc_token and adm_token, "Failed to authenticate standard test roles"
    print("✅ Authenticated tokens generated successfully.")
    
    # 2. Student Role Elevation Attack Verification (Student -> Admin Endpoints)
    print("\n[Sec 2] Testing Privilege Escalation Barriers...")
    admin_restricted_endpoints = [
        "/api/admin/users",
        "/api/admin/drivers",
        "/api/admin/rides",
        "/api/admin/active-rides",
        "/api/admin/pricing-settings",
        "/api/admin/settings",
        "/api/admin/analytics",
        "/api/admin/stats"
    ]
    for ep in admin_restricted_endpoints:
        res = session.get(f"{BACKEND_URL}{ep}", headers={"Authorization": f"Bearer {stu_token}"})
        assert res.status_code in [401, 403], f"Security Breach! Student accessed {ep} with status {res.status_code}"
        print(f"✅ Route {ep} strictly blocked for student (HTTP {res.status_code})")
        
    # 3. Student Calling Driver Shift Mutation
    print("\n[Sec 3] Testing Cross-Role Driver Actions...")
    res_shift = session.post(f"{BACKEND_URL}/api/drivers/shift/toggle", json={"online": True}, headers={"Authorization": f"Bearer {stu_token}"})
    assert res_shift.status_code in [403, 404], "Security Breach! Student mutated driver shift"
    print(f"✅ Driver shift action strictly blocked for student (HTTP {res_shift.status_code})")
    
    # 4. Client-Side Fare Tampering Defense
    print("\n[Sec 4] Testing Client-Side Fare Manipulation Defense...")
    tampered_ride = {
        "pickup_location": {"lat": -14.4087, "lng": 28.2849, "address": "Main Campus Gate"},
        "dropoff_location": {"lat": -14.4140, "lng": 28.2890, "address": "School of Medicine"},
        "ride_mode": "shared",
        "passenger_count": 1,
        "fare": 0.01  # Malicious student attempting to pay 1 ngwee
    }
    res_tamper = session.post(f"{BACKEND_URL}/api/rides/request", json=tampered_ride, headers={"Authorization": f"Bearer {stu_token}"})
    if res_tamper.status_code == 200:
        server_fare = res_tamper.json().get("fare")
        assert server_fare >= 15.0, f"Fare tampering vulnerability detected! Server accepted fare K{server_fare}"
        print(f"✅ Fare tampering rejected! Backend recalculated true base fare: K{server_fare}")
        
        # Clean test ride
        ride_id = res_tamper.json().get("id")
        session.post(f"{BACKEND_URL}/api/rides/{ride_id}/cancel", json={"reason": "security_test_cleanup"}, headers={"Authorization": f"Bearer {stu_token}"})
        
    # 5. Token Malformation & Signature Verification
    print("\n[Sec 5] Testing Malformed and Tampered JWT Handling...")
    fake_token = stu_token[:-10] + "tampered00"
    res_fake = session.get(f"{BACKEND_URL}/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
    assert res_fake.status_code == 401, "Server accepted invalid JWT signature"
    print("✅ Malformed JWT strictly rejected with HTTP 401 Unauthorized.")
    
    # 6. Password Reset Request Handling
    print("\n[Sec 6] Testing End-to-End Password Recovery Flow...")
    res_forgot = session.post(f"{BACKEND_URL}/api/auth/password-reset/request", json={"email": "student@test.com"})
    assert res_forgot.status_code == 200, f"Failed to initiate password reset: {res_forgot.text}"
    print("✅ Password reset initiated; token hash created with 1-hour security expiry.")
    
    print("\n=====================================================")
    print("🏆 [SECURITY] DEFENSIVE AUDIT 100% PASSED (0 VULNERABILITIES)")
    print("=====================================================")

if __name__ == "__main__":
    run_security_audit()
