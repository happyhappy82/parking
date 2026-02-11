#!/usr/bin/env python3
"""
CSV 주차장 데이터를 정적 JSON 파일로 변환하는 스크립트
- public/data/parking-autocomplete.json : 자동완성용 지역 목록
- public/data/parking/[sido]/[sigungu].json : 시군구별 주차장 데이터
- src/data/parking-tree.json : Astro 정적 페이지 생성용 지역 트리
"""

import csv
import json
import os
import re
import shutil
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(BASE_DIR, 'data', 'parking_all.csv')
PUBLIC_DATA_DIR = os.path.join(BASE_DIR, 'public', 'data')
SRC_DATA_DIR = os.path.join(BASE_DIR, 'src', 'data')

# 유효한 시도 목록
VALID_SIDO = {
    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
    '대전광역시', '울산광역시', '세종특별자치시',
    '경기도', '강원도', '강원특별자치도',
    '충청북도', '충청남도', '전라북도', '전북특별자치도', '전라남도',
    '경상북도', '경상남도', '제주특별자치도',
}

# 세종특별자치시는 시군구 없이 바로 읍면동
SEJONG = '세종특별자치시'


def clean_address(addr):
    """주소 문자열 정제 (특수문자, 탭 등 제거)"""
    # ? 문자를 공백으로 치환 (탭 오염 데이터)
    addr = addr.replace('?', ' ').replace('\t', ' ')
    # 다중 공백 정리
    addr = re.sub(r'\s+', ' ', addr).strip()
    return addr


def fix_sigungu_dong_merged(addr_parts):
    """'종로구동숭동' 같이 시군구+동이 붙어있는 경우 분리"""
    if len(addr_parts) >= 2:
        part = addr_parts[1]
        # 구 뒤에 동이 바로 붙어있는 패턴: 종로구동숭동 → 종로구, 동숭동
        m = re.match(r'^(.+[시군구])(.+[읍면동가리])$', part)
        if m:
            new_parts = list(addr_parts)
            new_parts[1] = m.group(1)
            new_parts.insert(2, m.group(2))
            return new_parts
    return addr_parts


def parse_address(lnmadr, rdnmadr):
    """주소에서 시도/시군구/읍면동 추출"""
    raw_ln = clean_address(lnmadr)
    raw_rdn = clean_address(rdnmadr)
    addr = raw_ln if raw_ln else raw_rdn

    if not addr:
        return None, None, None, addr

    parts = addr.split()

    # 유효한 시도로 시작하지 않으면 스킵
    if parts[0] not in VALID_SIDO:
        return None, None, None, addr

    sido = parts[0]

    # 시군구+동 붙어있는 경우 분리
    parts = fix_sigungu_dong_merged(parts)

    # 세종특별자치시: 시군구 없이 바로 읍면동
    if sido == SEJONG:
        sigungu = SEJONG  # 시군구 = 세종 자체
        dong = ''
        if len(parts) >= 2:
            candidate = parts[1]
            if re.search(r'(읍|면|동|가|리)$', candidate):
                dong = candidate
        return sido, sigungu, dong, addr

    # 일반 시도: 시군구 추출
    sigungu = ''
    dong = ''
    if len(parts) >= 2:
        candidate_sg = parts[1]
        # 시군구가 시/군/구로 끝나는지 확인
        if re.search(r'(시|군|구)$', candidate_sg):
            sigungu = candidate_sg
        else:
            # 시군구가 아닌 경우 (예: 송현동 179) → 시도 직할
            sigungu = ''

    # 동 추출 (lnmadr에서만)
    if raw_ln and sigungu and len(parts) >= 3:
        candidate_dong = parts[2]
        if re.search(r'(읍|면|동|가|리)$', candidate_dong):
            dong = candidate_dong

    return sido, sigungu, dong, addr


def format_fee_info(item):
    """요금 정보 포맷팅"""
    if item.get('parkingchrgeInfo') == '무료':
        return '무료'

    parts = []
    if item.get('basicTime') and item.get('basicCharge'):
        try:
            charge = int(item['basicCharge'])
            parts.append(f"기본 {item['basicTime']}분 {charge:,}원")
        except (ValueError, TypeError):
            pass

    if item.get('addUnitTime') and item.get('addUnitCharge'):
        try:
            charge = int(item['addUnitCharge'])
            parts.append(f"추가 {item['addUnitTime']}분당 {charge:,}원")
        except (ValueError, TypeError):
            pass

    return ' / '.join(parts) if parts else '유료'


