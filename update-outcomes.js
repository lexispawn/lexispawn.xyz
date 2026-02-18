#!/usr/bin/env node
/**
 * Outcome updater for scanner track record
 * Checks 24h and 48h price changes for pending scans
 * Updates 14minds.html and scanner.html
 * 
 * Run via cron every 15 minutes
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Scan log format: { token, ca, timestamp, conviction, priceAtScan, pending24h, pending48h }
const scansPath = path.join(__dirname, 'scans.json');

// Initialize scans.json if doesn't exist
if (!fs.existsSync(scansPath)) {
  fs.writeFileSync(scansPath, JSON.stringify([]));
}

const scans = JSON.parse(fs.readFileSync(scansPath, 'utf8'));

async function getCurrentPrice(ca) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.pairs && json.pairs.length > 0) {
            const pair = json.pairs.find(p => p.chainId === 'base') || json.pairs[0];
            resolve(parseFloat(pair.priceUsd));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

async function updateScan(scan) {
  const now = Date.now();
  const scanTime = new Date(scan.timestamp).getTime();
  const hoursPassed = (now - scanTime) / (1000 * 60 * 60);
  
  let updated = false;
  
  // Check 24h outcome
  if (hoursPassed >= 24 && scan.pending24h) {
    const currentPrice = await getCurrentPrice(scan.ca);
    if (currentPrice) {
      const change = ((currentPrice - scan.priceAtScan) / scan.priceAtScan) * 100;
      scan.outcome24h = change.toFixed(2);
      scan.pending24h = false;
      updated = true;
      console.log(`${scan.token} 24h: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
    }
  }
  
  // Check 48h outcome
  if (hoursPassed >= 48 && scan.pending48h) {
    const currentPrice = await getCurrentPrice(scan.ca);
    if (currentPrice) {
      const change = ((currentPrice - scan.priceAtScan) / scan.priceAtScan) * 100;
      scan.outcome48h = change.toFixed(2);
      scan.pending48h = false;
      
      // Determine if prediction was correct
      if (scan.conviction >= 7) {
        const correct = (scan.conviction >= 7 && change > 0) || (scan.conviction <= 3 && change < 0);
        scan.correct = correct;
      }
      
      updated = true;
      console.log(`${scan.token} 48h: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`);
    }
  }
  
  return updated;
}

async function updateHTML(scans) {
  // Update 14minds.html
  let index = fs.readFileSync(path.join(__dirname, '14minds.html'), 'utf8');
  
  scans.forEach(scan => {
    const slug = scan.token.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!scan.pending24h && scan.outcome24h) {
      const outcome24h = parseFloat(scan.outcome24h);
      const outcomeClass = outcome24h > 0 ? 'outcome-correct' : 'outcome-wrong';
      const pattern = new RegExp(`(<a href="reads/${slug}.html">.*?</a>.*?<div class="outcome outcome-pending" data-label="24H">)Pending`, 's');
      index = index.replace(pattern, `$1<span class="${outcomeClass}">${outcome24h > 0 ? '+' : ''}${outcome24h}%</span>`);
    }
    
    if (!scan.pending48h && scan.outcome48h) {
      const outcome48h = parseFloat(scan.outcome48h);
      const outcomeClass = outcome48h > 0 ? 'outcome-correct' : 'outcome-wrong';
      const pattern = new RegExp(`(<a href="reads/${slug}.html">.*?</a>.*?<div class="outcome outcome-pending" data-label="48H">)Pending`, 's');
      index = index.replace(pattern, `$1<span class="${outcomeClass}">${outcome48h > 0 ? '+' : ''}${outcome48h}%</span>`);
    }
  });
  
  // Calculate accuracy for conviction >= 7
  const qualifyingScans = scans.filter(s => s.conviction >= 7 && !s.pending48h);
  if (qualifyingScans.length > 0) {
    const correct = qualifyingScans.filter(s => s.correct).length;
    const accuracy = ((correct / qualifyingScans.length) * 100).toFixed(1);
    index = index.replace(/—%/, `${accuracy}%`);
  }
  
  fs.writeFileSync(path.join(__dirname, '14minds.html'), index);
  
  // Update scanner.html similarly
  let scanner = fs.readFileSync(path.join(__dirname, 'scanner.html'), 'utf8');
  // (same replacement logic)
  fs.writeFileSync(path.join(__dirname, 'scanner.html'), scanner);
  
  console.log('Updated HTML files');
}

(async () => {
  let changed = false;
  
  for (const scan of scans) {
    if (scan.pending24h || scan.pending48h) {
      const updated = await updateScan(scan);
      if (updated) changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(scansPath, JSON.stringify(scans, null, 2));
    await updateHTML(scans);
    
    // Git commit and push
    try {
      execSync(`cd ${__dirname} && git add 14minds.html scanner.html scans.json`, { stdio: 'inherit' });
      execSync(`cd ${__dirname} && git commit -m "Outcome update: ${new Date().toISOString()}"`, { stdio: 'inherit' });
      execSync(`cd ${__dirname} && git push origin main`, { stdio: 'inherit' });
      console.log('Pushed updates to GitHub');
    } catch (e) {
      console.error('Git push failed:', e.message);
    }
  } else {
    console.log('No pending outcomes due for update');
  }
})();
