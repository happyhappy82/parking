/**
 * 전국 주차장 데이터 카카오맵 기준 보정 스크립트
 * - 카카오 지오코딩으로 좌표/주소/동 보정
 * - 카카오 키워드 검색으로 실존 확인 + 추가 정보
 * - 가격 정보는 공공데이터 기준 유지
 * - 결과를 content/parking/{sido}/{sigungu}.json에 저장
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'public', 'data', 'parking');
const OUT_DIR = path.join(ROOT, 'content', 'parking');
const PROGRESS_FILE = path.join(ROOT, 'data', 'fix-progress.json');

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || '33534cbd2037a9020c2ff53029382534';
const SLEEP_MS = 60; // API 호출 간격 (ms)

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// === API 호출 ===
async function geocode(address) {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
    });
    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      return {
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
        roadAddress: doc.road_address ? doc.road_address.address_name : null,
        jibunAddress: doc.address ? doc.address.address_name : null,
        dong: doc.address ? doc.address.region_3depth_name : null,
        sido: doc.address ? doc.address.region_1depth_name : null,
        sigungu: doc.address ? doc.address.region_2depth_name : null,
      };
    }
  } catch (e) {
    // 에러 무시, null 반환
  }
  return null;
}

async function searchParkingByKeyword(query, lat, lng) {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&category_group_code=PK6&y=${lat}&x=${lng}&radius=300&sort=distance`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
    });
    const data = await res.json();
    return data.documents || [];
  } catch (e) {
    return [];
  }
}

// 거리 계산 (미터)
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// === 진행 상태 관리 ===
function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { completedFiles: [], stats: { total: 0, fixed: 0, matched: 0, geocodeFail: 0, notFound: 0 } };
  }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8');
}

// === 단일 주차장 보정 ===
async function fixOneItem(item) {
  const result = { ...item };
  let status = 'matched'; // matched | fixed | geocode_fail | not_found

  // 1단계: 주소 지오코딩
  const geo = await geocode(item.address);
  await sleep(SLEEP_MS);

  if (geo) {
    const dist = calcDistance(item.lat, item.lng, geo.lat, geo.lng);

    // 좌표 차이가 100m 이상이면 카카오 기준으로 보정
    if (dist > 100) {
      result.lat = geo.lat;
      result.lng = geo.lng;
      status = 'fixed';
    }

    // 도로명주소 보완 (카카오에 있으면 무조건 반영)
    if (geo.roadAddress) {
      result.roadAddress = geo.roadAddress;
    }

    // 동 보정 (카카오 기준)
    if (geo.dong && geo.dong !== item.dong) {
      result.dong = geo.dong;
      status = 'fixed';
    }
  } else {
    status = 'geocode_fail';
  }

  // 2단계: 카카오 키워드 검색으로 실존 확인
  const searchLat = result.lat;
  const searchLng = result.lng;
  const nearby = await searchParkingByKeyword(item.name, searchLat, searchLng);
  await sleep(SLEEP_MS);

  if (nearby.length > 0) {
    const best = nearby[0];
    const distToBest = parseInt(best.distance);

    if (distToBest <= 300) {
      // 카카오맵에 매칭되는 주차장 발견 → 좌표를 카카오 기준으로
      const kakaoLat = parseFloat(best.y);
      const kakaoLng = parseFloat(best.x);
      const distFromOriginal = calcDistance(item.lat, item.lng, kakaoLat, kakaoLng);

      if (distFromOriginal > 50) {
        result.lat = kakaoLat;
        result.lng = kakaoLng;
        status = 'fixed';
      }

      // 카카오맵 이름, 도로명주소, 전화번호 보완
      if (best.road_address_name) {
        result.roadAddress = best.road_address_name;
      }
      if (best.phone && best.phone.length > 0) {
        result.kakaoPhone = best.phone;
      }
      result.kakaoName = best.place_name;
      result.kakaoVerified = true;
    }
  } else {
    // 이름 매칭 실패 → "주차장" 키워드로 재검색
    const nearby2 = await searchParkingByKeyword('주차장', searchLat, searchLng);
    await sleep(SLEEP_MS);

    if (nearby2.length > 0) {
      const best = nearby2[0];
      const distToBest = parseInt(best.distance);
      if (distToBest <= 100) {
        result.kakaoName = best.place_name;
        result.kakaoVerified = true;
        if (best.road_address_name) result.roadAddress = best.road_address_name;
        if (best.phone) result.kakaoPhone = best.phone;

        const kakaoLat = parseFloat(best.y);
        const kakaoLng = parseFloat(best.x);
        const distFromOriginal = calcDistance(item.lat, item.lng, kakaoLat, kakaoLng);
        if (distFromOriginal > 50) {
          result.lat = kakaoLat;
          result.lng = kakaoLng;
          status = 'fixed';
        }
      }
    }

    if (!result.kakaoVerified) {
      result.kakaoVerified = false;
      if (status !== 'geocode_fail') status = 'not_found';
    }
  }

  result._fixStatus = status;
  return result;
}

// === 파일 단위 처리 ===
async function processFile(filePath, progress) {
  const relPath = path.relative(SRC_DIR, filePath);

  // 이미 처리한 파일이면 스킵
  if (progress.completedFiles.includes(relPath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const items = data.items || [];

  if (items.length === 0) return null;

  const fixedItems = [];
  let fileFixed = 0, fileMatched = 0, fileFail = 0, fileNotFound = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fixed = await fixOneItem(item);

    switch (fixed._fixStatus) {
      case 'fixed': fileFixed++; break;
      case 'matched': fileMatched++; break;
      case 'geocode_fail': fileFail++; break;
      case 'not_found': fileNotFound++; break;
    }

    // _fixStatus 제거하고 저장
    const { _fixStatus, ...cleanItem } = fixed;
    fixedItems.push(cleanItem);
  }

  // content/parking/{sido}/{sigungu}.json 저장
  const outPath = path.join(OUT_DIR, relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const outData = {
    sido: data.sido,
    sigungu: data.sigungu,
    totalCount: fixedItems.length,
    items: fixedItems,
  };
  fs.writeFileSync(outPath, JSON.stringify(outData, null, 2), 'utf-8');

  // 진행 상태 업데이트
  progress.completedFiles.push(relPath);
  progress.stats.total += items.length;
  progress.stats.fixed += fileFixed;
  progress.stats.matched += fileMatched;
  progress.stats.geocodeFail += fileFail;
  progress.stats.notFound += fileNotFound;
  saveProgress(progress);

  return { file: relPath, total: items.length, fixed: fileFixed, matched: fileMatched, fail: fileFail, notFound: fileNotFound };
}

// === 메인 ===
async function main() {
  console.log('🚀 전국 주차장 데이터 카카오맵 보정 시작!\n');

  // 모든 JSON 파일 수집
  const allFiles = [];
  const sidos = fs.readdirSync(SRC_DIR).filter(f => fs.statSync(path.join(SRC_DIR, f)).isDirectory());

  for (const sido of sidos) {
    const sidoDir = path.join(SRC_DIR, sido);
    const files = fs.readdirSync(sidoDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      allFiles.push(path.join(sidoDir, file));
    }
  }

  console.log(`📁 총 ${allFiles.length}개 파일 발견\n`);

  // 진행 상태 로드
  const progress = loadProgress();
  const remaining = allFiles.filter(f => !progress.completedFiles.includes(path.relative(SRC_DIR, f)));
  console.log(`✅ 완료: ${progress.completedFiles.length}개 / ⏳ 남은: ${remaining.length}개\n`);

  let fileIdx = progress.completedFiles.length;

  for (const filePath of remaining) {
    fileIdx++;
    const relPath = path.relative(SRC_DIR, filePath);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const itemCount = (raw.items || []).length;

    process.stdout.write(`[${fileIdx}/${allFiles.length}] ${relPath} (${itemCount}개) ... `);

    const result = await processFile(filePath, progress);

    if (result) {
      console.log(`✅ ${result.matched}일치 / 🔧 ${result.fixed}수정 / ❌ ${result.fail}실패 / 🔍 ${result.notFound}미발견`);
    } else {
      console.log('⏭️  스킵');
    }
  }

  // 최종 요약
  const s = progress.stats;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 전국 주차장 보정 최종 결과`);
  console.log('='.repeat(60));
  console.log(`  전체: ${s.total}개`);
  console.log(`  ✅ 일치 (보정 불필요): ${s.matched}개`);
  console.log(`  🔧 카카오맵 기준 수정: ${s.fixed}개`);
  console.log(`  ❌ 지오코딩 실패: ${s.geocodeFail}개`);
  console.log(`  🔍 카카오맵 미등록: ${s.notFound}개`);
  console.log(`\n💾 저장 위치: content/parking/`);
  console.log('🎉 완료!');
}

main().catch(err => {
  console.error('\n❌ 에러 발생:', err.message);
  process.exit(1);
});