def to_parking_item(row):
    """CSV 행을 프론트엔드 형식으로 변환"""
    lnmadr = row.get('lnmadr', '')
    rdnmadr = row.get('rdnmadr', '')
    sido, sigungu, dong, addr = parse_address(lnmadr, rdnmadr)

    if not sido:
        return None

    lat = 0
    lng = 0
    try:
        lat = float(row.get('latitude', 0) or 0)
        lng = float(row.get('longitude', 0) or 0)
    except (ValueError, TypeError):
        pass

    total_spaces = 0
    try:
        total_spaces = int(row.get('prkcmprt', 0) or 0)
    except (ValueError, TypeError):
        pass

    return {
        'name': row.get('prkplceNm', '').strip(),
        'type': row.get('prkplceSe', '').strip(),
        'category': row.get('prkplceType', '').strip(),
        'address': clean_address(rdnmadr) or clean_address(lnmadr),
        'lat': lat,
        'lng': lng,
        'totalSpaces': total_spaces,
        'isFree': row.get('parkingchrgeInfo') == '무료',
        'operatingDays': row.get('operDay', '').strip(),
        'weekdayOpen': row.get('weekdayOperOpenHhmm', '').strip(),
        'weekdayClose': row.get('weekdayOperColseHhmm', '').strip(),
        'weekendOpen': row.get('satOperOperOpenHhmm', '').strip(),
        'weekendClose': row.get('satOperCloseHhmm', '').strip(),
        'holidayOpen': row.get('holidayOperOpenHhmm', '').strip(),
        'holidayClose': row.get('holidayCloseOpenHhmm', '').strip(),
        'feeInfo': format_fee_info(row),
        'phone': row.get('phoneNumber', '').strip(),
        'updatedAt': row.get('referenceDate', '').strip(),
        'sido': sido,
        'sigungu': sigungu,
        'dong': dong,
    }


def safe_filename(name):
    """파일명에 안전한 문자열로 변환"""
    return re.sub(r'[^\w가-힣-]', '_', name).strip('_')


