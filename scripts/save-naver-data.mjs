// 네이버 검색 결과를 naver-map/ 폴더에 저장
// 기존 공공데이터포털 데이터 참조하지 않음 - 네이버 데이터만 저장
import fs from 'node:fs';
import path from 'node:path';

const naverMapDir = path.join(process.cwd(), 'naver-map');

// 광진구 데이터 (네이버 검색 결과만)
const gwangjin = {
  sido: '서울특별시',
  sigungu: '광진구',
  items: [
    { naverPlaceId: '1818015545', name: '자양유수지 노상 공영 주차장', address: '서울특별시 광진구 자양동 594', roadAddress: '서울특별시 광진구 뚝섬로52길 74-1', lat: 37.5296746, lng: 127.0776666, phone: '02-2049-4540', dong: '자양동' },
    { naverPlaceId: '35992895', name: '구의1동공영주차장', address: '서울특별시 광진구 구의동 243-78', roadAddress: '서울특별시 광진구 자양로18길 78', lat: 37.5383242, lng: 127.0878866, phone: '', dong: '구의동' },
    { naverPlaceId: '1006965782', name: '중곡3동1마을공원공영주차장', address: '서울특별시 광진구 중곡동 195-1', roadAddress: '서울특별시 광진구 용마산로33길 25', lat: 37.5700888, lng: 127.0845467, phone: '', dong: '중곡동' },
    { naverPlaceId: '18816578', name: '구의3동공영주차장', address: '서울특별시 광진구 구의동 219-15', roadAddress: '서울특별시 광진구 광나루로52길 83', lat: 37.5391857, lng: 127.0914082, phone: '', dong: '구의동' },
    { naverPlaceId: '226115480', name: '구의2동주택가공동주차장', address: '서울특별시 광진구 구의동 30-9', roadAddress: '서울특별시 광진구 자양로 307', lat: 37.5529766, lng: 127.0928143, phone: '02-2049-4595', dong: '구의동' },
    { naverPlaceId: '21185991', name: '자양4동공영주차장', address: '서울특별시 광진구 자양동 5-5', roadAddress: '', lat: 37.5386904, lng: 127.0681855, phone: '02-2049-4595', dong: '자양동' },
    { naverPlaceId: '1055480485', name: '구의2동 복합청사 지하주차장', address: '서울특별시 광진구 구의동 63-6', roadAddress: '서울특별시 광진구 천호대로136길 55', lat: 37.5471482, lng: 127.0899571, phone: '', dong: '구의동' },
    { naverPlaceId: '18810610', name: '능동공영주차장', address: '서울특별시 광진구 능동 205', roadAddress: '서울특별시 광진구 천호대로112길 56', lat: 37.5540552, lng: 127.0803494, phone: '02-2049-4595', dong: '능동' },
    { naverPlaceId: '2145499999', name: '화양동 공영주차장', address: '서울특별시 광진구 화양동 63-2', roadAddress: '서울특별시 광진구 군자로 22', lat: 37.5452699, lng: 127.0711495, phone: '', dong: '화양동' },
    { naverPlaceId: '21185766', name: '광진광장공영주차장', address: '서울특별시 광진구 군자동 374-4', roadAddress: '서울특별시 광진구 광나루로 389', lat: 37.5477560, lng: 127.0731127, phone: '02-465-2026', dong: '군자동' },
  ]
};

// 강남구 (네이버에서 찾은 것만)
const gangnam = {
  sido: '서울특별시',
  sigungu: '강남구',
  items: [
    { naverPlaceId: '35940205', name: '신구초교 공영주차장', address: '서울특별시 강남구 신사동 550-11', roadAddress: '서울특별시 강남구 압구정로18길 28', lat: 37.5226810, lng: 127.0234350, phone: '1544-3113', dong: '신사동' },
    { naverPlaceId: '1429724383', name: '남부순환로397길 공영노상주차장', address: '서울특별시 강남구 대치동 629', roadAddress: '서울특별시 강남구 남부순환로 2913', lat: 37.4927572, lng: 127.0585437, phone: '', dong: '대치동' },
    { naverPlaceId: '36015851', name: '언주로171길노상공영주차장', address: '서울특별시 강남구 신사동 668-11', roadAddress: '', lat: 37.5275666, lng: 127.0324919, phone: '1544-3113', dong: '신사동' },
  ]
};

