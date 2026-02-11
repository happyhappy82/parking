// 네이버 지도 API로 주차장 데이터 보강 스크립트
import fs from 'node:fs';
import path from 'node:path';

const INPUT = process.argv[2]; // content/parking/서울특별시/강남구.json
if (!INPUT) { console.error('Usage: node scripts/naver-enrich.mjs <json-path>'); process.exit(1); }

const filePath = path.resolve(INPUT);
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const items = data.items;

console.log(`[시작] ${data.sido} ${data.sigungu} - ${items.length}개 주차장`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 네이버 지도 검색 API
async function searchNaver(query) {
  const url = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(query)}&type=all&searchCoord=&boundary=`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': 'https://map.naver.com/',
    }
  });
  if (!res.ok) return null;
  return res.json();
}

// 네이버 Place Summary API
async function getPlaceSummary(placeId) {
  const url = `https://map.naver.com/p/api/place/summary/${placeId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer': 'https://map.naver.com/',
    }
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.placeDetail || null;
}

// 주소에서 동 추출
function extractDong(address) {
  // "서울 강남구 역삼동 123" → "역삼동"
  const match = address.match(/([가-힣]+[동리읍면])\s/);
  return match ? match[1] : '';
}

let updated = 0;
let notFound = 0;

for (let i = 0; i < items.length; i++) {
  const lot = items[i];

  // 이미 naverPlaceId 있으면 스킵
  if (lot.naverPlaceId) {
    console.log(`[${i+1}/${items.length}] ${lot.name} - 이미 있음, 스킵`);
    continue;
  }

  // 검색 쿼리: 이름 + 주소 (더 정확하게)
  const queries = [
    lot.name + ' 주차장 ' + lot.address,
    lot.name + ' 주차장 ' + data.sigungu,
    lot.name + ' ' + data.sigungu,
  ];

  let placeId = null;
  let placeName = null;

  for (const query of queries) {
    try {
      const result = await searchNaver(query);
      const places = result?.result?.place?.list;
      if (!places || places.length === 0) continue;

      // 주차장 관련 결과 찾기
      for (const p of places) {
        const pName = (p.name || '').replace(/<[^>]*>/g, '');
        const pAddr = p.roadAddress || p.address || '';

        // 이름이 비슷하거나 주소가 해당 시군구인 것
        if (pAddr.includes(data.sigungu) || pName.includes(lot.name.replace(/\s/g, '').slice(0, 3))) {
          placeId = p.id;
          placeName = pName;
          break;
        }
      }
      if (placeId) break;
    } catch (e) {
      // 검색 실패, 다음 쿼리 시도
    }
    await sleep(300);
  }

  if (!placeId) {
    console.log(`[${i+1}/${items.length}] ${lot.name} - ❌ 검색 결과 없음`);
    notFound++;
    await sleep(500);
    continue;
  }

  // Place Summary 가져오기
  try {
    const detail = await getPlaceSummary(placeId);
    if (detail) {
      lot.naverPlaceId = placeId;
      lot.naverName = placeName || detail.name || '';

      // 좌표 업데이트
      if (detail.x && detail.y) {
        lot.lng = parseFloat(detail.x);
        lot.lat = parseFloat(detail.y);
      }

      // 도로명주소
      if (detail.roadAddress) {
        lot.roadAddress = detail.roadAddress;
      }

      // 지번주소로 동 추출 (빈 경우)
      if (!lot.dong) {
        const addr = detail.address || detail.roadAddress || lot.address || '';
        const dong = extractDong(addr);
        if (dong) lot.dong = dong;
      }

      // 전화번호 업데이트
      if (detail.phone) {
        lot.phone = detail.phone;
      }

      // 영업시간
      if (detail.businessHours && detail.businessHours.length > 0) {
        const bh = detail.businessHours[0];
        if (bh.startTime && bh.endTime) {
          lot.weekdayOpen = bh.startTime;
          lot.weekdayClose = bh.endTime;
        }
      }

      // 카카오 URL (없으면 건너뜀)
      // feeInfo는 네이버에서 직접 제공하지 않으므로 기존 유지

      lot.updatedAt = '2026-02-10';
      lot.naverDataSource = true;

      console.log(`[${i+1}/${items.length}] ${lot.name} → ${placeName} (${placeId}) ✅`);
      updated++;
    } else {
      console.log(`[${i+1}/${items.length}] ${lot.name} - ⚠️ 상세정보 없음 (placeId: ${placeId})`);
    }
  } catch (e) {
    console.log(`[${i+1}/${items.length}] ${lot.name} - ⚠️ API 에러: ${e.message}`);
  }

  await sleep(500); // rate limit
}

// 저장
data.items = items;
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

// public 쪽도 동일하게 저장
const publicPath = filePath.replace('/content/', '/public/data/');
if (fs.existsSync(path.dirname(publicPath))) {
  fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\n[저장] ${publicPath}`);
}

console.log(`\n[완료] 업데이트: ${updated}개 / 미발견: ${notFound}개 / 전체: ${items.length}개`);
