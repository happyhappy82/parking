import fs from 'node:fs';
import path from 'node:path';

// 네이버 Summary API에서 수집한 전체 데이터
const naverData = {
  0: {pid:"21295763",name:"수서역공영주차장",lng:127.0999341,lat:37.4879314,address:"서울 강남구 수서동 735",roadAddress:null},
  1: {pid:"1460911431",name:"압구정428공영주차장",lng:127.0265739,lat:37.527105,address:"서울 강남구 압구정동 428",roadAddress:"서울 강남구 압구정동 압구정로 161"},
  2: {pid:"1851819290",name:"탄천제2호 공영노외주차장",lng:127.0877417,lat:37.4941796,address:"서울 강남구 일원동 4-49",roadAddress:null},
  3: {pid:"1751307322",name:"역삼문화공원제1호공영주차장",lng:127.0299983,lat:37.5001169,address:"서울 강남구 역삼동 635-1",roadAddress:"서울 강남구 테헤란로7길 21"},
  4: {pid:"36502404",name:"언북초등학교주차장",lng:127.0447936,lat:37.5200788,address:"서울 강남구 청담동 27",roadAddress:"서울 강남구 삼성로135길 42"},
  5: {pid:"1190123313",name:"헌릉로745길공영주차장",lng:127.1182885,lat:37.4685072,address:"서울 강남구 율현동 125-4",roadAddress:null},
  6: {pid:"38494965",name:"언주초교 주차장",lng:127.0377179,lat:37.4867169,address:"서울 강남구 도곡동 922",roadAddress:"서울 강남구 남부순환로363길 19"},
  7: {pid:"1232495941",name:"도곡초교 공영 주차장",lng:127.0549161,lat:37.4996731,address:"서울 강남구 대치동 924-10",roadAddress:"서울 강남구 선릉로64길 33"},
  8: {pid:"1041388360",name:"포이초교주차장",lng:127.0522994,lat:37.4755821,address:"서울 강남구 개포동 1273",roadAddress:"서울 강남구 개포로22길 87"},
  9: {pid:"1094494340",name:"논현초교 공영 주차장",lng:127.0267648,lat:37.5081904,address:"서울 강남구 논현동 168",roadAddress:"서울 강남구 강남대로120길 33"},
  10: {pid:"18848982",name:"영희초등학교공영주차장",lng:127.0809885,lat:37.4922305,address:"서울 강남구 일원동 617",roadAddress:"서울 강남구 일원로 21"},
  11: {pid:"36501462",name:"신구초등학교주차장",lng:127.0236406,lat:37.5233265,address:"서울 강남구 신사동 550-11",roadAddress:"서울 강남구 압구정로18길 28"},
  12: {pid:"35977147",name:"학여울역공영주차장",lng:127.0727001,lat:37.4969288,address:"서울 강남구 대치동 514",roadAddress:"서울 강남구 남부순환로 3104 SETEC"},
  13: {pid:"21186131",name:"일원대치길공영노상주차장",lng:127.0763904,lat:37.4933324,address:"서울 강남구 개포동",roadAddress:null},
  14: {pid:"36003294",name:"대치2동문화센터 공영주차장",lng:127.0639223,lat:37.5021227,address:"서울 강남구 대치동 980-9",roadAddress:"서울 강남구 영동대로65길 24"},
  15: {pid:"18803861",name:"개포동공원 공영주차장입출구",lng:127.0683234,lat:37.4895625,address:"서울 강남구 개포동",roadAddress:null},
  16: {pid:"1502796498",name:"압구정로29길 주차장",lng:127.0342941,lat:37.5297393,address:"서울 강남구 압구정동 482",roadAddress:"서울 강남구 압구정로 309"},
  17: {pid:"1540666624",name:"탄천 공영 주차장",lng:127.0683938,lat:37.5086403,address:"서울 강남구 대치동 78-25",roadAddress:null},
  18: {pid:"1614133065",name:"구룡산제2호 공영 주차장",lng:127.0664769,lat:37.4772632,address:"서울 강남구 개포동 126-2",roadAddress:"서울 강남구 양재대로 478"},
  19: {pid:"48912639",name:"강남구보건소 주차장",lng:127.0420799,lat:37.5163591,address:"서울 강남구 삼성동 8",roadAddress:"서울 강남구 선릉로 668"},
  20: {pid:"21186092",name:"역삼1동문화센터공영주차장",lng:127.0332824,lat:37.4952425,address:"서울 강남구 역삼동 829-20",roadAddress:"서울 강남구 역삼로7길 16"},
  21: {pid:"1273106751",name:"밤고개로21길 주차장",lng:127.1119461,lat:37.4731636,address:"서울 강남구 율현동 529",roadAddress:null},
  22: {pid:"37602323",name:"대왕초등학교 공영주차장입출구",lng:127.1063963,lat:37.4643023,address:"서울 강남구 세곡동",roadAddress:null},
  23: {pid:"1084842924",name:"구룡산제1호 공영 주차장",lng:127.0658355,lat:37.4778884,address:"서울 강남구 개포동 570",roadAddress:"서울 강남구 양재대로 478"},
  24: {pid:"21185859",name:"강남구치매안심센터 공영주차장",lng:127.0464124,lat:37.5102332,address:"서울 강남구 삼성동 113-26",roadAddress:"서울 강남구 선릉로108길 27"},
  25: {pid:"21185616",name:"논현 제1호 공영주차장",lng:127.0246189,lat:37.5106786,address:"서울 강남구 논현동 123-11",roadAddress:"서울 강남구 학동로6길 19"},
  26: {pid:"21186201",name:"논현로22길공영주차장",lng:127.0473921,lat:37.4814147,address:"서울 강남구 개포동 1266",roadAddress:"서울 강남구 개포로25길 32"},
  27: {pid:"1856391392",name:"영동대로85길 공영노상주차장",lng:127.0603345,lat:37.5063795,address:"서울 강남구 대치동 1012-28",roadAddress:null},
  28: {pid:"1961058587",name:"논현제2호 공영주차장",lng:127.0286422,lat:37.5121736,address:"서울 강남구 논현동 127-14",roadAddress:"서울 강남구 학동로20길 13"},
  29: {pid:"18751976",name:"도곡로21길7 공영주차장",lng:127.0387397,lat:37.4924245,address:"서울 강남구 역삼동 795-25",roadAddress:"서울 강남구 도곡로21길 7"},
  30: {pid:"35992823",name:"일원역공영주차장",lng:127.0837812,lat:37.4846979,address:"서울 강남구 일원동 716-2",roadAddress:null},
  31: {pid:"1168678293",name:"삼성1동 문화센터 공영 주차장",lng:127.0626072,lat:37.5143559,address:"서울 강남구 삼성동 161-2",roadAddress:"서울 강남구 봉은사로 616"},
  32: {pid:"1251599799",name:"논현로28길주차장",lng:127.0452575,lat:37.4885787,address:"서울 강남구 도곡동 163-7",roadAddress:null},
  33: {pid:"1047180471",name:"일원1동 기계식 공영주차장",lng:127.0817944,lat:37.4895651,address:"서울 강남구 일원동 684-8",roadAddress:"서울 강남구 양재대로27길 5"},
  34: {pid:"81918328",name:"은마아파트 노상공영주차장",lng:127.0632667,lat:37.4990004,address:"서울 강남구 대치동 317-2",roadAddress:null},
  35: {pid:"1948039796",name:"개포주공5단지북측 주차장",lng:127.0625686,lat:37.4802627,address:"서울 강남구 개포동 660-37",roadAddress:"서울 강남구 선릉로 9"},
  36: {pid:"1848183166",name:"역삼문화공원제2호공영주차장",lng:127.0298147,lat:37.5027269,address:"서울 강남구 역삼동 635",roadAddress:"서울 강남구 테헤란로7길 32"},
  37: {pid:"36015864",name:"대치유수지체육공원 노상공영주차장",lng:127.0682503,lat:37.5048642,address:"서울 강남구 대치동 78-29",roadAddress:"서울 강남구 역삼로107길 20-28"},
  38: {pid:"1846959948",name:"개포4문화센터 주차장",lng:127.0499048,lat:37.4771474,address:"서울 강남구 개포동 1204",roadAddress:"서울 강남구 개포로24길 33"},
  39: {pid:"1661857334",name:"일원동맛의거리주차장",lng:127.0828399,lat:37.4879913,address:"서울 강남구 일원동 50",roadAddress:"서울 강남구 일원로 81"},
  40: {pid:"36010934",name:"삼성로별관 주차장",lng:127.0520531,lat:37.516033,address:"서울 강남구 삼성동 66",roadAddress:"서울 강남구 삼성로 628"},
  41: {pid:"1642195070",name:"영동6교밑노상공영주차장입구",lng:127.0708658,lat:37.4943612,address:"서울 강남구 대치동",roadAddress:null},
  42: {pid:"1310563804",name:"한티역 공영주차장",lng:127.0511203,lat:37.497996,address:"서울 강남구 역삼동 805-36",roadAddress:null},
  // i:43 (신사역) - 네이버에 미등록
  // i:44
  44: {pid:"1074010556",name:"도산대로45길 주차장",lng:127.0201644,lat:37.5260658,address:"서울 강남구 압구정동 414",roadAddress:"서울 강남구 압구정로11길 17"},
  // i:45 (남부순환로397길) - 네이버에 미등록
  // i:46 (언주로171길) - 잘못된 매칭(i:44와 동일 좌표)이므로 제외
  47: {pid:"1299339928",name:"선릉로146길노상공영주차장",lng:127.0406381,lat:37.5218078,address:"서울 강남구 청담동",roadAddress:null},
  48: {pid:"21186134",name:"대치대명길공영노상주차장",lng:127.060675,lat:37.5064999,address:"서울 강남구 대치동 1012-28",roadAddress:null},
  49: {pid:"1374222057",name:"도곡로421 공영주차장",lng:127.0564733,lat:37.4978315,address:"서울 강남구 대치동 939-21",roadAddress:"서울 강남구 도곡로 421"},
  50: {pid:"999795326",name:"공영주차장",lng:127.0886003,lat:37.4910564,address:"서울 강남구 일원동 711-1",roadAddress:"서울 강남구 양재대로55길 6"},
  51: {pid:"36015847",name:"테헤란로69길노상공영주차장",lng:127.052483,lat:37.5065721,address:"서울 강남구 삼성동 172-99",roadAddress:null},
  52: {pid:"1498636043",name:"영동대로106길 공영노상주차장",lng:127.0638637,lat:37.5141839,address:"서울 강남구 삼성동 162-23",roadAddress:"서울 강남구 영동대로106길 33"},
  53: {pid:"36015846",name:"논현로131길노상공영주차장",lng:127.0291518,lat:37.5142719,address:"서울 강남구 논현동 279-99",roadAddress:null},
  54: {pid:"21185758",name:"도곡로327 공영주차장",lng:127.0516645,lat:37.4961575,address:"서울 강남구 역삼동 765-22",roadAddress:"서울 강남구 도곡로 327"},
  55: {pid:"1999782659",name:"압구정고가1 노상 공영 주차장",lng:127.0284083,lat:37.5260375,address:"서울 강남구 신사동 668",roadAddress:"서울 강남구 논현로 837-2"},
  56: {pid:"1365923448",name:"압구정고가2 노상 공영 주차장",lng:127.0283942,lat:37.5257295,address:"서울 강남구 신사동 668",roadAddress:"서울 강남구 논현로 837-2"},
  57: {pid:"36005598",name:"동호대교밑노상공영주차장",lng:127.0244891,lat:37.5309778,address:"서울 강남구 압구정동 434",roadAddress:"서울 강남구 압구정로 151"},
  58: {pid:"36015854",name:"선릉로132길노상공영주차장",lng:127.0423392,lat:37.5181364,address:"서울 강남구 청담동 77-84",roadAddress:"서울 강남구 선릉로132길 12-2"},
  59: {pid:"1999054769",name:"논현로32길15 공영주차장",lng:127.0434199,lat:37.484235,address:"서울 강남구 도곡동 516-2",roadAddress:"서울 강남구 논현로32길 15"},
  60: {pid:"1652885793",name:"영동대로86길 노상공영주차장",lng:127.0652814,lat:37.5070807,address:"서울 강남구 대치동 1012-22",roadAddress:null},
  61: {pid:"1948019487",name:"영동대로96길 노상공영주차장",lng:127.06368,lat:37.5109373,address:"서울 강남구 삼성동 172-40",roadAddress:null},
  62: {pid:"36015849",name:"언주로147길 노상공영주차장",lng:127.0328523,lat:37.5196767,address:"서울 강남구 논현동 279-22",roadAddress:null},
  63: {pid:"21185906",name:"일원터널공영주차장",lng:127.07915,lat:37.4828428,address:"서울 강남구 일원동 722-2",roadAddress:null},
  64: {pid:"36015856",name:"테헤란로26길노상공영주차장",lng:127.0360997,lat:37.4996361,address:"서울 강남구 역삼동 737",roadAddress:"서울 강남구 테헤란로 152"},
  65: {pid:"1321759540",name:"테헤란로78길 노상공영주차장",lng:127.0553256,lat:37.5057889,address:"서울 강남구 대치동 1011-6",roadAddress:null},
  66: {pid:"1305923384",name:"테헤란로64길 공영노상주차장",lng:127.0512495,lat:37.5047836,address:"서울 강남구 대치동 890",roadAddress:"서울 강남구 테헤란로 412"},
};

