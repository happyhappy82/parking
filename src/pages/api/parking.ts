export const prerender = false;

import type { APIRoute } from 'astro';

const DATA_GO_KR_API_URL = 'http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api';

// 전체 주차장 데이터 캐시 (서버리스 인스턴스 내 재사용)
let cachedItems: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 30; // 30분

async function fetchAllParkingData(serviceKey: string): Promise<any[]> {
  const now = Date.now();
  if (cachedItems && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedItems;
  }

  const allItems: any[] = [];
  let pageNo = 1;
  const numOfRows = 5000;

  while (true) {
    const params = new URLSearchParams({
      serviceKey,
      pageNo: String(pageNo),
      numOfRows: String(numOfRows),
      type: 'json',
    });

    const res = await fetch(`${DATA_GO_KR_API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`공공데이터 API 응답 오류: ${res.status}`);

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`API 응답 파싱 실패: ${text.substring(0, 200)}`);
    }

    const header = data?.response?.header;
    if (header?.resultCode !== '00') {
      throw new Error(`API 오류: ${header?.resultMsg || '알 수 없는 오류'}`);
    }

    const body = data?.response?.body;
    const items = body?.items || [];
    const totalCount = parseInt(body?.totalCount || '0', 10);

    allItems.push(...items);

    if (allItems.length >= totalCount || items.length === 0) break;
    pageNo++;
  }

  cachedItems = allItems;
  cacheTimestamp = now;
  return allItems;
}

export const GET: APIRoute = async ({ url }) => {
  const region = url.searchParams.get('region') || '';
  const filter = url.searchParams.get('filter') || 'all';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const size = parseInt(url.searchParams.get('size') || '50', 10);

  const serviceKey = import.meta.env.DATA_GO_KR_SERVICE_KEY;

  if (!serviceKey) {
    return new Response(
      JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!region) {
    return new Response(
      JSON.stringify({ error: '지역명(region)을 입력해주세요.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 전체 데이터 가져오기 (캐시 활용)
    const rawItems = await fetchAllParkingData(serviceKey);

    // 사용자 입력 검색어로 주소 자유검색
    const query = region.trim();
    const filtered = rawItems.filter((item: any) => {
      const addr = (item.lnmadr || '') + ' ' + (item.rdnmadr || '');
      return addr.includes(query);
    });

    // 프론트엔드 형식으로 변환
    let items = filtered.map((item: any) => ({
      name: item.prkplceNm || '',
      type: item.prkplceSe || '',
      category: item.prkplceType || '',
      address: item.rdnmadr || item.lnmadr || '',
      lat: parseFloat(item.latitude) || 0,
      lng: parseFloat(item.longitude) || 0,
      totalSpaces: parseInt(item.prkcmprt, 10) || 0,
      isFree: item.parkingchrgeInfo === '무료',
      operatingDays: item.operDay || '',
      weekdayOpen: item.weekdayOperOpenHhmm || '',
      weekdayClose: item.weekdayOperCloseHhmm || '',
      weekendOpen: item.satOperOperOpenHhmm || '',
      weekendClose: item.satOperCloseHhmm || '',
      holidayOpen: item.holidayOperOpenHhmm || '',
      holidayClose: item.holidayCloseOpenHhmm || '',
      feeInfo: formatFeeInfo(item),
      phone: item.phoneNumber || '',
      updatedAt: item.referenceDate || '',
    }));

    // 무료/공영 필터 적용
    if (filter === 'free') {
      items = items.filter((lot: any) => lot.isFree);
    } else if (filter === 'public') {
      items = items.filter((lot: any) => lot.type === '공영');
    }

    const totalCount = items.length;

    // 서버 사이드 페이징
    const startIndex = (page - 1) * size;
    const pagedItems = items.slice(startIndex, startIndex + size);

    return new Response(
      JSON.stringify({
        items: pagedItems,
        totalCount,
        pageNo: page,
        numOfRows: size,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('주차장 API 오류:', err);
    return new Response(
      JSON.stringify({ error: err.message || '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

function formatFeeInfo(item: any): string {
  if (item.parkingchrgeInfo === '무료') return '무료';

  const parts: string[] = [];
  if (item.basicTime && item.basicCharge) {
    parts.push(`기본 ${item.basicTime}분 ${Number(item.basicCharge).toLocaleString()}원`);
  }
  if (item.addUnitTime && item.addUnitCharge) {
    parts.push(`추가 ${item.addUnitTime}분당 ${Number(item.addUnitCharge).toLocaleString()}원`);
  }
  return parts.length > 0 ? parts.join(' / ') : '유료';
}
