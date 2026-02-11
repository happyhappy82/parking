#!/usr/bin/env node

/**
 * 공공데이터포털 주차장 API 다운로드 스크립트
 *
 * 전국 주차장 데이터(16,991개)를 다운로드하고
 * 서울특별시 데이터만 추출해서 구별로 JSON 파일 생성
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 설정
const API_URL = 'http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api';
const API_KEY = '20897579e83003a948a9b631875d44dcbacf63bfe7002d339360d5f1a0657b9b';
const PAGE_SIZE = 1000;
const TOTAL_RECORDS = 16991;
const TOTAL_PAGES = Math.ceil(TOTAL_RECORDS / PAGE_SIZE); // 17페이지

const OUTPUT_DIR = path.resolve(__dirname, '../content/parking/서울특별시');

console.log('🔥 공공데이터포털 주차장 API 다운로드 시작!! 💪');
console.log(`📍 API URL: ${API_URL}`);
console.log(`📄 총 페이지 수: ${TOTAL_PAGES} (레코드: ${TOTAL_RECORDS}개)`);
console.log('');

/**
 * API 호출 함수
 */
async function fetchParkingData(pageNo) {
  const url = new URL(API_URL);
  url.searchParams.append('serviceKey', API_KEY);
  url.searchParams.append('pageNo', pageNo);
  url.searchParams.append('numOfRows', PAGE_SIZE);
  url.searchParams.append('type', 'json');

  console.log(`⏳ 페이지 ${pageNo}/${TOTAL_PAGES} 다운로드 중...`);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // API 응답 구조 확인
    if (data.response && data.response.body) {
      const items = data.response.body.items || [];
      console.log(`✅ 페이지 ${pageNo} 완료: ${items.length}개 레코드`);
      return items;
    } else {
      console.error('❌ 예상치 못한 API 응답 구조:', JSON.stringify(data).substring(0, 200));
      return [];
    }
  } catch (error) {
    console.error(`❌ 페이지 ${pageNo} 다운로드 실패:`, error.message);
    return [];
  }
}

/**
 * 서울특별시 데이터 필터링
 */
function isSeoulData(item) {
  const lnmadr = item.lnmadr || '';
  const rdnmadr = item.rdnmadr || '';

  return lnmadr.startsWith('서울') || rdnmadr.startsWith('서울');
}

/**
 * 주소에서 시/구/동 파싱
 */
function parseAddress(address) {
  if (!address) return { sido: '', sigungu: '', dong: '' };

  // "서울특별시 종로구낙원동" 같은 붙어있는 주소 처리
  // "서울특별시 " 제거 후 "~구" 찾기
  let normalized = address.trim();

  // 시도 추출
  let sido = '';
  if (normalized.startsWith('서울특별시')) {
    sido = '서울특별시';
    normalized = normalized.substring('서울특별시'.length).trim();
  }

  // 구 추출: "강남구", "종로구" 등 "~구" 패턴 찾기
  let sigungu = '';
  let dong = '';

  const guMatch = normalized.match(/^([가-힣]+구)/);
  if (guMatch) {
    sigungu = guMatch[1];
    normalized = normalized.substring(sigungu.length).trim();

    // 동 추출: "~동"으로 끝나는 부분 찾기
    const dongMatch = normalized.match(/^([가-힣]+동)/);
    if (dongMatch) {
      dong = dongMatch[1];
    }
  }

  // 만약 위 방법으로 안되면 기존 방식 (공백 기준 분리)
  if (!sigungu) {
    const parts = address.trim().split(/\s+/);
    sido = parts[0] || '';
    sigungu = parts[1] || '';
    dong = parts[2] || '';

    // 구 이름 정규화: "~구"로 끝나지 않으면 비워둠
    if (sigungu && !sigungu.endsWith('구')) {
      sigungu = '';
    }

    // 동 이름 정규화: "~동"으로 끝나는 것만 추출
    if (dong && !dong.endsWith('동')) {
      const dongPart = parts.find(p => p.endsWith('동'));
      dong = dongPart || '';
    }
  }

  return { sido, sigungu, dong };
}

/**
 * 숫자 필드 파싱 (빈 문자열이면 0)
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * 좌표 파싱 (빈 문자열이면 0)
 */
function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * 무료 여부 판단
 */
function isFreeParking(feeInfo) {
  if (!feeInfo) return false;
  const info = feeInfo.toString().toLowerCase();
  return info.includes('무료') || info === '0' || info === '';
}

/**
 * API 데이터를 우리 사이트 형식으로 변환
 */
