const playwright = require('playwright');

async function run() {
  console.log('Launching browser...');
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', exception => {
    console.error('PAGE ERROR (EXCEPTION):', exception);
  });
  
  page.on('console', msg => {
    console.log(`CONSOLE [${msg.type()}]:`, msg.text());
  });

  try {
    console.log('Navigating to http://localhost:3000/editor/demo ...');
    await page.goto('http://localhost:3000/editor/demo', { timeout: 15000 });
    console.log('Navigation successful, waiting 5 seconds...');
    await page.waitForTimeout(5000);
  } catch (err) {
    console.error('Error during navigation or wait:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

run().catch(console.error);
