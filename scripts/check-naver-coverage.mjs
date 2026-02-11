import fs from 'node:fs';
import path from 'node:path';
const dir = 'content/parking';
let total = 0, hasNaver = 0, diffName = 0;
const diffs = [];
for (const sido of fs.readdirSync(dir)) {
  const sp = path.join(dir, sido);
  if (!fs.statSync(sp).isDirectory()) continue;
  for (const f of fs.readdirSync(sp).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(sp, f), 'utf-8'));
    for (const item of data.items || []) {
      total++;
      if (item.naverName) {
        hasNaver++;
        if (item.name !== item.naverName) {
          diffName++;
          if (diffs.length < 10) diffs.push({ name: item.name, naverName: item.naverName });
        }
      }
    }
  }
}
console.log(`전체: ${total} / naverName 있음: ${hasNaver} (${(hasNaver/total*100).toFixed(1)}%)`);
console.log(`이름 다른 것: ${diffName}`);
console.log('예시:', JSON.stringify(diffs, null, 2));