function transformData(item) {
  const lnmadr = item.lnmadr || '';
  const rdnmadr = item.rdnmadr || '';
  const address = lnmadr || rdnmadr;

  // 지번주소 우선, 없으면 도로명주소로 파싱
  let { sido, sigungu, dong } = parseAddress(lnmadr);

  // 지번주소에서 구 정보 못 찾으면 도로명주소로 재시도
  if (!sigungu && rdnmadr) {
    const parsed = parseAddress(rdnmadr);
    if (parsed.sigungu) {
      sido = parsed.sido;
      sigungu = parsed.sigungu;
      dong = parsed.dong;
    }
  }

  return {
    name: item.prkplceNm || '',
    type: item.prkplceSe || '',
    category: item.prkplceType || '',
    address: address,
    roadAddress: rdnmadr,
    lat: parseCoordinate(item.latitude),
    lng: parseCoordinate(item.longitude),
    totalSpaces: parseNumber(item.prkcmprt),
    isFree: isFreeParking(item.parkingchrgeInfo),
    operatingDays: item.operDay || '',
    weekdayOpen: item.weekdayOperOpenHhmm || '',
    weekdayClose: item.weekdayOperColseHhmm || '',
    weekendOpen: item.satOperOperOpenHhmm || '',
    weekendClose: item.satOperCloseHhmm || '',
    holidayOpen: item.holidayOperOpenHhmm || '',
    holidayClose: item.holidayCloseOpenHhmm || '',
    feeInfo: item.parkingchrgeInfo || '',
    basicTime: parseNumber(item.basicTime),
    basicCharge: parseNumber(item.basicCharge),
    addUnitTime: parseNumber(item.addUnitTime),
    addUnitCharge: parseNumber(item.addUnitCharge),
    monthlyPass: parseNumber(item.monthCmmtkt),
    phone: item.phoneNumber || '',
    updatedAt: item.referenceDate || '',
    sido: sido,
    sigungu: sigungu,
    dong: dong
  };
}

/**
 * 메인 실행 함수
 */
async function main() {
  const startTime = Date.now();

  // 1. 전체 데이터 다운로드
  console.log('📥 1단계: 전체 데이터 다운로드 시작\n');

  const allData = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const pageData = await fetchParkingData(page);
    allData.push(...pageData);

    // API 요청 간 딜레이 (초당 10회 제한 고려)
    if (page < TOTAL_PAGES) {
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  console.log(`\n✅ 다운로드 완료: 총 ${allData.length}개 레코드\n`);

  // 2. 서울특별시 데이터 필터링
  console.log('🔍 2단계: 서울특별시 데이터 필터링\n');

  const seoulData = allData.filter(isSeoulData);
  console.log(`✅ 서울 데이터: ${seoulData.length}개\n`);

  // 3. 데이터 변환
  console.log('🔄 3단계: 데이터 변환\n');

  const transformedData = seoulData.map(transformData);

  // 4. 구별로 그룹화
  console.log('📂 4단계: 구별 그룹화\n');

  const groupedByGu = {};

  for (const item of transformedData) {
    const gu = item.sigungu;
    if (!gu) {
      console.warn('⚠️  구 정보 없음:', item.address);
      continue;
    }

    if (!groupedByGu[gu]) {
      groupedByGu[gu] = [];
    }
    groupedByGu[gu].push(item);
  }

  const guList = Object.keys(groupedByGu).sort();
  console.log(`✅ 총 ${guList.length}개 구: ${guList.join(', ')}\n`);

  // 5. 출력 디렉토리 생성
  console.log('📁 5단계: 출력 디렉토리 생성\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  console.log(`✅ 출력 경로: ${OUTPUT_DIR}\n`);

  // 6. JSON 파일 저장
  console.log('💾 6단계: JSON 파일 저장\n');

  for (const gu of guList) {
    const filePath = path.join(OUTPUT_DIR, `${gu}.json`);
    const data = groupedByGu[gu];

    fs.writeFileSync(
      filePath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );

    console.log(`✅ ${gu}.json 저장 완료 (${data.length}개 주차장)`);
  }

  // 7. 완료 요약
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('🎉 다운로드 완료!! 💪💪');
  console.log('═══════════════════════════════════════');
  console.log(`📊 전체 레코드: ${allData.length}개`);
  console.log(`🏙️  서울 데이터: ${seoulData.length}개`);
  console.log(`📁 생성된 구: ${guList.length}개`);
  console.log(`⏱️  소요 시간: ${duration}초`);
  console.log('═══════════════════════════════════════');
  console.log('');

  // 구별 주차장 수 상세 출력
  console.log('📋 구별 주차장 수:');
  for (const gu of guList) {
    console.log(`   ${gu}: ${groupedByGu[gu].length}개`);
  }
  console.log('');
}

// 실행
main().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error);
  process.exit(1);
});
