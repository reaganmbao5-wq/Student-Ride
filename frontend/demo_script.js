const puppeteer = require('puppeteer');

(async () => {
    console.log('🎬 Starting FULL Demo Automation...');
    console.log('⚠️  PLEASE DO NOT TOUCH THE BROWSER WINDOW');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        slowMo: 150 // Slower for better recording
    });

    const page = await browser.newPage();

    // Capture Page Errors
    page.on('pageerror', error => {
        console.error('------- BROWSER CONSOLE ERROR -------');
        console.error(error.message);
        console.error('-------------------------------------');
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`PAGE LOG ERROR: ${msg.text()}`);
        }
    });

    // --- HELPER FUNCTIONS ---
    // Safe click that logs but doesn't crash
    const safeClick = async (selector, description) => {
        try {
            console.log(`👉 Attempting to click: ${description} (${selector})`);
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            await new Promise(r => setTimeout(r, 1000)); // Pause after click
            return true;
        } catch (e) {
            console.log(`⚠️  Skipping ${description}: Element not found or clickable.`);
            return false;
        }
    };

    // Safe type
    const safeType = async (selector, text, description) => {
        try {
            console.log(`⌨️  Typing ${description}...`);
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            // Clear input first just in case
            await page.evaluate(sel => document.querySelector(sel).value = '', selector);
            await page.type(selector, text, { delay: 100 });
            return true;
        } catch (e) {
            console.log(`⚠️  Skipping typing ${description}: Input not found.`);
            return false;
        }
    };

    // Logout Helper
    const performLogout = async () => {
        console.log('👋 Logging out...');
        // Try button first - look for any button that looks like logout
        // Or navigation to auth
        await page.evaluate(() => localStorage.clear());
        await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000));
    };

    try {
        // ==========================================
        // 1. STUDENT FLOW
        // ==========================================
        console.log('\n--- 🎓 STUDENT FLOW ---');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000));

        // Navigate to Login if not redirected
        const success = await safeClick('[data-testid="get-started-btn"]', 'Get Started');
        if (!success) {
            if (page.url() !== 'http://localhost:3000/auth') {
                await page.goto('http://localhost:3000/auth');
            }
        }

        // Login
        await safeClick('[data-testid="login-tab"]', 'Sign In Tab');
        await safeType('[data-testid="email-input"]', 'student@test.com', 'Student Email');
        await safeType('[data-testid="password-input"]', 'student123', 'Student Password');
        await safeClick('[data-testid="submit-btn"]', 'Login Button');

        // Dashboard Exploration
        console.log('⏳ Waiting for Dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));

        // Click everything clickable on dashboard to "explore"
        await safeClick('a[href="/request-ride"]', 'Request Ride Link');

        // Ride Request Page
        console.log('🗺️  Selecting Locations to Trigger Crash...');
        await new Promise(r => setTimeout(r, 3000));

        // 1. Pickup
        console.log('📍 Selecting Pickup on Map...');
        await page.mouse.click(500, 400);
        await new Promise(r => setTimeout(r, 1000));

        console.log('👉 Clicking Continue (Pickup)...');
        await safeClick('[data-testid="next-btn"]', 'Continue Button');
        await new Promise(r => setTimeout(r, 1000));

        // 2. Dropoff
        console.log('📍 Selecting Dropoff on Map...');
        await page.mouse.click(600, 450);
        await new Promise(r => setTimeout(r, 1000));

        console.log('👉 Clicking Continue (Dropoff) - Expecting Crash...');
        await safeClick('[data-testid="next-btn"]', 'Continue Button');

        console.log('⏳ Waiting for error...');
        await new Promise(r => setTimeout(r, 5000));

        await performLogout();

        // ==========================================
        // 2. DRIVER FLOW (SKIPPED)
        // ==========================================
        /*
        console.log('\n--- 🚗 DRIVER FLOW ---');
        // Ensure we are at auth
        if (!page.url().includes('auth')) {
            await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle0' });
        }
        
        await safeClick('[data-testid="login-tab"]', 'Sign In Tab');
        await safeType('[data-testid="email-input"]', 'driver@test.com', 'Driver Email');
        await safeType('[data-testid="password-input"]', 'driver123', 'Driver Password');
        await safeClick('[data-testid="submit-btn"]', 'Login Button');
        
        console.log('⏳ Waiting for Driver Dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));
        
        // Explore Driver Dashboard
        console.log('👀 Viewing Stats...');
        // Toggle Online (look for broad match)
        await safeClick('button', 'Any Button (trying to find toggle)');
        await new Promise(r => setTimeout(r, 2000));
        
        // Check tabs if they exist (Earnings, etc)
        await safeClick('a[href*="earnings"]', 'Earnings Tab');
        await new Promise(r => setTimeout(r, 3000));
        
        await performLogout();
        
        // ==========================================
        // 3. ADMIN FLOW
        // ==========================================
        console.log('\n--- 🛡️ ADMIN FLOW ---');
        if (!page.url().includes('auth')) {
            await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle0' });
        }
        
        await safeClick('[data-testid="login-tab"]', 'Sign In Tab');
        await safeType('[data-testid="email-input"]', 'admin@test.com', 'Admin Email');
        await safeType('[data-testid="password-input"]', 'admin123', 'Admin Password');
        await safeClick('[data-testid="submit-btn"]', 'Login Button');
        
        console.log('⏳ Waiting for Admin Dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => { });
        await new Promise(r => setTimeout(r, 3000));
        
        // Explore Admin Sections
        const adminTabs = [
            { sel: 'a[href="/admin/users"]', name: 'Users' },
            { sel: 'a[href="/admin/drivers"]', name: 'Drivers' },
            { sel: 'a[href="/admin/rides"]', name: 'Rides' },
            { sel: 'a[href="/admin/stats"]', name: 'Stats' }
        ];
        
        for (const tab of adminTabs) {
            console.log(`Openning ${tab.name}...`);
            await safeClick(tab.sel, tab.name);
            await new Promise(r => setTimeout(r, 3000)); // View for 3s
        }
        
        */
        console.log('✅ STUDENT DEMO COMPLETE');
        console.log('Leaving browser open for 60s...');
        await new Promise(r => setTimeout(r, 60000));

    } catch (error) {
        console.error('❌ Major Script Error:', error);
    } finally {
        await browser.close();
    }
})();