// 용산구
const yongsan = {
  sido: '서울특별시',
  sigungu: '용산구',
  items: [
    { naverPlaceId: '35913843', name: '삼각지역노상공영주차장', address: '서울특별시 용산구 한강로1가 138', roadAddress: '서울특별시 용산구 한강대로62길 32-1', lat: 37.5334664, lng: 126.9736248, phone: '', dong: '한강로1가' },
  ]
};

// 종로구
const jongno = {
  sido: '서울특별시',
  sigungu: '종로구',
  items: [
    { naverPlaceId: '1661723162', name: '하나로빌딩옆 공영(노외)주차장', address: '서울특별시 종로구 인사동 277', roadAddress: '', lat: 37.5724781, lng: 126.9854406, phone: '', dong: '인사동' },
    { naverPlaceId: '1814848165', name: '신평화시장앞공영주차장', address: '서울특별시 중구 신당동 217-118', roadAddress: '', lat: 37.5696399, lng: 127.0110219, phone: '', dong: '신당동' },
    { naverPlaceId: '37049460', name: '관철동노상공영주차장', address: '서울특별시 종로구 관철동 13-14', roadAddress: '서울특별시 종로구 삼일대로 385-3', lat: 37.5683971, lng: 126.9863395, phone: '02-738-0909', dong: '관철동' },
  ]
};

// 서초구
const seocho = {
  sido: '서울특별시',
  sigungu: '서초구',
  items: [
    { naverPlaceId: '38494878', name: '언남문화체육센터주차장', address: '서울특별시 서초구 양재동 309', roadAddress: '서울특별시 서초구 동산로13길 35', lat: 37.4728926, lng: 127.0441792, phone: '', dong: '양재동' },
    { naverPlaceId: '21185732', name: '청계산근린광장공영주차장', address: '서울특별시 서초구 원지동 355-1', roadAddress: '', lat: 37.4466358, lng: 127.0559744, phone: '02-2155-7290', dong: '원지동' },
    { naverPlaceId: '2144972385', name: '서초구내곡동임시공영주차장', address: '서울특별시 서초구 신원동', roadAddress: '', lat: 37.4496909, lng: 127.0578407, phone: '', dong: '신원동' },
    { naverPlaceId: '1449637552', name: '반포4동주민센터 주차장', address: '서울특별시 서초구 반포동 74-7', roadAddress: '서울특별시 서초구 사평대로28길 70', lat: 37.4976370, lng: 127.0002643, phone: '', dong: '반포동' },
    { naverPlaceId: '20935832', name: '청계산청룡공영주차장', address: '서울특별시 서초구 신원동 224-3', roadAddress: '', lat: 37.4463780, lng: 127.0597594, phone: '02-2155-7290', dong: '신원동' },
    { naverPlaceId: '1996534167', name: '양재2동주민센터 공영 주차장', address: '서울특별시 서초구 양재동 310-15', roadAddress: '', lat: 37.4707882, lng: 127.0412404, phone: '', dong: '양재동' },
  ]
};

const allData = [gwangjin, gangnam, yongsan, jongno, seocho];

for (const d of allData) {
  d.totalCount = d.items.length;
  d.source = 'naver-map';
  d.scrapedAt = new Date().toISOString().split('T')[0];

  const dir = path.join(naverMapDir, d.sido);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, d.sigungu + '.json');

  // 기존 파일 있으면 머지 (이미 있는 PlaceId는 스킵)
  let existing = { items: [] };
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const existingIds = new Set(existing.items.map(i => i.naverPlaceId));
  for (const item of d.items) {
    if (!existingIds.has(item.naverPlaceId)) {
      existing.items.push(item);
      existingIds.add(item.naverPlaceId);
    }
  }

  existing.sido = d.sido;
  existing.sigungu = d.sigungu;
  existing.totalCount = existing.items.length;
  existing.source = 'naver-map';
  existing.scrapedAt = d.scrapedAt;

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n');
  console.log(`${d.sigungu}: ${existing.items.length}개 저장 완료`);
}
