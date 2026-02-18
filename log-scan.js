#!/usr/bin/env node
/**
 * Auto-logger for scanner results
 * Logs each scan to reads/[token].html and updates index
 * 
 * Usage: node log-scan.js <token> <ca> <conviction> <price> <mcap> <buySellRatio>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [token, ca, conviction, price, mcap, buySellRatio] = process.argv.slice(2);

if (!token || !ca || !conviction) {
  console.error('Usage: node log-scan.js <token> <ca> <conviction> <price> <mcap> <buySellRatio>');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
const slug = token.toLowerCase().replace(/[^a-z0-9]/g, '');

// 1. Create reads/[token].html from template
const templatePath = path.join(__dirname, 'reads', 'clanker.html');
const template = fs.readFileSync(templatePath, 'utf8');

const tokenHtml = template
  .replace(/\$CLANKER/g, `$${token}`)
  .replace(/\$31\.200000/g, `$${price}`);

const readsPath = path.join(__dirname, 'reads', `${slug}.html`);
fs.writeFileSync(readsPath, tokenHtml);
console.log('Created:', readsPath);

// 2. Update 14minds.html index
const indexPath = path.join(__dirname, '14minds.html');
let index = fs.readFileSync(indexPath, 'utf8');

const convictionClass = conviction >= 7 ? 'conviction-high' : conviction >= 5 ? 'conviction-medium' : 'conviction-low';

const newEntry = `
<div class="scan-item">
<div class="scan-date">${timestamp.split(' ')[0]}<br>${timestamp.split(' ')[1]} PST</div>
<div class="scan-token">
<a href="reads/${slug}.html">$${token}</a>
</div>
<div class="scan-conviction ${convictionClass}">${conviction}/10</div>
<div class="outcome outcome-pending">24h: pending</div>
<div class="outcome outcome-pending">48h: pending</div>
</div>
`;

// Insert after <div class="scan-list">
index = index.replace(
  '<div class="scan-list">',
  `<div class="scan-list">\n${newEntry}`
);

fs.writeFileSync(indexPath, index);
console.log('Updated:', indexPath);

// 3. Update scanner.html
const scannerPath = path.join(__dirname, 'scanner.html');
let scanner = fs.readFileSync(scannerPath, 'utf8');

const scannerEntry = `
<!-- Scan: $${token} -->
<div class="scan-row">
<div class="timestamp" data-label="Timestamp">${timestamp} PST</div>
<div data-label="Token">
<div class="token-name">$${token}</div>
<div class="token-ca">${ca.substring(0, 8)}...${ca.substring(ca.length - 4)}</div>
</div>
<div data-label="Conviction">
<span class="conviction ${convictionClass}">${conviction}/10</span>
</div>
<div class="outcome outcome-pending" data-label="24H">
Pending
</div>
<div class="outcome outcome-pending" data-label="48H">
Pending
</div>
<div data-label="MCap">
$${mcap}
</div>
<div data-label="Link">
<a href="reads/${slug}.html" target="_blank">14minds read →</a>
</div>
</div>
`;

// Insert after first scan row OR after header
scanner = scanner.replace(
  /(<div class="scan-row">)/,
  `${scannerEntry}\n$1`
);

fs.writeFileSync(scannerPath, scanner);
console.log('Updated:', scannerPath);

// 4. Git commit and push
try {
  execSync(`cd ${__dirname} && git add reads/${slug}.html 14minds.html scanner.html`, { stdio: 'inherit' });
  execSync(`cd ${__dirname} && git commit -m "Scanner: $${token} ${conviction}/10 @ ${timestamp}"`, { stdio: 'inherit' });
  execSync(`cd ${__dirname} && git push origin main`, { stdio: 'inherit' });
  console.log('Pushed to GitHub');
} catch (e) {
  console.error('Git push failed:', e.message);
}
