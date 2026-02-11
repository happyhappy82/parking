// content/parking에서 이미 naverPlaceId가 있는 항목들을 naver-map/으로 추출
import fs from 'node:fs';
import path from 'node:path';

const seoulSrc = path.join(process.cwd(), 'content', 'parking', '서울특별시');
const naverDst = path.join(process.cwd(), 'naver-map', '서울특별시');

if (!fs.existsSync(naverDst)) fs.mkdirSync(naverDst, { recursive: true });

const files = fs.readdirSync(seoulSrc).filter(f => f.endsWith('.json'));
const today = new Date().toISOString().split('T')[0];

for (const file of files) {
  const gu = file.replace('.json', '');
  const srcData = JSON.parse(fs.readFileSync(path.join(seoulSrc, file), 'utf8'));
  const dstPath = path.join(naverDst, file);

  // 기존 naver-map 데이터 로드 (이미 있으면 머지)
  let existing = { items: [] };
  if (fs.existsSync(dstPath)) {
    existing = JSON.parse(fs.readFileSync(dstPath, 'utf8'));
  }
  const existingIds = new Set(existing.items.map(i => i.naverPlaceId));

  // content/parking에서 naverPlaceId 있는 항목 추출
  let added = 0;
  for (const item of srcData.items) {
    if (!item.naverPlaceId) continue;
    if (existingIds.has(item.naverPlaceId)) continue;

    existing.items.push({
      naverPlaceId: item.naverPlaceId,
      name: item.naverName || item.name,
      address: item.naverAddress || item.address,
      roadAddress: item.naverRoadAddress || item.roadAddress || '',
      lat: item.naverY ? parseFloat(item.naverY) : item.lat,
      lng: item.naverX ? parseFloat(item.naverX) : item.lng,
      phone: item.naverPhone || item.phone || '',
      dong: item.dong || '',
    });
    existingIds.add(item.naverPlaceId);
    added++;
  }

  existing.sido = '서울특별시';
  existing.sigungu = gu;
  existing.totalCount = existing.items.length;
  existing.source = 'naver-map';
  existing.scrapedAt = today;

  fs.writeFileSync(dstPath, JSON.stringify(existing, null, 2) + '\n');
  if (existing.items.length > 0) {
    console.log(`${gu}: ${existing.items.length}개 (신규 ${added}개 추가)`);
  }
}