def main():
    print('📦 주차장 데이터 빌드 시작...')

    # 기존 출력 정리
    parking_dir = os.path.join(PUBLIC_DATA_DIR, 'parking')
    if os.path.exists(parking_dir):
        shutil.rmtree(parking_dir)

    # CSV 읽기
    items = []
    skipped = 0
    with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            item = to_parking_item(row)
            if item:
                items.append(item)
            else:
                skipped += 1

    print(f'  총 {len(items)}건 로드 완료 (스킵: {skipped}건)')

    # === 1. 지역 카운트 ===
    sido_count = defaultdict(int)
    sigungu_count = defaultdict(lambda: defaultdict(int))
    dong_count = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))

    for item in items:
        sido = item['sido']
        sigungu = item['sigungu']
        dong = item['dong']

        sido_count[sido] += 1
        if sigungu:
            sigungu_count[sido][sigungu] += 1
        if dong:
            dong_count[sido][sigungu][dong] += 1

    # === 2. 자동완성 데이터 생성 ===
    autocomplete = []

    # 시도 약칭 매핑
    SIDO_SHORT = {
        '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
        '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
        '울산광역시': '울산', '세종특별자치시': '세종',
        '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원',
        '충청북도': '충북', '충청남도': '충남',
        '전라북도': '전북', '전북특별자치도': '전북', '전라남도': '전남',
        '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주',
    }

    # 시도 레벨
    for sido, count in sorted(sido_count.items(), key=lambda x: -x[1]):
        short = SIDO_SHORT.get(sido, sido)
        autocomplete.append({
            'label': sido,
            'short': short,
            'type': 'sido',
            'count': count,
        })

    # 시군구 레벨
    for sido in sorted(sigungu_count.keys()):
        for sigungu, count in sorted(sigungu_count[sido].items(), key=lambda x: -x[1]):
            if sido == SEJONG and sigungu == SEJONG:
                continue  # 세종은 시도 레벨에서 이미 처리
            autocomplete.append({
                'label': sigungu,
                'full': f'{sido} {sigungu}',
                'type': 'sigungu',
                'sido': sido,
                'count': count,
            })

    # 동 레벨
    for sido in sorted(dong_count.keys()):
        for sigungu in sorted(dong_count[sido].keys()):
            for dong, count in sorted(dong_count[sido][sigungu].items(), key=lambda x: -x[1]):
                short_sido = SIDO_SHORT.get(sido, sido)
                short_sg = sigungu if sigungu != SEJONG else '세종'
                autocomplete.append({
                    'label': dong,
                    'full': f'{sido} {sigungu} {dong}',
                    'desc': f'{short_sido} {short_sg}',
                    'type': 'dong',
                    'sido': sido,
                    'sigungu': sigungu,
                    'count': count,
                })

    # === 3. 시군구별 JSON 파일 생성 ===
    sigungu_groups = defaultdict(list)
    for item in items:
        if item['sigungu']:
            key = f"{item['sido']}|{item['sigungu']}"
        else:
            key = f"{item['sido']}|{item['sido']}"
        sigungu_groups[key].append(item)

    os.makedirs(parking_dir, exist_ok=True)

    file_count = 0
    file_index = []

    for key, group_items in sorted(sigungu_groups.items()):
        parts = key.split('|')
        sido = parts[0]
        sigungu = parts[1]

        safe_sido = safe_filename(sido)
        safe_sg = safe_filename(sigungu)

        sido_dir = os.path.join(parking_dir, safe_sido)
        os.makedirs(sido_dir, exist_ok=True)
        filepath = os.path.join(sido_dir, f'{safe_sg}.json')
        url_path = f'/data/parking/{safe_sido}/{safe_sg}.json'

        # 위경도 있는 것만 + 정렬 (무료 우선, 주차면수 많은 순)
        valid_items = [it for it in group_items if it['lat'] and it['lng']]
        valid_items.sort(key=lambda x: (not x['isFree'], -x['totalSpaces']))

        data = {
            'sido': sido,
            'sigungu': sigungu,
            'totalCount': len(group_items),
            'validCount': len(valid_items),
            'items': valid_items,
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

        file_index.append({
            'sido': sido,
            'sigungu': sigungu,
            'path': url_path,
            'count': len(group_items),
            'validCount': len(valid_items),
        })
        file_count += 1

    print(f'  시군구별 JSON 파일 {file_count}개 생성 완료')

    # === 4. 자동완성 JSON 저장 ===
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    autocomplete_path = os.path.join(PUBLIC_DATA_DIR, 'parking-autocomplete.json')
    with open(autocomplete_path, 'w', encoding='utf-8') as f:
        json.dump(autocomplete, f, ensure_ascii=False, separators=(',', ':'))

    print(f'  자동완성 데이터 저장 완료 ({len(autocomplete)}개 항목)')

    # === 5. 지역 트리 JSON (Astro 빌드용) ===
    os.makedirs(SRC_DATA_DIR, exist_ok=True)

    region_tree = {}
    for sido in sorted(dong_count.keys()):
        region_tree[sido] = {}
        for sigungu in sorted(dong_count[sido].keys()):
            region_tree[sido][sigungu] = {}
            for dong, count in sorted(dong_count[sido][sigungu].items()):
                region_tree[sido][sigungu][dong] = count

    tree_path = os.path.join(SRC_DATA_DIR, 'parking-tree.json')
    with open(tree_path, 'w', encoding='utf-8') as f:
        json.dump(region_tree, f, ensure_ascii=False, indent=2)

    # 파일 인덱스 저장
    index_path = os.path.join(SRC_DATA_DIR, 'parking-file-index.json')
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(file_index, f, ensure_ascii=False, indent=2)

    print(f'  지역 트리 저장 완료 ({len(region_tree)}개 시도)')

    # === 통계 출력 ===
    print('\n📊 통계:')
    print(f'  시/도: {len(sido_count)}개')
    print(f'  시군구: {sum(len(v) for v in sigungu_count.values())}개')
    total_dong = sum(len(d) for sg in dong_count.values() for d in sg.values())
    print(f'  읍면동: {total_dong}개')
    print(f'  자동완성 항목: {len(autocomplete)}개')
    print(f'  JSON 파일: {file_count}개')
    print('\n✅ 빌드 완료!')


if __name__ == '__main__':
    main()
