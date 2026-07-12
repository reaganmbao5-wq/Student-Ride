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
        const page = await ctx.newPage();
        
        const logs = [];
        const networkRequests = [];
        const wsEvents = [];

        page.on('console', msg => {
            const text = msg.text();
            logs.push(text);
            if (text.includes('WEBSOCKET_CONNECTED')) wsEvents.push('CONNECTED');
            if (text.includes('RIDE_REQUEST')) wsEvents.push('RIDE_REQUEST');
            // We can add more specific WS event tracking based on console logs
            // if the app logs them
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

        // Login
        await page.goto('http://localhost:3000/auth');
        try {
            await page.waitForSelector('input[type="email"]', { timeout: 15000 });
        } catch (e) {
            await page.screenshot({ path: `../qa_${roleName}_auth_fail.png` });
            throw new Error(`Waiting for selector \`input[type="email"]\` failed on ${roleName}`);
        }
        await page.type('input[type="email"]', email);
        await page.type('input[type="password"]', password);
        await page.click('button[type="submit"]');

        // Wait for dashboard to mount
        await page.waitForFunction(() => {
            return document.body.innerText.includes('Mulungushi') || document.querySelector('.leaflet-container');
        }, { timeout: 15000 }).catch(e => console.error(`Error waiting for dashboard for ${roleName}: ${e.message}`));

        this.contexts[roleName] = {
            ctx,
            page,
            logs,
            networkRequests,
            wsEvents
        };

        return this.contexts[roleName];
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
