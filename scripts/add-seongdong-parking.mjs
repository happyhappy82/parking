// 성동구 공영주차장 네이버 검색 결과 추가
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Users/gwonsunhyeon/Desktop/Trip웹사이트';
const CONTENT = `${BASE}/content/parking/서울특별시`;
const PUBLIC = `${BASE}/public/data/parking/서울특별시`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 네이버 검색에서 수집한 성동구 관련 placeId (주소 필터링으로 타구 자동 제외)
const NEW_SEONGDONG = [
  // 성동구 공영주차장 검색 page 1
  '21185730',    // 성수2가3동 공영주차장
  '1498427512',  // 뚝섬유수지 공영주차장
  '1242189166',  // 성수1가1동공영주차장
  '36003240',    // 서울숲 주차장
  '697052846',   // 성수2가1동공영주차장
  '36003234',    // 살곶이체육공원공영주차장
  '915701270',   // 마장축산물시장 서문 공영 주차장
  '1258982271',  // 성동구민종합체육센터 주차장
  '18799366',    // 용답동공영주차장
  '36046370',    // 성동구청주차장
  // 성동구 검색 page 2 (공영주차장만)
  '21185749',    // 공영주차장
  '565269828',   // 마장 현대아파트 앞적십자 노상 공영 주차장
  '18708594',    // 성동공고공영주차장
  // 성동구 검색 page 3 (성동구 관련만)
  '150372861',   // 성동공고 주차장
  '18854449',    // 답십리공영주차장
  '1282351832',  // 새싹마을공영주차장
  // 금호동 검색
  '1592777135',  // 금남시장공영주차장
  '36003308',    // 금호초등학교 공영주차장
  '1333842225',  // 금호동1가공영주차장
  '1824050468',  // 대현산 배수지 공영주차장
  // 행당동 검색
  '21185810',    // 하왕십리동공영주차장
  '36003307',    // 응봉동 공영주차장
  '2141814030',  // 행당동 공영주차장
  '1927460549',  // 행당제1동 주민센터 주차장
  '18775307',    // 사근동공영주차장
  // 옥수동 검색
  '1437780048',  // 옥수유수지공영주차장
  '36003241',    // 옥수역노상공영주차장
  '2143892913',  // 옥수역 공영주차장
  '21185578',    // 공영주차장
  '1157382147',  // 옥수유수지 공영 주차장
];

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

function isFreeParking(name) {
  return name.includes('무료') || name.includes('관광버스');
}

function detectCategory(name) {
  if (name.includes('노상')) return '노상';
  return '노외';
}

async function createItemFromSummary(placeId, sido, sigungu) {
  const detail = await fetchSummary(placeId);
  if (!detail) return null;

  const name = (detail.name || '').replace(/공영주차장$/, '').replace(/주차장$/, '').trim();
  const addr = detail.address?.address || '';
  const roadAddr = detail.address?.roadAddress || '';
  const dong = extractDong(addr) || extractDong(roadAddr);

  return {
    name: name || detail.name,
    type: '공영',
    category: detectCategory(detail.name || ''),
    address: roadAddr || addr,
    lat: detail.coordinate?.latitude ? parseFloat(detail.coordinate.latitude) : 0,
    lng: detail.coordinate?.longitude ? parseFloat(detail.coordinate.longitude) : 0,
    totalSpaces: 0,
    isFree: isFreeParking(detail.name || ''),
    operatingDays: '평일+토요일+공휴일',
    weekdayOpen: '00:00',
    weekdayClose: '00:00',
    weekendOpen: '00:00',
    weekendClose: '00:00',
    holidayOpen: '00:00',
    holidayClose: '00:00',
    feeInfo: '',
    phone: '',
    updatedAt: '2026-02-10',
    sido,
    sigungu,
    dong,
    naverPlaceId: placeId,
    naverName: detail.name || '',
    naverDataSource: true,
    naverBusinessHours: detail.businessHours?.description || '',
  };
}

async function addNewItems(sigungu, newPlaceIds) {
  const contentPath = path.join(CONTENT, `${sigungu}.json`);
  const publicPath = path.join(PUBLIC, `${sigungu}.json`);

  const data = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
  const existingIds = new Set(data.items.filter(i => i.naverPlaceId).map(i => i.naverPlaceId));

  console.log(`\n===== ${sigungu} 신규 추가 =====`);
  console.log(`  기존: ${data.items.length}개, 기존placeId: ${existingIds.size}개`);

  let added = 0;
  for (const placeId of newPlaceIds) {
    if (existingIds.has(placeId)) {
      console.log(`  [스킵] ${placeId} 이미 있음`);
      continue;
    }

    const item = await createItemFromSummary(placeId, '서울특별시', sigungu);
    await sleep(300);

    if (item) {
      const addr = item.address || '';
      if (!addr.includes('성동구')) {
        console.log(`  [제외] ${item.naverName} - 주소: ${addr} (성동구 아님)`);
        continue;
      }

      data.items.push(item);
      existingIds.add(placeId);
      console.log(`  [추가] ${item.naverName} (${item.dong}) ✅`);
      added++;
    } else {
      console.log(`  [실패] ${placeId} API 없음`);
    }
  }

  data.totalCount = data.items.length;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(contentPath, json, 'utf-8');
  fs.writeFileSync(publicPath, json, 'utf-8');

  console.log(`  → 추가: ${added}개, 총: ${data.items.length}개`);
}

(async () => {
  await addNewItems('성동구', NEW_SEONGDONG);
  console.log('\n===== 완료 =====');
})();
