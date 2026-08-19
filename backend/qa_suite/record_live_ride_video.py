import asyncio
import os
import sys
import time
import json
import requests
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv("backend/.env")

ARTIFACTS_DIR = Path(r"C:\Users\Reaga\.gemini\antigravity\brain\9dafeec0-5761-4aeb-8e8b-d3b020a0ec11")
VIDEOS_DIR = ARTIFACTS_DIR / "videos"
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

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

def get_frontend_url():
    for url in ["https://student-ride-frontend-dev.onrender.com", "https://mulungushistudentride.site"]:
        try:
            r = session.get(url, timeout=4)
            if r.status_code == 200:
                return url
        except Exception:
            pass
    return "https://student-ride-frontend-dev.onrender.com"

BASE_URL = os.getenv("FRONTEND_URL", get_frontend_url())
BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", get_backend_url())

def record_live_ride_videos():
    print("==================================================================")
    print("🎥 STARTING HIGH-DEFINITION FULL RIDE VIDEO RECORDING ENGINE")
    print(f"Artifacts Destination: {VIDEOS_DIR}")
    print(f"Frontend: {BASE_URL} | Backend: {BACKEND_URL}")
    print("==================================================================")
    
    # Authenticate
    r_stu = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "student@test.com", "password": "password123"})
    stu_token = r_stu.json().get("access_token")
    stu_user_str = json.dumps(r_stu.json().get("user"))
    
    r_drv = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": "driver@test.com", "password": "password123"})
    drv_token = r_drv.json().get("access_token")
    drv_user_str = json.dumps(r_drv.json().get("user"))
    
    # Clean stale rides
    try:
        r_stale = session.get(f"{BACKEND_URL}/api/rides/active", headers={"Authorization": f"Bearer {stu_token}"})
        if r_stale.status_code == 200 and r_stale.json() and r_stale.json().get("id"):
            stale_id = r_stale.json().get("id")
            session.post(f"{BACKEND_URL}/api/rides/{stale_id}/cancel", json={"reason": "clean_video_record"}, headers={"Authorization": f"Bearer {stu_token}"})
            print("🧹 Cleaned prior active ride.")
    except Exception:
        pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Temp video directories
        stu_video_dir = VIDEOS_DIR / "temp_stu"
        drv_video_dir = VIDEOS_DIR / "temp_drv"
        stu_video_dir.mkdir(parents=True, exist_ok=True)
        drv_video_dir.mkdir(parents=True, exist_ok=True)
        
        student_ctx = browser.new_context(
            viewport={"width": 430, "height": 932},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
            has_touch=True,
            is_mobile=True,
            record_video_dir=str(stu_video_dir),
            record_video_size={"width": 430, "height": 932}
        )
        student_ctx.add_init_script(f"""
            localStorage.setItem('token', '{stu_token}');
            localStorage.setItem('mulu_user_cache', JSON.stringify({stu_user_str}));
            localStorage.setItem('user', JSON.stringify({stu_user_str}));
        """)
        
        driver_ctx = browser.new_context(
            viewport={"width": 430, "height": 932},
            user_agent="Mozilla/5.0 (Linux; Android 14; Galaxy S24) AppleWebKit/537.36 Mobile Safari/537.36",
            has_touch=True,
            is_mobile=True,
            record_video_dir=str(drv_video_dir),
            record_video_size={"width": 430, "height": 932}
        )
        driver_ctx.add_init_script(f"""
            localStorage.setItem('token', '{drv_token}');
            localStorage.setItem('mulu_user_cache', JSON.stringify({drv_user_str}));
            localStorage.setItem('user', JSON.stringify({drv_user_str}));
        """)
        
        student_page = student_ctx.new_page()
        driver_page = driver_ctx.new_page()
        
        print("\n[Scene 1] Loading Student Map & Transit Stepper...")
        student_page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded", timeout=30000)
        driver_page.goto(f"{BASE_URL}/driver", wait_until="domcontentloaded", timeout=30000)
        student_page.wait_for_selector('text=Request a Ride', timeout=25000)
        time.sleep(2)
        
        print("[Scene 2] Driver goes Online for Live Dispatch...")
        driver_page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const toggle = btns.find(b => b.classList.contains('bg-muted') || !b.classList.contains('bg-emerald-500'));
            if (toggle) toggle.click();
        }""")
        time.sleep(2)
        
        print("[Scene 3] Student Requests Ride (Main Campus Gate -> School of Medicine)...")
        ride_payload = {
            "pickup_location": {"lat": -14.4087, "lng": 28.2849, "address": "Main Campus Gate"},
            "dropoff_location": {"lat": -14.4140, "lng": 28.2890, "address": "School of Medicine"},
            "ride_mode": "shared",
            "passenger_count": 1,
            "fare": 15.0
        }
        res_req = session.post(f"{BACKEND_URL}/api/rides/request", json=ride_payload, headers={"Authorization": f"Bearer {stu_token}"})
        ride_id = res_req.json().get("id")
        print(f"  -> Ride Request Created: {ride_id}")
        time.sleep(3)
        
        print("[Scene 4] Driver Receives Instant Dispatch & Accepts Ride (Zero-Flicker Lock)...")
        res_acc = session.post(f"{BACKEND_URL}/api/rides/{ride_id}/accept", headers={"Authorization": f"Bearer {drv_token}"})
        time.sleep(3)
        
        # Driver simulation: approach leg coordinates moving towards pickup
        approach_coords = [
            (-14.4060, 28.2830),
            (-14.4068, 28.2835),
            (-14.4075, 28.2840),
            (-14.4082, 28.2845),
            (-14.4087, 28.2849) # At pickup
        ]
        
        print("[Scene 5] Real-Time GPS Tracking: Driver En Route to Pickup Point...")
        for i, (lat, lng) in enumerate(approach_coords, 1):
            session.post(f"{BACKEND_URL}/api/drivers/location", json={"latitude": lat, "longitude": lng, "heading": 135.0}, headers={"Authorization": f"Bearer {drv_token}"})
            time.sleep(1.5)
            print(f"  -> GPS Waypoint {i}/{len(approach_coords)}: ({lat}, {lng})")
            
        print("[Scene 6] Driver Arrives at Pickup Point (<50m proximity)...")
        session.post(f"{BACKEND_URL}/api/rides/{ride_id}/arrived", headers={"Authorization": f"Bearer {drv_token}"})
        time.sleep(3)
        
        print("[Scene 7] Passenger Boards & Trip Starts...")
        session.post(f"{BACKEND_URL}/api/rides/{ride_id}/start", headers={"Authorization": f"Bearer {drv_token}"})
        time.sleep(3)
        
        # Trip simulation: transit leg coordinates towards School of Medicine
        trip_coords = [
            (-14.4095, 28.2855),
            (-14.4105, 28.2865),
            (-14.4118, 28.2875),
            (-14.4130, 28.2882),
            (-14.4140, 28.2890) # Destination reached
        ]
        
        print("[Scene 8] Real-Time Navigation: Driving to Destination (School of Medicine)...")
        for i, (lat, lng) in enumerate(trip_coords, 1):
            session.post(f"{BACKEND_URL}/api/drivers/location", json={"latitude": lat, "longitude": lng, "heading": 150.0}, headers={"Authorization": f"Bearer {drv_token}"})
            time.sleep(1.5)
            print(f"  -> Transit Waypoint {i}/{len(trip_coords)}: ({lat}, {lng})")
            
        print("[Scene 9] Trip Complete at Destination & Wallet Settlement...")
        session.post(f"{BACKEND_URL}/api/rides/{ride_id}/complete", headers={"Authorization": f"Bearer {drv_token}"})
        time.sleep(3)
        
        print("[Scene 10] Student 5-Star Rating & Driver Review...")
        session.post(f"{BACKEND_URL}/api/rides/{ride_id}/rate", json={"rating": 5, "comment": "Seamless ride and great driving!"}, headers={"Authorization": f"Bearer {stu_token}"})
        time.sleep(3)
        
        # Close pages and contexts to finalize videos
        student_page.close()
        driver_page.close()
        student_ctx.close()
        driver_ctx.close()
        browser.close()
        
    print("\n[Post-Processing] Converting Recorded Video Streams to MP4...")
    # Find generated webm files
    stu_webm = list(stu_video_dir.glob("*.webm"))[0]
    drv_webm = list(drv_video_dir.glob("*.webm"))[0]
    
    final_stu_mp4 = VIDEOS_DIR / "student_ride_experience.mp4"
    final_drv_mp4 = VIDEOS_DIR / "driver_ride_navigation.mp4"
    final_split_mp4 = VIDEOS_DIR / "jride_full_lifecycle_multiview.mp4"
    
    # 1. Convert Student video
    subprocess.run(f'ffmpeg -y -i "{stu_webm}" -c:v libx264 -pix_fmt yuv420p -r 30 "{final_stu_mp4}"', shell=True)
    print(f"✅ Student Experience Video saved: {final_stu_mp4}")
    
    # 2. Convert Driver video
    subprocess.run(f'ffmpeg -y -i "{drv_webm}" -c:v libx264 -pix_fmt yuv420p -r 30 "{final_drv_mp4}"', shell=True)
    print(f"✅ Driver Navigation Video saved: {final_drv_mp4}")
    
    # 3. Create Side-by-Side Dual Perspective Video
    subprocess.run(
        f'ffmpeg -y -i "{final_stu_mp4}" -i "{final_drv_mp4}" -filter_complex "[0:v][1:v]hstack=inputs=2[v]" -map "[v]" -c:v libx264 -pix_fmt yuv420p -r 30 "{final_split_mp4}"',
        shell=True
    )
    print(f"✅ Side-by-Side Dual-Perspective Video saved: {final_split_mp4}")
    
    # Clean temp folders
    try:
        stu_webm.unlink()
        drv_webm.unlink()
        stu_video_dir.rmdir()
        drv_video_dir.rmdir()
    except Exception:
        pass
        
    print("\n==================================================================")
    print("🏆 ALL HIGH-DEFINITION RIDE VIDEOS SUCCESSFULLY RECORDED & PERSISTED!")
    print(f"1. Student View : {final_stu_mp4}")
    print(f"2. Driver View  : {final_drv_mp4}")
    print(f"3. Dual View    : {final_split_mp4}")
    print("==================================================================")

if __name__ == "__main__":
    record_live_ride_videos()
