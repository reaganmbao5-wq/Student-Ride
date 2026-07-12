const puppeteer = require('puppeteer');
const fs = require('fs');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBookingTest() {
    console.log("Starting Section 1 & 2: Booking UI & Map Verification");
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: null,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    });
    
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    
    try {
        console.log("Navigating to login...");
        await page.goto('http://localhost:3000/auth');
        
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'student_a@qa.com');
        await page.type('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        
        console.log("Waiting for dashboard map to load...");
        await page.waitForSelector('.leaflet-container', { timeout: 15000 });
        console.log("Map rendered successfully.");
        
        await delay(3000);
        await page.screenshot({ path: '../qa_booking_map_initial.png' });
        
        console.log("Verifying DOM elements for Booking UI...");
        const html = await page.content();
        fs.writeFileSync('../qa_student_dashboard.html', html);
        
        console.log("DOM saved. Please analyze qa_student_dashboard.html to determine next selectors.");
        
    } catch (e) {
        console.error("Error during test:", e);
    } finally {
        await browser.close();
    }
}

runBookingTest();
