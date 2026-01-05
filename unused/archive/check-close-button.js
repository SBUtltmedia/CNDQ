const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://cndq.test', { waitUntil: 'networkidle0' });

  // Open production guide modal
  await page.click('#production-guide-btn');
  await new Promise(r => setTimeout(r, 300));

  // Check close button colors
  const closeButtonColors = await page.evaluate(() => {
    const closeBtn = document.getElementById('production-guide-close-btn');
    if (!closeBtn) return null;

    const styles = window.getComputedStyle(closeBtn);
    const modal = closeBtn.closest('.modal-overlay, [id$="-modal"]');
    const modalContent = modal ? modal.querySelector('.modal-content, [class*="modal-content"]') : null;
    const parentStyles = modalContent ? window.getComputedStyle(modalContent) : window.getComputedStyle(modal || closeBtn.parentElement);

    return {
      button: {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize,
        classes: closeBtn.className
      },
      parent: {
        backgroundColor: parentStyles.backgroundColor
      }
    };
  });

  console.log(JSON.stringify(closeButtonColors, null, 2));

  // Take screenshot
  await page.screenshot({ path: '/tmp/close-button.png' });

  await browser.close();
})();
