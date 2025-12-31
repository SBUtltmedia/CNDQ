const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('http://cndq.test/');
  console.log('Title:', await page.title());
  await browser.close();
})();
