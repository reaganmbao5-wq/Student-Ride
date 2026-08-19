from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))
    page.on("response", lambda res: print(f"[NETWORK RES] {res.status} {res.url}") if "/api/" in res.url else None)
    
    print("Navigating to /auth...")
    page.goto("http://localhost:3000/auth")
    page.wait_for_selector('input[type="email"]')
    
    print("Filling credentials...")
    page.fill('input[type="email"]', "accountant@test.com")
    page.fill('input[type="password"]', "password123")
    
    print("Clicking Sign In...")
    page.click('button[type="submit"]')
    time.sleep(3)
    
    print("Current URL:", page.url)
    page.screenshot(path="backend/qa_suite/accountant_login_debug.png")
    print("Screenshot saved.")
    browser.close()
