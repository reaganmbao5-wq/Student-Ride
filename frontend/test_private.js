const puppeteer = require('puppeteer');

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runPrivateTest() {
    console.log("Starting Section 3: Private Ride");
    const browser = await puppeteer.launch({ headless: false, args: ['--start-maximized'] });
    
    // Contexts
    const ctxStudent = await browser.createBrowserContext();
    const ctxDriver = await browser.createBrowserContext();

    const pageStudent = await ctxStudent.newPage();
    const pageDriver = await ctxDriver.newPage();
    
    // Login Student
    await pageStudent.goto('http://localhost:3000/login');
    await pageStudent.waitForSelector('input[type="email"]');
    await pageStudent.type('input[type="email"]', 'student_a@qa.com');
    await pageStudent.type('input[type="password"]', 'password123');
    await pageStudent.click('button[type="submit"]');

    // Login Driver
    await pageDriver.goto('http://localhost:3000/login');
    await pageDriver.waitForSelector('input[type="email"]');
    await pageDriver.type('input[type="email"]', 'driver_a@qa.com');
    await pageDriver.type('input[type="password"]', 'password123');
    await pageDriver.click('button[type="submit"]');

    console.log("Waiting for dashboards...");
    await delay(3000);

    // Take screenshot of driver dashboard
    await pageDriver.screenshot({ path: 'qa_driver_dashboard_initial.png' });
    
    // Take screenshot of student dashboard
    await pageStudent.screenshot({ path: 'qa_student_dashboard_initial.png' });
    
    console.log("Both logged in. Test script will now exit (Phase 1 check).");
    await browser.close();
}

runPrivateTest();