// 주소에서 동 추출
function extractDong(address) {
  if (!address) return '';
  const match = address.match(/강남구\s+([가-힣]+동)/);
  return match ? match[1] : '';
}

const filePath = path.resolve('content/parking/서울특별시/강남구.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const items = data.items;

let updated = 0;
let skipped = 0;

for (const [idxStr, naver] of Object.entries(naverData)) {
  const idx = parseInt(idxStr);
  if (idx >= items.length) continue;

  const lot = items[idx];

  // placeId 적용
  lot.naverPlaceId = naver.pid;
  lot.naverName = naver.name;

  // 좌표 업데이트
  if (naver.lat && naver.lng) {
    lot.lat = naver.lat;
    lot.lng = naver.lng;
  }

  // 도로명주소 업데이트 (유효한 경우만)
  if (naver.roadAddress && !naver.roadAddress.includes('주변')) {
    lot.roadAddress = naver.roadAddress;
  }

  // 동 추출 (비어있는 경우)
  if (!lot.dong) {
    const dong = extractDong(naver.address);
    if (dong) lot.dong = dong;
  }

  lot.naverDataSource = true;
  lot.updatedAt = '2026-02-10';

  updated++;
  console.log(`[${idx}] ${lot.name} → ${naver.name} (${naver.pid}) ✅`);
}

// 미매칭 항목 표시
for (const idx of [43, 45, 46]) {
  if (idx < items.length) {
    console.log(`[${idx}] ${items[idx].name} → 네이버 미등록/미매칭 ⚠️`);
    skipped++;
  }
}

// 저장
data.items = items;
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n[저장] ${filePath}`);

// public 쪽도 저장
const publicPath = filePath.replace('/content/', '/public/data/');
if (fs.existsSync(path.dirname(publicPath))) {
  fs.writeFileSync(publicPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[저장] ${publicPath}`);
}

console.log(`\n[완료] 업데이트: ${updated}개 / 미매칭: ${skipped}개 / 전체: ${items.length}개`);
