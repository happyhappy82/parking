// 네이버 placeId가 있는 항목에 Summary API 데이터 보강
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Users/gwonsunhyeon/Desktop/Trip웹사이트';
const CONTENT = `${BASE}/content/parking/서울특별시`;
const PUBLIC = `${BASE}/public/data/parking/서울특별시`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const DISTRICTS = ['마포구', '성동구', '용산구', '종로구', '중구', '강남구'];

async function fetchSummary(placeId) {
  const url = `https://map.naver.com/p/api/place/summary/${placeId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://map.naver.com/',
      }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.placeDetail || null;
  } catch (e) {
    return null;
  }
}

function extractDong(address) {
  const match = (address || '').match(/([가-힣]+[동리읍면가]\d*)\s/);
  return match ? match[1] : '';
}

async function processDistrict(sigungu) {
  const contentPath = path.join(CONTENT, `${sigungu}.json`);
  const publicPath = path.join(PUBLIC, `${sigungu}.json`);

  if (!fs.existsSync(contentPath)) { console.log(`[스킵] ${sigungu} 파일 없음`); return; }

  const data = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
  const items = data.items;

  console.log(`\n===== ${sigungu} (${items.length}개) =====`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const lot = items[i];
    if (!lot.naverPlaceId) { skipped++; continue; }
    // 이미 naverName 있으면 스킵 (이미 보강됨)
    if (lot.naverName) { skipped++; continue; }

    const detail = await fetchSummary(lot.naverPlaceId);
    await sleep(250);

    if (detail) {
      // 이름
      if (detail.name) lot.naverName = detail.name;

      // 좌표
      if (detail.coordinate) {
        if (detail.coordinate.longitude) lot.lng = parseFloat(detail.coordinate.longitude);
        if (detail.coordinate.latitude) lot.lat = parseFloat(detail.coordinate.latitude);
      }

      // 도로명주소
      if (detail.address?.roadAddress) {
        lot.roadAddress = detail.address.roadAddress;
      }

      // 지번주소에서 동 추출
      if (!lot.dong && detail.address?.address) {
        const dong = extractDong(detail.address.address);
        if (dong) lot.dong = dong;
      }

      // 영업시간
      if (detail.businessHours?.description) {
        lot.naverBusinessHours = detail.businessHours.description;
      }

      lot.updatedAt = '2026-02-10';
      lot.naverDataSource = true;

      console.log(`  [${i}] ${lot.name} → ${detail.name} ✅`);
      updated++;
    } else {
      console.log(`  [${i}] ${lot.name} → API 실패 ❌`);
      failed++;
    }
  }

  // 저장
  data.items = items;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(contentPath, json, 'utf-8');
  fs.writeFileSync(publicPath, json, 'utf-8');

  console.log(`  → 업데이트: ${updated} / 스킵: ${skipped} / 실패: ${failed}`);
}

(async () => {
  for (const d of DISTRICTS) {
    await processDistrict(d);
  }
  console.log('\n===== 전체 완료 =====');
})();
