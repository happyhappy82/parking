// 새로 발견한 공영주차장을 Summary API로 데이터 가져와서 JSON에 추가
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/Users/gwonsunhyeon/Desktop/Trip웹사이트';
const CONTENT = `${BASE}/content/parking/서울특별시`;
const PUBLIC = `${BASE}/public/data/parking/서울특별시`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 마포구 신규 placeId들 (기존 36060638, 18796267 제외)
const NEW_MAPO = [
  '37060270',   // 경남1 노상 공영
  '36010857',   // 청기와2 노상공영
  '36010860',   // 새물결 노상공영
  '36003402',   // 합정노상공영
  '35992936',   // 동교1 노상 공영
  '1604344223', // 동교동1 공영
  '38277405',   // 청기와3 노상공영
  '1690898900', // 동교동2 공영
  '35886252',   // 청기와4 노상 공영
  '1493391498', // 연남동 공영
  '1412725698', // 연남3 공영
  '1870324421', // 연남4 노상 공영
  '1045475120', // 신촌 공영
  '1318550035', // 합정1 공영
  '21185778',   // 연희동 제2공영
  '35977257',   // 여의도서강대교남단공영
  '21185879',   // 양화진공영
  '21185611',   // 당인공영노상
  '1084272611', // 신수 노외 공영
  '1935155280', // 마포공덕1-1공영
  '21185866',   // 공덕동1-2공영
  '36010861',   // 창천 공영
  '18767429',   // 도화공영
  '31395426',   // 염리공영
];

// 서초구 전체 동 검색 결과 (양재동+방배동+반포동+서초동+잠원동)
const NEW_SEOCHO = [
  // 양재동 (이전 세션에서 수집)
  '1727318611',  // 양재공영주차장
  '36003303',    // 매헌시민의숲 동측 공영주차장
  '34355357',    // 양재시민의숲매헌역공영주차장
  '18755281',    // 매헌시민의숲공영주차장
  '1281451917',  // 서초문화예술회관주차장
  '1356617702',  // 양재근린공원공영주차장
  '18749175',    // 구룡어린이공원공영주차장
  '331323595',   // 동산마을구립 공영주차장
  '1958217612',  // 양재근린공원 공영 주차장
  '1617260994',  // 매헌윤봉길의사기념관 공영 주차장
  // 방배동
  '35977148',    // 사당역 공영 주차장
  '1173758808',  // 방배카페골목공영주차장
  '338762193',   // 방배1동 공영 주차장
  '35824279',    // 방배열린문화센터 공영 주차장
  '31428041',    // 복개도로제2지역공영주차장
  '31428042',    // 방배복개도로제1지역공영주차장
  '461643074',   // 서초구립중앙로공영주차장
  '35824278',    // 방배중앙로 노상 공영 주차장
  '20820356',    // 공영주차장
  '1349548599',  // 방배역 노상 공영 주차장
  '36961473',    // 광창2공영노외주차장
  '21183912',    // 공영유료주차장
  '36961502',    // 한내1공영노외주차장
  // 반포동
  '35913849',    // 언구비공영주차장
  '1422436572',  // 서초구 반포복개천 공영주차장
  '21186097',    // 서래마을구립공영주차장
  '36010863',    // 서초구립 반포2동 공영 주차장
  '35992938',    // 반포둥근마을공영주차장
  '31116706',    // 반포서래공영주차장
  '36010864',    // 반포동 방음언덕형 공영 주차장
  '21894000',    // 동작대교노상공영주차장
  '21186123',    // 방음언덕형구립주차장
  '1902875004',  // 방배가구거리 노상 공영 주차장
  '521865224',   // 잠원 테니스장 앞 노상 공영 주차장
  '1406122551',  // 방배사이길 노상 공영 주차장
  '1319184845',  // 언주로147길 공영노상주차장
  '1389217675',  // 언주로171길 공영노상주차장
  '1064722878',  // 강남대로150길 공영노상주차장
  '1371453464',  // 논현로131길 공영노상주차장
  // 서초동
  '1579830321',  // 서초구립무궁화공영주차장
  '37074199',    // 서초구청 주차장
  '35992937',    // 교대역동측공영주차장
  '21185737',    // 법원입구도로공영주차장
  '1234026880',  // GS타임즈 교대역동측광장 공영주차장
  '1751307322',  // 역삼문화공원제1호공영주차장
  // 잠원동
  '1654509443',  // 한강6잠원지구 잠원3,6주차장
  '21185911',    // 잠원동방음언덕형 공영 주차장
  '35977253',    // 잠원수영장옆공영주차장
  '18758857',    // 리버사이드서측길공영주차장
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

  // 이미 있는 placeId 수집
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
      // 마포구 아닌 것 필터링 (다른 구 결과가 섞일 수 있음)
      const addr = item.address || '';
      if (sigungu === '마포구' && !addr.includes('마포구') && !addr.includes('마포동')) {
        console.log(`  [제외] ${item.naverName} - 주소: ${addr} (마포구 아님)`);
        continue;
      }
      if (sigungu === '서초구' && !addr.includes('서초구')) {
        console.log(`  [제외] ${item.naverName} - 주소: ${addr} (서초구 아님)`);
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
  await addNewItems('마포구', NEW_MAPO);
  await addNewItems('서초구', NEW_SEOCHO);
  console.log('\n===== 완료 =====');
})();
