import asyncio
import os
import sys
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv("backend/.env")

def get_session():
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.mount('http://', HTTPAdapter(max_retries=retries))
    return session

session = get_session()

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

VIEWPORTS = [
    {"name": "Mobile Small (SE)", "width": 375, "height": 667, "is_mobile": True},
    {"name": "iPhone 15 Pro", "width": 393, "height": 852, "is_mobile": True},
    {"name": "Android Flagship (Pixel 8)", "width": 412, "height": 915, "is_mobile": True},
    {"name": "iPad Portrait", "width": 768, "height": 1024, "is_mobile": True},
    {"name": "iPad Landscape", "width": 1024, "height": 768, "is_mobile": False},
    {"name": "Standard Laptop", "width": 1280, "height": 800, "is_mobile": False},
    {"name": "Desktop 1080p", "width": 1920, "height": 1080, "is_mobile": False},
    {"name": "Ultra-wide 1440p", "width": 2560, "height": 1440, "is_mobile": False}
]

def run_responsive_matrix():
    print("=====================================================")
    print("📱 [RESPONSIVE] AUDITING 8 VIEWPORT CLASSES")
    print(f"Target Frontend: {BASE_URL}")
    print("=====================================================")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for vp in VIEWPORTS:
            print(f"\n[Testing Viewport: {vp['name']} ({vp['width']}x{vp['height']})]")
            ctx = browser.new_context(
                viewport={"width": vp["width"], "height": vp["height"]},
                is_mobile=vp["is_mobile"],
                has_touch=vp["is_mobile"]
            )
            page = ctx.new_page()
            
            # 1. Landing Page
            page.goto(f"{BASE_URL}/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(1)
            
            # Check for horizontal overflow
            scroll_width = page.evaluate("document.documentElement.scrollWidth")
            inner_width = page.evaluate("window.innerWidth")
            assert scroll_width <= inner_width + 2, f"Horizontal overflow detected on Landing ({scroll_width} > {inner_width})"
            print(f"  ✅ Landing Page: Zero horizontal overflow ({scroll_width}px <= {inner_width}px)")
            
            # 2. Auth Page
            page.goto(f"{BASE_URL}/auth", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector('input[type="email"]', timeout=20000)
            email_box = page.query_selector('input[type="email"]').bounding_box()
            assert email_box["width"] > 150, f"Email input too narrow on {vp['name']}"
            print(f"  ✅ Auth Page: Input forms cleanly scaled ({round(email_box['width'])}px width)")
            
            ctx.close()
            
        print("\n=====================================================")
        print("🏆 [RESPONSIVE] ALL 8 VIEWPORTS PASSED WITH ZERO OVERFLOW")
        print("=====================================================")
        browser.close()

if __name__ == "__main__":
    run_responsive_matrix()
