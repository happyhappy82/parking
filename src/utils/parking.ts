// 주차장 데이터 타입 정의 (공공데이터포털 전국주차장정보 표준데이터 기반)

export interface ParkingLot {
  name: string;           // 주차장명
  type: string;           // 주차장구분 (공영/민영)
  category: string;       // 주차장유형 (노외/노상/부설)
  address: string;        // 소재지주소
  lat: number;            // 위도
  lng: number;            // 경도
  totalSpaces: number;    // 주차구획수
  isFree: boolean;        // 무료구분
  operatingDays: string;  // 운영요일
  weekdayOpen: string;    // 평일운영시작
  weekdayClose: string;   // 평일운영종료
  weekendOpen: string;    // 주말운영시작
  weekendClose: string;   // 주말운영종료
  holidayOpen: string;    // 공휴일운영시작
  holidayClose: string;   // 공휴일운영종료
  feeInfo: string;        // 요금정보
  phone: string;          // 전화번호
  updatedAt: string;      // 데이터기준일자
}

export interface ParkingAPIResponse {
  items: ParkingLot[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  error?: string;
}

// 지역별 중심 좌표 (검색 시 지도 이동용)
export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  '서울': { lat: 37.5665, lng: 126.9780 },
  '부산': { lat: 35.1796, lng: 129.0756 },
  '제주': { lat: 33.4996, lng: 126.5312 },
  '강릉': { lat: 37.7519, lng: 128.8760 },
  '인천': { lat: 37.4563, lng: 126.7052 },
  '대전': { lat: 36.3504, lng: 127.3845 },
  '대구': { lat: 35.8714, lng: 128.6014 },
  '광주': { lat: 35.1595, lng: 126.8526 },
  '울산': { lat: 35.5384, lng: 129.3114 },
  '수원': { lat: 37.2636, lng: 127.0286 },
  '전주': { lat: 35.8242, lng: 127.1480 },
  '경주': { lat: 35.8562, lng: 129.2247 },
  '속초': { lat: 38.2070, lng: 128.5918 },
  '여수': { lat: 34.7604, lng: 127.6622 },
  '통영': { lat: 34.8544, lng: 128.4332 },
  '세종': { lat: 36.4800, lng: 127.2590 },
  '춘천': { lat: 37.8813, lng: 127.7298 },
  '목포': { lat: 34.8118, lng: 126.3922 },
  '포항': { lat: 36.0190, lng: 129.3435 },
  '창원': { lat: 35.2270, lng: 128.6811 },
};

// 지역명 → 검색 키워드 매핑 (도로명주소에 포함되는 형태로)
export const REGION_SEARCH_MAP: Record<string, string> = {
  '서울': '서울',
  '부산': '부산',
  '대구': '대구',
  '인천': '인천',
  '광주': '광주광역시',
  '대전': '대전',
  '울산': '울산',
  '세종': '세종',
  '제주': '제주',
  '수원': '수원',
  '강릉': '강릉',
  '전주': '전주',
  '경주': '경주',
  '속초': '속초',
  '여수': '여수',
  '통영': '통영',
  '춘천': '춘천',
  '목포': '목포',
  '포항': '포항',
  '창원': '창원',
};
