/**
 * 공단주소 데이터 기반 parking-autocomplete.json 생성
 * data/공단주소/*.json → public/data/parking-autocomplete.json
 */
import fs from 'fs';
import path from 'path';

const GONGDAN_DIR = path.join(process.cwd(), 'data', '공단주소');
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'data', 'parking-autocomplete.json');

const files = fs.readdirSync(GONGDAN_DIR).filter(f => f.endsWith('.json'));

const autocomplete = [];
const sigunguCounts = {};
const dongCounts = {}; // "sigungu|dong" -> count
let totalCount = 0;

for (const file of files) {
  const sigungu = file.replace('.json', '');
  const data = JSON.parse(fs.readFileSync(path.join(GONGDAN_DIR, file), 'utf-8'));

  // 노상 + 노외 주차장 개소수
  const nosang = data.노상주차장?.개소수 || 0;
  const nooe = data.노외주차장?.개소수 || 0;
  const count = nosang + nooe;
  sigunguCounts[sigungu] = count;
  totalCount += count;

  // 소재지에서 동 이름 추출
  const allLots = [
    ...(data.노상주차장?.주차장목록 || []),
    ...(data.노외주차장?.주차장목록 || []),
  ];

  for (const lot of allLots) {
    const addr = lot.소재지 || '';
    // 패턴: "... (천호동)" 또는 "강동구 올림픽로80길 60(천호동)"
    const match = addr.match(/\(([^)]+동)\)/) || addr.match(/([가-힣]+동)\s*$/);
    if (match) {
      const dong = match[1];
      const key = `${sigungu}|${dong}`;
      dongCounts[key] = (dongCounts[key] || 0) + 1;
    }
  }
}

// 1. 시도
autocomplete.push({
  label: '서울특별시',
  short: '서울',
  type: 'sido',
  count: totalCount,
});

// 2. 시군구 (건수 내림차순)
const sortedSigungu = Object.entries(sigunguCounts).sort((a, b) => b[1] - a[1]);
for (const [sigungu, count] of sortedSigungu) {
  autocomplete.push({
    label: sigungu,
    full: `서울특별시 ${sigungu}`,
    type: 'sigungu',
    sido: '서울특별시',
    count,
  });
}

// 3. 동 (건수 내림차순)
const sortedDong = Object.entries(dongCounts).sort((a, b) => b[1] - a[1]);
for (const [key, count] of sortedDong) {
  const [sigungu, dong] = key.split('|');
  autocomplete.push({
    label: dong,
    full: `서울특별시 ${sigungu} ${dong}`,
    desc: `서울 ${sigungu}`,
    type: 'dong',
    sido: '서울특별시',
    sigungu,
    count,
  });
}

// 출력
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(autocomplete), 'utf-8');

console.log(`✅ parking-autocomplete.json 생성 완료!`);
console.log(`   총 항목: ${autocomplete.length}개`);
console.log(`   시도: 1 / 시군구: ${sortedSigungu.length}개 / 동: ${sortedDong.length}개`);
console.log(`   총 주차장: ${totalCount}개소`);
