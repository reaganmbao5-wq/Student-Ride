const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/Reaga/.gemini/antigravity/brain/6d753052-c88c-4864-ad77-cddd6aac6fd3/screenshots';
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop_1920x1080', width: 1920, height: 1080 },
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
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const targetUrl = process.env.TEST_URL || 'https://student-ride-frontend-manual.onrender.com';
  console.log('Testing Target URL:', targetUrl);

  for (const vp of VIEWPORTS) {
    console.log(`\n=== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2000));

    // 1. Step 1: Hero Page
    const heroPath = path.join(OUT_DIR, `${vp.name}_step1_hero.png`);
    await page.screenshot({ path: heroPath, fullPage: false });
    console.log(`Saved: ${heroPath}`);

    // Click "Get Started" to go to Step 2
    const clickedGetStarted = await clickButtonWithText(page, 'Get Started');
    if (clickedGetStarted) {
      await new Promise(r => setTimeout(r, 1000));

      // 2. Step 2: First Name
      const step2FirstNamePath = path.join(OUT_DIR, `${vp.name}_step2_name.png`);
      await page.screenshot({ path: step2FirstNamePath });
      console.log(`Saved: ${step2FirstNamePath}`);

      // Type First Name & click Continue
      const input = await page.$('input[type="text"]');
      if (input) {
        await input.type('John');
        await clickButtonWithText(page, 'Continue');
        await new Promise(r => setTimeout(r, 800));

        // Type Last Name & click Continue
        const inputs = await page.$$('input[type="text"]');
        if (inputs.length > 1) {
          await inputs[1].type('Doe');
          await clickButtonWithText(page, 'Continue');
          await new Promise(r => setTimeout(r, 800));

          // Type Phone & click Continue
          const phoneInput = await page.$('input[type="tel"]');
          if (phoneInput) {
            await phoneInput.type('0971234567');
            await clickButtonWithText(page, 'Continue');
            await new Promise(r => setTimeout(r, 1000));

            // 3. Step 3: Gender Selection
            const step3GenderPath = path.join(OUT_DIR, `${vp.name}_step3_gender.png`);
            await page.screenshot({ path: step3GenderPath });
            console.log(`Saved: ${step3GenderPath}`);

            // Click Continue to go to Step 4
            await clickButtonWithText(page, 'Continue');
            await new Promise(r => setTimeout(r, 1500));

            // 4. Step 4: Customization
            const step4CustomPath = path.join(OUT_DIR, `${vp.name}_step4_customization.png`);
            await page.screenshot({ path: step4CustomPath });
            console.log(`Saved: ${step4CustomPath}`);

            // Click Continue through theme, accent, map to Step 5
            await clickButtonWithText(page, 'Continue'); // accent
            await new Promise(r => setTimeout(r, 800));
            await clickButtonWithText(page, 'Continue'); // map
            await new Promise(r => setTimeout(r, 800));
            await clickButtonWithText(page, 'Continue'); // step 5
            await new Promise(r => setTimeout(r, 1000));

            // 5. Step 5: Save Progress
            const step5SavePath = path.join(OUT_DIR, `${vp.name}_step5_save_progress.png`);
            await page.screenshot({ path: step5SavePath });
            console.log(`Saved: ${step5SavePath}`);
          }
        }
      }
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(console.error);
