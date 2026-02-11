// 네이버 검색 API 테스트
const query = process.argv[2] || '강남구 도곡초교 주차장';

const url = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(query)}&type=all&searchCoord=&boundary=`;
console.log('Query:', query);

const res = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://map.naver.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  }
});

console.log('Status:', res.status);
const json = await res.json();

if (json.result?.ncaptcha) {
  console.log('CAPTCHA BLOCKED!');
  console.log('ncaptcha:', JSON.stringify(json.result.ncaptcha));
} else if (json.result?.place?.list) {
  console.log('Places found:', json.result.place.list.length);
  json.result.place.list.slice(0, 5).forEach(p => {
    const name = (p.name || '').replace(/<[^>]*>/g, '');
    console.log(` - ${name} | id: ${p.id} | ${p.roadAddress || p.address || ''}`);
  });
} else {
  console.log('No places found');
  console.log(JSON.stringify(json).substring(0, 500));
}
