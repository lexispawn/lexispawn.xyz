const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.setViewport({width: 1200, height: 1200});
  
  await page.goto('file://' + process.argv[2], {waitUntil: 'networkidle0'});
  
  // Wait for animation to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Capture 80 frames over 8 seconds
  const frames = [];
  for (let i = 0; i < 80; i++) {
    const path = `/tmp/frame-${String(i).padStart(3, '0')}.png`;
    await page.screenshot({path, type: 'png'});
    frames.push(path);
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between frames
  }
  
  await browser.close();
  console.log('Captured 80 frames');
  console.log('Convert to gif: ffmpeg -framerate 8 -i /tmp/frame-%03d.png -vf "fps=8,scale=1200:-1:flags=lanczos" output.gif');
})();
