const fs = require('fs');

const jsFiles = [
  'app.js', 'auth.js', 'firebase.js', 'insights.js', 'offline.js',
  'sw.js', 'transactions.js', 'wallets.js', 'website/main.js'
];
let combinedJS = '';
jsFiles.forEach(f => {
  if (fs.existsSync(f)) combinedJS += fs.readFileSync(f, 'utf8') + '\n';
});

const htmlFiles = [
  'index.html', 'app.html', 'landing.html', 'privacy.html', 'terms.html',
  'website/index.html', 'website/features.html', 'website/pricing.html', 'website/privacy.html'
];

let issues = 0;

htmlFiles.forEach(hf => {
  if (!fs.existsSync(hf)) return;
  const content = fs.readFileSync(hf, 'utf8');

  // Check buttons without onclick or type=submit in a form
  const buttons = content.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  buttons.forEach(btn => {
    const hasOnClick = /onclick=/i.test(btn);
    const hasTypeSubmit = /type=["']submit["']/i.test(btn);
    const hasId = /id=["'][^"']+["']/i.test(btn);
    if (!hasOnClick && !hasTypeSubmit && !hasId) {
      console.log(`[WARN] Button without handler or ID in ${hf}:`, btn.slice(0, 80));
      issues++;
    }
  });

  // Check onclick handlers
  const onclickRegex = /onclick=["']([^"']+)["']/gi;
  let match;
  while ((match = onclickRegex.exec(content)) !== null) {
    const handler = match[1];
    const fnMatch = handler.match(/^([a-zA-Z0-9_$]+)\s*\(/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      if (!combinedJS.includes(fnName) && !content.includes(fnName)) {
        console.log(`[WARN] Missing function '${fnName}' called from onclick in ${hf}`);
        issues++;
      }
    }
  }

  // Check dead links <a href="#"> without onclick
  const deadLinks = content.match(/<a\s+[^>]*href=["']#["'][^>]*>/gi) || [];
  deadLinks.forEach(link => {
    if (!/onclick=/i.test(link)) {
      console.log(`[WARN] Dead link href="#" without onclick in ${hf}:`, link.slice(0, 80));
      issues++;
    }
  });
});

console.log(`Audit finished with ${issues} issues found.`);
