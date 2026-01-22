import requests
import sys
import json
from datetime import datetime

class MuluRidesAPITester:
    def __init__(self, base_url="https://mulu-rides.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.super_admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.super_admin_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token and not headers:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_student_registration(self):
        """Test student registration"""
        test_data = {
            "name": "Test Student",
            "email": "teststudent@mulungushi.edu.zm",
            "phone": "+260971234567",
            "password": "testpass123",
            "role": "student"
        }
        
        success, response = self.run_test(
            "Student Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Student registered with ID: {self.user_id}")
            return True
        return False

    def test_super_admin_registration(self):
        """Test super admin auto-detection"""
        test_data = {
            "name": "Reagan Mbao",
            "email": "Reaganmbao5@gmail.com",
            "phone": "+260977654321",
            "password": "testpass123",
            "role": "student"  # Should auto-upgrade to super_admin
        }
        
        success, response = self.run_test(
            "Super Admin Registration",
            "POST",
            "auth/register",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            self.super_admin_id = response['user']['id']
            if response['user']['role'] == 'super_admin':
                print(f"✅ Super admin auto-detection working!")
                return True
            else:
                print(f"❌ Expected super_admin role, got {response['user']['role']}")
        return False

    def test_login(self):
        """Test login functionality"""
        test_data = {
            "email": "teststudent@mulungushi.edu.zm",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Student Login",
            "POST",
            "auth/login",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_super_admin_login(self):
        """Test super admin login"""
        test_data = {
            "email": "Reaganmbao5@gmail.com",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "auth/login",
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.super_admin_token = response['access_token']
            return True
        return False

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_admin_stats(self):
        """Test admin stats endpoint"""
        # Use super admin token
        headers = {'Authorization': f'Bearer {self.super_admin_token}'}
        success, response = self.run_test(
            "Admin Stats",
            "GET",
            "admin/stats",
            200,
            headers=headers
        )
        
        if success:
            expected_keys = ['total_users', 'total_drivers', 'total_rides', 'commission_rate']
            for key in expected_keys:
                if key not in response:
                    print(f"❌ Missing key in stats: {key}")
                    return False
            print(f"   Stats: {json.dumps(response, indent=2)}")
        return success

    def test_admin_users(self):
        """Test admin users endpoint"""
        headers = {'Authorization': f'Bearer {self.super_admin_token}'}
        success, response = self.run_test(
            "Admin Get Users",
            "GET",
            "admin/users",
            200,
            headers=headers
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} users")
        return success

    def test_admin_drivers(self):
        """Test admin drivers endpoint"""
        headers = {'Authorization': f'Bearer {self.super_admin_token}'}
        success, response = self.run_test(
            "Admin Get Drivers",
            "GET",
            "admin/drivers",
            200,
            headers=headers
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} drivers")
        return success

    def test_admin_settings(self):
        """Test admin settings endpoint"""
        headers = {'Authorization': f'Bearer {self.super_admin_token}'}
        success, response = self.run_test(
            "Admin Get Settings",
            "GET",
            "admin/settings",
            200,
            headers=headers
        )
        
        if success:
            if 'commission_rate' in response:
                print(f"   Commission rate: {response['commission_rate']}%")
            else:
                print("❌ Missing commission_rate in settings")
                return False
        return success

    def test_driver_registration(self):
        """Test driver profile registration"""
        driver_data = {
            "vehicle_type": "car",
            "plate_number": "ABC123",
            "vehicle_model": "Toyota Corolla",
            "vehicle_color": "White"
        }
        
        success, response = self.run_test(
            "Driver Profile Registration",
            "POST",
            "drivers/register",
            200,
            data=driver_data
        )
        return success

    def test_ride_request(self):
        """Test ride request"""
        ride_data = {
            "pickup_location": {
                "lat": -14.4087,
                "lng": 28.2849,
                "address": "Mulungushi University Main Gate"
            },
            "dropoff_location": {
                "lat": -14.4200,
                "lng": 28.2900,
                "address": "Kabwe Town Center"
            },
            "estimated_fare": 25.0,
            "estimated_distance": 5.2,
            "estimated_duration": 15
        }
        
        success, response = self.run_test(
            "Ride Request",
            "POST",
            "rides/request",
            200,
            data=ride_data
        )
        
        if success and 'id' in response:
            print(f"   Ride created with ID: {response['id']}")
        return success

    def test_fare_estimation(self):
        """Test fare estimation"""
        fare_data = {
            "distance_km": 5.0,
            "duration_min": 15
        }
        
        success, response = self.run_test(
            "Fare Estimation",
            "POST",
            "rides/estimate-fare",
            200,
            data=fare_data
        )
        
        if success and 'estimated_fare' in response:
            print(f"   Estimated fare: K{response['estimated_fare']}")
        return success

def main():
    print("🚗 MuluRides API Testing Suite")
    print("=" * 50)
    
    tester = MuluRidesAPITester()
    
    # Test sequence
    tests = [
        ("Student Registration", tester.test_student_registration),
        ("Super Admin Registration", tester.test_super_admin_registration),
        ("Student Login", tester.test_login),
        ("Super Admin Login", tester.test_super_admin_login),
        ("Get Current User", tester.test_get_me),
        ("Admin Stats", tester.test_admin_stats),
        ("Admin Users List", tester.test_admin_users),
        ("Admin Drivers List", tester.test_admin_drivers),
        ("Admin Settings", tester.test_admin_settings),
        ("Driver Registration", tester.test_driver_registration),
        ("Ride Request", tester.test_ride_request),
        ("Fare Estimation", tester.test_fare_estimation),
    ]
    
    print(f"\nRunning {len(tests)} tests...\n")
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())