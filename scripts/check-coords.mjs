import fs from 'node:fs';
const sigungu = process.argv[2] || '강동구';
const data = JSON.parse(fs.readFileSync(`data/공단주소/${sigungu}.json`, 'utf-8'));
let total = 0, withCoords = 0, missing = [];
function check(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === '주차장목록' && Array.isArray(v)) {
      for (const lot of v) {
        total++;
        if (lot.lat && lot.lng) withCoords++;
        else missing.push(lot.주차장명 || lot.시설명 || 'unknown');
      }
    } else if (typeof v === 'object' && v !== null) {
      check(v);
    }
  }
}
check(data);
console.log(`총 주차장: ${total}`);
console.log(`좌표 있음: ${withCoords}`);
console.log(`좌표 없음: ${total - withCoords}`);
if (missing.length) console.log(`누락: ${missing.join(', ')}`);
