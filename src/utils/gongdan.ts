import fs from 'node:fs';
import path from 'node:path';

export function toSlug(name: string): string {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeParkingName(name: string): string {
  return name
    .replace(/\s+/g, '')
    .replace(/(공영주차장|노상주차장|부설주차장|주차장|공영)$/g, '')
    .trim();
}

export function extractAllLots(data: any): { lot: any; category: string; parentDong?: string }[] {
  const result: { lot: any; category: string; parentDong?: string }[] = [];
  const SKIP_KEYS = new Set([
    '연락처', '요금정보', '할인정보', '신청안내', '거주자우선주차장',
    '동별현황', '비고', '수집일시', '데이터출처', '자치구', '공단명칭',
    '공단유형', '운영구획현황', '홈페이지',
  ]);

  function isLotObject(item: any): boolean {
    return typeof item === 'object' && item !== null && !Array.isArray(item)
      && (item.주차장명 || item.시설명);
  }

  function inferCategory(keyPath: string[]): string {
    const joined = keyPath.join('/');
    if (joined.includes('노상')) return '노상';
    if (joined.includes('노외') || joined.includes('건물식')) return '노외';
    if (joined.includes('부설')) return '부설';
    if (joined.includes('추첨')) return '추첨제';
    if (joined.includes('대기순번')) return '대기순번제';
    if (joined.includes('직영')) return '직영';
    if (joined.includes('위탁')) return '위탁';
    if (joined.includes('공영')) return '공영';
    return '공영';
  }

  function isDongName(key: string): boolean {
    return /^[가-힣]+\d*동$/.test(key);
  }

  function walk(obj: any, keyPath: string[]) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (SKIP_KEYS.has(key)) continue;
      if (typeof value !== 'object' || value === null) continue;

      if (Array.isArray(value)) {
        if (value.length > 0 && isLotObject(value[0])) {
          const cat = inferCategory([...keyPath, key]);
          const parentDong = isDongName(key) ? key : undefined;
          for (const item of value) {
            if (isLotObject(item)) {
              result.push({ lot: item, category: cat, parentDong });
            }
          }
        }
      } else {
        walk(value, [...keyPath, key]);
      }
    }
  }

  walk(data, []);
  return result;
}

export function extractDong(lot: any, _unused?: string | null, parentDong?: string | null): string | null {
  // 도봉구: 지역 필드 (쌍문동, 방학동, 창동, 도봉동)
  if (lot.지역 && /[가-힣]+\d*동$/.test(lot.지역)) return lot.지역;
  const addr = lot.위치 || lot.소재지 || lot.주소 || '';
  // "(천호동)" or "(마천동 214)"
  let m = addr.match(/\(([가-힣]+\d*동)/);
  if (m) return m[1];
  // "마포구 망원동 397-5" or "강서구 화곡1동"
  m = addr.match(/[가-힣]+구\s+([가-힣]+\d*동)/);
  if (m) return m[1];
  // "고척동 241-21" (주소가 동으로 시작)
  m = addr.match(/^([가-힣]+\d*동)\s/);
  if (m) return m[1];
  // "쌍문동 460-103" (중간에 동 패턴)
  m = addr.match(/([가-힣]+\d*동)\s+\d/);
  if (m) return m[1];
  // "구로5동 549-73" (숫자+동 패턴)
  m = addr.match(/([가-힣]+\d+동)/);
  if (m) return m[1];
  // 주차장명에서: "천호1동공영" → "천호1동", "남산동공영" → "남산동"
  const name = lot.주차장명 || lot.시설명 || '';
  m = name.match(/^([가-힣]+\d*동)/);
  if (m) return m[1];
  // 동명 필드 (용산구 등)
  if (lot.동명) return lot.동명;
  // 동대문구: 부모 키가 동 이름인 경우
  if (parentDong) return parentDong;
  return null;
}

export interface GongdanLotEntry {
  lot: any;
  category: string;
  dong: string | null;
  slug: string;
  feeEntry: any | null;
}

export function loadGongdanSigungu(sigungu: string) {
  const gongdanPath = path.join(process.cwd(), 'data', '공단주소', `${sigungu}.json`);
  if (!fs.existsSync(gongdanPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(gongdanPath, 'utf-8'));
  } catch {
    return null;
  }
}

// 요금정보에서 해당 주차장 찾기
export function matchFeeEntry(lotName: string, gongdanData: any): any | null {
  const feeSources = [
    gongdanData.노상주차장?.요금정보,
    gongdanData.노외주차장?.요금정보,
    gongdanData.공영주차장?.노외주차장?.요금정보,
    gongdanData.공영주차장?.노상주차장?.요금정보,
  ];
  const norm = normalizeParkingName(lotName);
  for (const fees of feeSources) {
    if (!Array.isArray(fees)) continue;
    const found = fees.find((f: any) => normalizeParkingName(f.주차장명 || '') === norm);
    if (found) return found;
  }
  return null;
}

// 모든 공단주소 lot을 순회하며 dong 추출 + slug 생성
export function buildGongdanEntries(
  gongdanData: any,
): GongdanLotEntry[] {
  const allLots = extractAllLots(gongdanData);
  const entries: GongdanLotEntry[] = [];
  const slugCount = new Map<string, number>();

  for (const { lot, category, parentDong } of allLots) {
    const dong = extractDong(lot, null, parentDong || null);

    let slug = toSlug(lot.주차장명 || lot.시설명 || '');
    if (!slug) slug = 'parking';

    // 중복 slug 처리
    if (slugCount.has(slug)) {
      const count = slugCount.get(slug)! + 1;
      slugCount.set(slug, count);
      slug = `${slug}-${count}`;
    } else {
      slugCount.set(slug, 1);
    }

    const feeEntry = matchFeeEntry(lot.주차장명 || lot.시설명 || '', gongdanData);

    entries.push({ lot, category, dong, slug, feeEntry });
  }

  return entries;
}
