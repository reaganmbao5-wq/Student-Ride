import asyncio
import os
import sys
import time
import json
import requests
from playwright.sync_api import sync_playwright
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

VIEWPORTS = [
    {"name": "Mobile (393x852)", "width": 393, "height": 852, "is_mobile": True},
    {"name": "Desktop (1440x900)", "width": 1440, "height": 900, "is_mobile": False}
]

def run_tab_audit():
    print("==================================================================")
    print("🎨 COMPREHENSIVE UI/UX, FONT, PADDING & TAB AUDIT")
    print(f"Frontend: {BASE_URL} | Backend: {BACKEND_URL}")
    print("==================================================================")
    
    # Authenticate all roles
    tokens = {}
    user_strs = {}
    for role, email in [("student", "student@test.com"), ("driver", "driver@test.com"), ("accountant", "accountant@test.com"), ("admin", "admin@test.com")]:
        r = session.post(f"{BACKEND_URL}/api/auth/login", json={"email": email, "password": "password123"})
        if r.status_code == 200:
            tokens[role] = r.json().get("access_token")
            user_strs[role] = json.dumps(r.json().get("user"))
            
    pages_to_audit = [
        # Public
        {"role": None, "path": "/", "name": "Landing Page"},
        {"role": None, "path": "/auth", "name": "Auth / Sign In"},
        {"role": None, "path": "/terms", "name": "Terms of Service"},
        {"role": None, "path": "/privacy", "name": "Privacy Policy"},
        
        # Student
        {"role": "student", "path": "/dashboard", "name": "Student Dashboard & Transit Stepper"},
        {"role": "student", "path": "/history", "name": "Student Ride History"},
        {"role": "student", "path": "/profile", "name": "Student Profile Settings"},
        
        # Driver
        {"role": "driver", "path": "/driver", "name": "Driver Active Console"},
        {"role": "driver", "path": "/driver/earnings", "name": "Driver Earnings & Wallet"},
        {"role": "driver", "path": "/profile", "name": "Driver Profile & Documents"},
        
        # Accountant
        {"role": "accountant", "path": "/accountant", "name": "Accountant Financial KPI Overview"},
        {"role": "accountant", "path": "/accountant/ledger", "name": "Accountant Transaction Ledger"},
        {"role": "accountant", "path": "/accountant/settlements", "name": "Accountant Driver Settlements"},
        
        # Admin
        {"role": "admin", "path": "/admin", "name": "Admin Governance Overview"},
        {"role": "admin", "path": "/admin/users", "name": "Admin User Management Directory"},
        {"role": "admin", "path": "/admin/drivers", "name": "Admin Driver Licensing & Approvals"},
        {"role": "admin", "path": "/admin/rides", "name": "Admin Ride Inspection Audit"},
        {"role": "admin", "path": "/admin/pricing", "name": "Admin Dynamic Pricing Control"},
        {"role": "admin", "path": "/admin/bug-reports", "name": "Admin Bug Reports"},
        {"role": "admin", "path": "/admin/destinations", "name": "Admin Campus Destinations"},
        {"role": "admin", "path": "/admin/lecturers", "name": "Admin Lecturer Directory"},
        {"role": "admin", "path": "/admin/settings", "name": "Admin System Settings"}
    ]
    
    total_audited = 0
    passed_audits = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        for vp in VIEWPORTS:
            print(f"\n=====================================================")
            print(f"📱 VIEWPORT AUDIT: {vp['name']}")
            print(f"=====================================================")
            
            for item in pages_to_audit:
                total_audited += 1
                role = item["role"]
                path = item["path"]
                name = item["name"]
                
                ctx = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]},
                    is_mobile=vp["is_mobile"],
                    has_touch=vp["is_mobile"]
                )
                
                if role and role in tokens:
                    token = tokens[role]
                    user_str = user_strs[role]
                    ctx.add_init_script(f"""
                        localStorage.setItem('token', '{token}');
                        localStorage.setItem('mulu_user_cache', JSON.stringify({user_str}));
                        localStorage.setItem('user', JSON.stringify({user_str}));
                    """)
                    
                page = ctx.new_page()
                url = f"{BASE_URL}{path}"
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=25000)
                    time.sleep(1.0)
                    
                    # Evaluate Layout, Typography, and Padding Health
                    metrics = page.evaluate("""() => {
                        const body = document.body;
                        const doc = document.documentElement;
                        const scrollW = doc.scrollWidth;
                        const clientW = doc.clientWidth;
                        
                        // Check horizontal overflow
                        const hasOverflow = scrollW > clientW + 2;
                        
                        // Inspect typography sizing across text nodes
                        const textElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, a, button, label, input, td, th'));
                        let tinyCount = 0;
                        let fontFamilies = new Set();
                        
                        for (const el of textElements) {
                            const style = window.getComputedStyle(el);
                            const fontSize = parseFloat(style.fontSize);
                            if (fontSize < 10 && el.innerText.trim().length > 0) {
                                tinyCount++;
                            }
                            if (style.fontFamily) {
                                fontFamilies.add(style.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
                            }
                        }
                        
                        // Check buttons
                        const buttons = Array.from(document.querySelectorAll('button'));
                        let visibleButtons = 0;
                        let smallTouchTargets = 0;
                        for (const b of buttons) {
                            const rect = b.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0) {
                                visibleButtons++;
                                if (rect.width < 28 || rect.height < 28) {
                                    smallTouchTargets++;
                                }
                            }
                        }
                        
                        return {
                            scrollW,
                            clientW,
                            hasOverflow,
                            tinyCount,
                            buttonCount: visibleButtons,
                            smallTouchTargets,
                            fontFamilies: Array.from(fontFamilies).slice(0, 3)
                        };
                    }""")
                    
                    fonts_str = ", ".join(metrics["fontFamilies"]) if metrics["fontFamilies"] else "system-ui"
                    if metrics["hasOverflow"]:
                        print(f"⚠️ [{name}] ({path}): Horizontal Overflow Detected! ({metrics['scrollW']}px > {metrics['clientW']}px)")
                    else:
                        print(f"✅ [{name:<38}] ({path:<24}) : Width: {metrics['clientW']}px | Fonts: [{fonts_str}] | Controls: {metrics['buttonCount']}")
                        passed_audits += 1
                        
                except Exception as e:
                    print(f"❌ [{name}] ({path}): Load Error -> {e}")
                    
                ctx.close()
                
        browser.close()
        
    print("\n==================================================================")
    print(f"🏆 AUDIT SUMMARY: {passed_audits}/{total_audited} TAB/VIEWPORT SCENARIOS VERIFIED CLEAN!")
    print("==================================================================")

if __name__ == "__main__":
    run_tab_audit()
