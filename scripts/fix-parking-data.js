/**
 * 주차장 데이터 보정 스크립트
 * 1. 카카오 지오코딩 API로 주소 → 정확한 좌표 변환
 * 2. 카카오 로컬 API로 주변 주차장 크로스체크
 * 3. 도로명주소 보정
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY || '33534cbd2037a9020c2ff53029382534';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 카카오 주소 검색 (지오코딩)
async function geocode(address) {
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
      dongFromKakao: doc.address ? doc.address.region_3depth_name : null,
    };
  }
  return null;
}

// 카카오 키워드 검색 (주차장 카테고리 PK6)
async function searchParking(query, lat, lng) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&category_group_code=PK6&y=${lat}&x=${lng}&radius=200&sort=distance`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }
  });
  const data = await res.json();
  return data.documents || [];
}

// 좌표 간 거리 계산 (미터)
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fixParkingData(sido, sigungu, targetDong) {
  const jsonPath = path.join(__dirname, '..', 'public', 'data', 'parking', sido, `${sigungu}.json`);
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  const items = data.items.filter(item => item.dong === targetDong);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📍 ${sido} ${sigungu} ${targetDong} - ${items.length}개 주차장 보정 시작`);
  console.log('='.repeat(60));

  const results = [];

  for (const item of items) {
    console.log(`\n--- [${item.name}] ---`);
    console.log(`  원본 주소: ${item.address}`);
    console.log(`  원본 좌표: ${item.lat}, ${item.lng}`);

    // 1단계: 주소로 지오코딩
    const geo = await geocode(item.address);
    await sleep(200);

    let report = {
      name: item.name,
      originalAddress: item.address,
      originalLat: item.lat,
      originalLng: item.lng,
      issues: [],
      fixes: {},
    };

    if (geo) {
      const dist = calcDistance(item.lat, item.lng, geo.lat, geo.lng);
      console.log(`  카카오 좌표: ${geo.lat}, ${geo.lng}`);
      console.log(`  도로명주소: ${geo.roadAddress || '없음'}`);
      console.log(`  카카오 동: ${geo.dongFromKakao || '없음'}`);
      console.log(`  좌표 차이: ${Math.round(dist)}m`);

      // 좌표 차이가 100m 이상이면 보정 필요
      if (dist > 100) {
        report.issues.push(`좌표 ${Math.round(dist)}m 차이`);
        report.fixes.lat = geo.lat;
        report.fixes.lng = geo.lng;
        console.log(`  ⚠️  좌표 차이 ${Math.round(dist)}m → 보정 필요!`);
      } else {
        console.log(`  ✅ 좌표 정상 (${Math.round(dist)}m 이내)`);
      }

      // 동 불일치 체크
      if (geo.dongFromKakao && geo.dongFromKakao !== targetDong) {
        report.issues.push(`동 불일치: ${targetDong} → ${geo.dongFromKakao}`);
        report.fixes.correctDong = geo.dongFromKakao;
        console.log(`  ⚠️  동 불일치! 공공데이터: ${targetDong}, 카카오: ${geo.dongFromKakao}`);
      }

      // 도로명주소 보완
      if (geo.roadAddress) {
        report.fixes.roadAddress = geo.roadAddress;
      }
    } else {
      report.issues.push('지오코딩 실패 (주소를 찾을 수 없음)');
      console.log(`  ❌ 지오코딩 실패!`);
    }

    // 2단계: 카카오 로컬 검색으로 실존 여부 체크
    const searchLat = (geo && report.fixes.lat) ? report.fixes.lat : item.lat;
    const searchLng = (geo && report.fixes.lng) ? report.fixes.lng : item.lng;

    const nearby = await searchParking(item.name, searchLat, searchLng);
    await sleep(200);

    if (nearby.length > 0) {
      const best = nearby[0];
      const distToKakao = parseInt(best.distance);
      console.log(`  카카오 매칭: "${best.place_name}" (${distToKakao}m)`);
      console.log(`    → 카카오 주소: ${best.road_address_name || best.address_name}`);
      console.log(`    → 카카오 전화: ${best.phone || '없음'}`);

      report.kakaoMatch = {
        name: best.place_name,
        address: best.road_address_name || best.address_name,
        phone: best.phone,
        distance: distToKakao,
        lat: parseFloat(best.y),
        lng: parseFloat(best.x),
        placeUrl: best.place_url,
      };

      // 카카오 검색 결과의 좌표가 더 정확할 수 있음
      if (distToKakao <= 200) {
        report.fixes.kakaoLat = parseFloat(best.y);
        report.fixes.kakaoLng = parseFloat(best.x);
        report.fixes.kakaoName = best.place_name;
        if (best.phone) report.fixes.phone = best.phone;
      }
    } else {
      // 이름으로 안 나오면 주소 + "주차장"으로 재검색
      const nearby2 = await searchParking('주차장', searchLat, searchLng);
      await sleep(200);
      if (nearby2.length > 0) {
        console.log(`  이름 매칭 실패 → 좌표 기반 주변 주차장:`);
        nearby2.slice(0, 3).forEach((p, i) => {
          console.log(`    ${i + 1}. "${p.place_name}" (${p.distance}m) - ${p.road_address_name || p.address_name}`);
        });
        report.nearbyOptions = nearby2.slice(0, 3).map(p => ({
          name: p.place_name,
          address: p.road_address_name || p.address_name,
          distance: parseInt(p.distance),
        }));
      } else {
        report.issues.push('카카오맵에서 주변 주차장 없음 (폐쇄 가능성)');
        console.log(`  ❌ 주변 200m 내 주차장 없음 → 폐쇄 가능성!`);
      }
    }

    results.push(report);
  }

  // 리포트 출력
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 ${targetDong} 보정 결과 요약`);
  console.log('='.repeat(60));

  let issueCount = 0;
  for (const r of results) {
    if (r.issues.length > 0) {
      issueCount++;
      console.log(`\n⚠️  [${r.name}]`);
      r.issues.forEach(i => console.log(`   - ${i}`));
      if (r.fixes.lat) console.log(`   → 좌표 보정: ${r.originalLat},${r.originalLng} → ${r.fixes.lat},${r.fixes.lng}`);
      if (r.fixes.roadAddress) console.log(`   → 도로명주소: ${r.fixes.roadAddress}`);
      if (r.fixes.correctDong) console.log(`   → 정확한 동: ${r.fixes.correctDong}`);
      if (r.kakaoMatch) console.log(`   → 카카오 매칭: "${r.kakaoMatch.name}"`);
    }
  }

  console.log(`\n✅ 정상: ${results.length - issueCount}개 / ⚠️ 보정 필요: ${issueCount}개 / 전체: ${results.length}개`);

  // 결과 JSON 저장
  const outPath = path.join(__dirname, '..', 'data', `fix-report-${sido}-${sigungu}-${targetDong}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n💾 상세 리포트 저장: ${outPath}`);

  return results;
}

// 실행
async function main() {
  console.log('🚀 주차장 데이터 보정 시작!\n');

  await fixParkingData('경기도', '의왕시', '내손동');
  await fixParkingData('경기도', '의정부시', '민락동');

  console.log('\n\n🎉 전체 보정 완료!');
}

main().catch(console.error);
