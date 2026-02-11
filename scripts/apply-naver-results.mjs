// 네이버 검색 결과를 content/parking JSON에 적용하는 스크립트
// Usage: node scripts/apply-naver-results.mjs < results.json
import fs from 'node:fs';
import path from 'node:path';

const resultsJson = process.argv[2];
const results = JSON.parse(fs.readFileSync(resultsJson, 'utf8'));

const seoulDir = path.join(process.cwd(), 'content', 'parking', '서울특별시');
const pubDir = path.join(process.cwd(), 'public', 'data', 'parking', '서울특별시');

// 구별로 그룹핑
const byGu = {};
for (const r of results) {
  if (!byGu[r.gu]) byGu[r.gu] = [];
  byGu[r.gu].push(r);
}

for (const [gu, items] of Object.entries(byGu)) {
  const filePath = path.join(seoulDir, gu + '.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let updated = 0;
  let skipped = 0;

  for (const r of items) {
    if (!r.match) {
      skipped++;
      continue;
    }

    const item = data.items[r.idx];
    if (!item) {
      console.log(`[WARN] ${gu} idx ${r.idx} not found`);
      continue;
    }

    item.naverPlaceId = r.match.id;
    item.naverName = r.match.name;
    if (r.match.tel) item.naverPhone = r.match.tel;
    item.naverAddress = r.match.address;
    if (r.match.roadAddress) item.naverRoadAddress = r.match.roadAddress;
    item.naverX = r.match.x;
    item.naverY = r.match.y;
    item.naverVerified = true;
    updated++;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  // public/data 동기화
  if (fs.existsSync(path.dirname(path.join(pubDir, gu + '.json')))) {
    fs.writeFileSync(path.join(pubDir, gu + '.json'), JSON.stringify(data, null, 2) + '\n');
  }

  console.log(`${gu}: ${updated}개 업데이트, ${skipped}개 스킵`);
}
