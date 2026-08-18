const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BUILD_DIR = path.resolve(__dirname, '../build');
const OUT_DIR = 'C:/Users/Reaga/.gemini/antigravity/brain/6d753052-c88c-4864-ad77-cddd6aac6fd3/screenshots';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Simple static server for React build directory
function startServer(port = 5099) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4'
  };

  const server = http.createServer((req, res) => {
    let safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
    if (safeSuffix === '/' || safeSuffix === '\\') safeSuffix = '/index.html';
    let filePath = path.join(BUILD_DIR, safeSuffix);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(BUILD_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Local test server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080 },
  { name: 'laptop_1366x768', width: 1366, height: 768 },
  { name: 'tablet_768x1024', width: 768, height: 1024 },
  { name: 'mobile_390x844', width: 390, height: 844 }
];

async function clickButtonWithText(page, text) {
  return page.evaluate((btnText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find(b => b.textContent.trim().toLowerCase().includes(btnText.toLowerCase()));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, text);
}

async function run() {
  const server = await startServer(5099);
  const targetUrl = 'http://localhost:5099';

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // 1. Step 1: Hero Page
    const heroPath = path.join(OUT_DIR, `${vp.name}_step1_hero.png`);
    await page.screenshot({ path: heroPath });
    console.log(`Saved: ${heroPath}`);

    // Click "Get Started" to go to Step 2
    await clickButtonWithText(page, 'Get Started');
    await new Promise(r => setTimeout(r, 600));

    // 2. Step 2: First Name
    const step2FirstNamePath = path.join(OUT_DIR, `${vp.name}_step2_name.png`);
    await page.screenshot({ path: step2FirstNamePath });
    console.log(`Saved: ${step2FirstNamePath}`);

    // Type First Name & click Continue
    const input = await page.$('input[type="text"]');
    if (input) {
      await input.type('John');
      await clickButtonWithText(page, 'Continue');
      await new Promise(r => setTimeout(r, 500));

      // Type Last Name & click Continue
      const inputs = await page.$$('input[type="text"]');
      if (inputs.length > 1) {
        await inputs[1].type('Doe');
        await clickButtonWithText(page, 'Continue');
        await new Promise(r => setTimeout(r, 500));

        // Type Phone & click Continue
        const phoneInput = await page.$('input[type="tel"]');
        if (phoneInput) {
          await phoneInput.type('0971234567');
          await clickButtonWithText(page, 'Continue');
          await new Promise(r => setTimeout(r, 600));

          // 3. Step 3: Gender Selection
          const step3GenderPath = path.join(OUT_DIR, `${vp.name}_step3_gender.png`);
          await page.screenshot({ path: step3GenderPath });
          console.log(`Saved: ${step3GenderPath}`);

          // Click Continue to go to Step 4
          await clickButtonWithText(page, 'Continue');
          await new Promise(r => setTimeout(r, 1000));

          // 4. Step 4: Customization
          const step4CustomPath = path.join(OUT_DIR, `${vp.name}_step4_customization.png`);
          await page.screenshot({ path: step4CustomPath });
          console.log(`Saved: ${step4CustomPath}`);

          // Click Continue through theme, accent, map to Step 5
          await clickButtonWithText(page, 'Continue'); // accent
          await new Promise(r => setTimeout(r, 500));
          await clickButtonWithText(page, 'Continue'); // map
          await new Promise(r => setTimeout(r, 500));
          await clickButtonWithText(page, 'Continue'); // step 5
          await new Promise(r => setTimeout(r, 600));

          // 5. Step 5: Save Progress
          const step5SavePath = path.join(OUT_DIR, `${vp.name}_step5_save_progress.png`);
          await page.screenshot({ path: step5SavePath });
          console.log(`Saved: ${step5SavePath}`);
        }
      }
    }
  }

  await browser.close();
  server.close();
  console.log('\nAll multi-viewport screenshots captured and verified successfully!');
}

run().catch(console.error);
