#!/usr/bin/env node
/**
 * content/parking/서울특별시/*.json (flat array) → 모든 정적 데이터 파일 재생성
 *
 * 1. content/parking/서울특별시/*.json → wrapper format {sido, sigungu, totalCount, items} 으로 변환
 * 2. public/data/parking/서울특별시/*.json → wrapper format으로 생성
 * 3. public/data/parking-autocomplete.json → 서울 only
 * 4. src/data/parking-file-index.json → 서울 only
 * 5. src/data/parking-tree.json → 서울 only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = path.resolve(__dirname, '..');

const CONTENT_DIR = path.join(BASE_DIR, 'content', 'parking', '서울특별시');
const PUBLIC_PARKING_DIR = path.join(BASE_DIR, 'public', 'data', 'parking', '서울특별시');
const PUBLIC_DATA_DIR = path.join(BASE_DIR, 'public', 'data');
const SRC_DATA_DIR = path.join(BASE_DIR, 'src', 'data');

console.log('📦 서울 공공데이터 기반 전체 정적 파일 재생성 시작...\n');

// === 1. content JSON 읽기 & wrapper 변환 ===
const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
const allData = {}; // sigungu -> { items, totalCount, ... }

let totalParkingLots = 0;

for (const file of files) {
  const sigungu = file.replace('.json', '');
  const filePath = path.join(CONTENT_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data = JSON.parse(raw);

  // flat array면 wrapper로 변환
  let items;
  if (Array.isArray(data)) {
    items = data;
  } else if (data.items) {
    items = data.items;
  } else {
    console.warn(`  ⚠️ ${file}: 알 수 없는 포맷, 스킵`);
    continue;
  }

  // 위경도 있는 것만 validItems
  const validItems = items.filter(it => it.lat && it.lng);
  // 무료 우선, 주차면수 많은 순 정렬
  validItems.sort((a, b) => {
    if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
    return (b.totalSpaces || 0) - (a.totalSpaces || 0);
  });

  const wrapped = {
    sido: '서울특별시',
    sigungu,
    totalCount: items.length,
    validCount: validItems.length,
    items: validItems,
  };

  allData[sigungu] = wrapped;
  totalParkingLots += items.length;

  // content JSON을 wrapper 포맷으로 덮어쓰기
  fs.writeFileSync(filePath, JSON.stringify(wrapped, null, 2), 'utf-8');
  console.log(`  ✅ content/${file}: ${items.length}건 (유효: ${validItems.length}건)`);
}

console.log(`\n  📊 총 ${files.length}개 구, ${totalParkingLots}건 주차장\n`);

// === 2. public/data/parking/서울특별시/*.json 생성 ===
if (fs.existsSync(PUBLIC_PARKING_DIR)) {
  fs.rmSync(PUBLIC_PARKING_DIR, { recursive: true });
}
fs.mkdirSync(PUBLIC_PARKING_DIR, { recursive: true });

for (const [sigungu, data] of Object.entries(allData)) {
  const outPath = path.join(PUBLIC_PARKING_DIR, `${sigungu}.json`);
  // minified for production
  fs.writeFileSync(outPath, JSON.stringify(data), 'utf-8');
}
console.log(`  ✅ public/data/parking/서울특별시/ ${Object.keys(allData).length}개 파일 생성\n`);

// === 3. parking-autocomplete.json 생성 ===
const autocomplete = [];

// 동 카운트 수집
const sidoCount = totalParkingLots;
const sigunguCounts = {};
const dongCounts = {}; // "sigungu|dong" -> count

for (const [sigungu, data] of Object.entries(allData)) {
  sigunguCounts[sigungu] = data.items.length;
  for (const item of data.items) {
    if (item.dong) {
      const key = `${sigungu}|${item.dong}`;
      dongCounts[key] = (dongCounts[key] || 0) + 1;
    }
  }
}

// 시도 레벨
autocomplete.push({
  label: '서울특별시',
  short: '서울',
  type: 'sido',
  count: sidoCount,
});

// 시군구 레벨 (건수 내림차순)
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

// 동 레벨 (건수 내림차순)
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

fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(PUBLIC_DATA_DIR, 'parking-autocomplete.json'),
  JSON.stringify(autocomplete),
  'utf-8'
);
console.log(`  ✅ parking-autocomplete.json: ${autocomplete.length}개 항목\n`);

// === 4. parking-file-index.json 생성 ===
const fileIndex = [];
for (const [sigungu, data] of Object.entries(allData)) {
  fileIndex.push({
    sido: '서울특별시',
    sigungu,
    path: `/data/parking/서울특별시/${sigungu}.json`,
    count: data.totalCount,
    validCount: data.validCount,
  });
}
// 시군구명 정렬
fileIndex.sort((a, b) => a.sigungu.localeCompare(b.sigungu, 'ko'));

fs.mkdirSync(SRC_DATA_DIR, { recursive: true });
fs.writeFileSync(
  path.join(SRC_DATA_DIR, 'parking-file-index.json'),
  JSON.stringify(fileIndex, null, 2),
  'utf-8'
);
console.log(`  ✅ parking-file-index.json: ${fileIndex.length}개 항목\n`);

// === 5. parking-tree.json 생성 ===
const tree = { '서울특별시': {} };
for (const [sigungu, data] of Object.entries(allData)) {
  tree['서울특별시'][sigungu] = {};
  for (const item of data.items) {
    if (item.dong) {
      tree['서울특별시'][sigungu][item.dong] = (tree['서울특별시'][sigungu][item.dong] || 0) + 1;
    }
  }
  // 동을 가나다 정렬
  const sorted = {};
  for (const dong of Object.keys(tree['서울특별시'][sigungu]).sort((a, b) => a.localeCompare(b, 'ko'))) {
    sorted[dong] = tree['서울특별시'][sigungu][dong];
  }
  tree['서울특별시'][sigungu] = sorted;
}

fs.writeFileSync(
  path.join(SRC_DATA_DIR, 'parking-tree.json'),
  JSON.stringify(tree, null, 2),
  'utf-8'
);

const totalDong = Object.values(tree['서울특별시']).reduce((sum, dongs) => sum + Object.keys(dongs).length, 0);
console.log(`  ✅ parking-tree.json: 서울특별시 ${Object.keys(tree['서울특별시']).length}개 구, ${totalDong}개 동\n`);

console.log('🎉 전체 정적 파일 재생성 완료!');
