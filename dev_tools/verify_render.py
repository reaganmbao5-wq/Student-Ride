import urllib.request
import urllib.error
import json

backend_url = 'https://student-ride-backend-dev.onrender.com'
frontend_url = 'https://student-ride-frontend-dev.onrender.com'

print('=== 1. VERIFYING BACKEND ENVIRONMENT ON RENDER ===')

# A. Test Database Connection (MongoDB)
try:
    req = urllib.request.Request(f'{backend_url}/api/destinations', headers={'User-Agent': 'TestClient'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f'[PASS] MongoDB Connected: /api/destinations returned {len(data)} destinations')
except Exception as e:
    print(f'[FAIL] MongoDB / Destinations Check: {e}')

# B. Test Google Auth Endpoint
try:
    payload = json.dumps({'id_token': 'dummy_test_token'}).encode('utf-8')
    req = urllib.request.Request(
        f'{backend_url}/api/auth/google',
        data=payload,
        headers={'Content-Type': 'application/json', 'User-Agent': 'TestClient'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        print('[INFO] Google Auth returned:', resp.status)
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8', errors='ignore')
    if 'Invalid Google token' in err_body or 'Invalid ID token' in err_body or 'GOOGLE_AUTH_FAILED' in err_body:
        print(f'[PASS] Google OAuth Service Active: Backend reached Google OAuth validation and responded ({e.code})')
    else:
        print(f'[INFO] Google Auth response ({e.code}): {err_body}')
except Exception as e:
    print(f'[FAIL] Google Auth Request: {e}')
