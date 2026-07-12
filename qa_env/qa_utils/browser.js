const puppeteer = require('puppeteer');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class BrowserSession {
    constructor() {
        this.browser = null;
        this.contexts = {};
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        });
    }

    async createActor(roleName, email, password) {
        const ctx = await this.browser.createBrowserContext();
        await ctx.overridePermissions('http://localhost:3005', ['geolocation']);
        const page = await ctx.newPage();
        await page.setGeolocation({ latitude: -14.40, longitude: 28.28 });
        
        const logs = [];
        const networkRequests = [];
        const wsEvents = [];
        let wsConnected = false;

        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            if (text.includes('WEBSOCKET_CONNECTED')) {
                wsEvents.push('CONNECTED');
                wsConnected = true;
            }
            if (text.includes('WebSocket disconnected') || text.includes('WebSocket error')) {
                wsConnected = false;
            }
            if (text.includes('RIDE_REQUEST')) wsEvents.push('RIDE_REQUEST');
        });

        page.on('request', request => {
            if (request.url().includes('/api/') || request.url().includes('/ws')) {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    postData: request.postData()
                });
            }
        });

        // Clear localStorage by visiting a blank page on the same origin first
        await page.goto('http://localhost:3005/');
        await page.evaluate(() => localStorage.clear());

        // Login
        await page.goto('http://localhost:3005/auth');
        try {
            await page.waitForSelector('input[type="email"]', { timeout: 15000 });
        } catch (e) {
            console.log(`[Browser ${roleName}] Navigation to /auth timed out or failed to render. Taking screenshot...`);
            await page.screenshot({ path: `qa_failure_${roleName}.png` }).catch(() => {});
            throw e;
        }
        await page.type('input[type="email"]', email);
        await page.type('input[type="password"]', password);
        await page.click('button[type="submit"]');

        // Wait for dashboard
        try {
            await page.waitForFunction(() => {
                const text = document.body.innerText;
                return text.includes('Hello,') || text.includes('Dashboard');
            }, { timeout: 15000 });
            console.log(`[${roleName}] Reached dashboard successfully`);
        } catch (e) {
            console.error(`Error waiting for dashboard for ${roleName}:`, e.message);
            console.error(`Browser logs for ${roleName}:`, logs);
        }

        // CRITICAL: Wait for WebSocket to be confirmed connected
        // The WS sometimes disconnects and reconnects — we wait for a stable CONNECTED state
        console.log(`[${roleName}] Waiting for WebSocket connection...`);
        const wsWaitStart = Date.now();
        while (!wsConnected && (Date.now() - wsWaitStart) < 15000) {
            await new Promise(r => setTimeout(r, 500));
        }
        if (wsConnected) {
            console.log(`[${roleName}] WebSocket confirmed CONNECTED`);
        } else {
            console.warn(`[${roleName}] WebSocket did NOT connect within 15s — ride notifications may fail`);
        }

        const actor = {
            ctx,
            page,
            logs,
            networkRequests,
            wsEvents,
            isWsConnected: () => wsConnected
        };

        this.contexts[roleName] = actor;
        return actor;
    }

    getActor(roleName) {
        return this.contexts[roleName];
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = {
    BrowserSession,
    delay
};
