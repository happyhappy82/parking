#!/usr/bin/env node
/**
 * 공단주소 JSON의 주차장 소재지를 카카오 지오코딩으로 lat/lng 변환
 * Usage: node scripts/geocode-gongdan.mjs 중랑구
 */

import fs from 'node:fs';
import path from 'node:path';

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || '33534cbd2037a9020c2ff53029382534';
const sigungu = process.argv[2];

if (!sigungu) {
  console.error('Usage: node scripts/geocode-gongdan.mjs <시군구명>');
  process.exit(1);
}

const filePath = path.join(process.cwd(), 'data', '공단주소', `${sigungu}.json`);
if (!fs.existsSync(filePath)) {
  console.error(`파일 없음: ${filePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// 주소 정제: "사가정로332(면목동)" → "서울 중랑구 사가정로332"
function cleanAddress(raw, sigungu) {
  if (!raw) return null;
  let addr = raw
    .replace(/\(.*?\)/g, '')        // 괄호 내용 제거
    .replace(/,.*$/g, '')           // 쉼표 이후 제거 (중복 주소)
    .replace(/\s+/g, ' ')
    .trim();

  // 이미 "서울"이 포함되어 있으면 그대로
  if (addr.includes('서울')) return addr;

  // "중화동 73-5" 같은 동+번지 패턴
  if (/^[가-힣]+\d*동\s/.test(addr)) {
    return `서울 ${sigungu} ${addr}`;
  }

  // "겸재로54가길 4" 같은 도로명 패턴
  return `서울 ${sigungu} ${addr}`;
}

// 카카오 지오코딩 (주소 검색)
async function geocodeAddress(query) {
  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const json = await res.json();
  if (json.documents && json.documents.length > 0) {
    const doc = json.documents[0];
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  }
  return null;
}

// 카카오 키워드 검색 (주소 검색 실패시 fallback)
async function geocodeKeyword(query) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  });
  const json = await res.json();
  if (json.documents && json.documents.length > 0) {
    const doc = json.documents[0];
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  }
  return null;
}

// 재귀적으로 주차장목록 찾아서 좌표 추가
async function processLots(obj, sigungu) {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    if (key === '주차장목록' && Array.isArray(value)) {
      for (const lot of value) {
        const name = lot.주차장명 || lot.시설명 || '';
        const rawAddr = lot.소재지 || lot.위치 || lot.주소 || '';

        // 이미 좌표가 있으면 스킵
        if (lot.lat && lot.lng) {
          console.log(`  ✓ ${name} — 좌표 있음 (${lot.lat}, ${lot.lng})`);
          continue;
        }

        const cleanAddr = cleanAddress(rawAddr, sigungu);
        if (!cleanAddr) {
          console.log(`  ✗ ${name} — 주소 없음`);
          continue;
        }

        // 1차: 주소 검색
        let coords = await geocodeAddress(cleanAddr);

        // 2차: 키워드 검색 (주차장명 + 주소)
        if (!coords) {
          coords = await geocodeKeyword(`${sigungu} ${name} 주차장`);
        }

        // 3차: 키워드 검색 (주소만)
        if (!coords) {
          coords = await geocodeKeyword(cleanAddr);
        }

        if (coords) {
          lot.lat = coords.lat;
          lot.lng = coords.lng;
          console.log(`  ✓ ${name} — ${coords.lat}, ${coords.lng}`);
        } else {
          console.log(`  ✗ ${name} — 좌표 못 찾음 (${cleanAddr})`);
        }

        // API 속도 제한 방지
        await new Promise(r => setTimeout(r, 200));
      }
    } else if (typeof value === 'object' && value !== null) {
      await processLots(value, sigungu);
    }
  }
}

console.log(`\n=== ${sigungu} 지오코딩 시작 ===\n`);
await processLots(data, sigungu);

// 저장
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`\n=== 완료! ${filePath} 저장됨 ===\n`);
