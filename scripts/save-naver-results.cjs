const fs = require("fs");
const path = require("path");

const results = [{"gu":"동대문구","idx":0,"match":{"id":"1486273671","name":"서울약령시 공영주차장","address":"서울특별시 동대문구 제기동 1082","roadAddress":"서울특별시 동대문구 약령중앙로 26","x":"127.0371500","y":"37.5805099","tel":"1661-9408"}},{"gu":"동대문구","idx":1,"match":{"id":"1539087148","name":"정릉천복개 공영 주차장","address":"서울특별시 동대문구 제기동 891-2","roadAddress":"","x":"127.0350500","y":"37.5800300","tel":""}},{"gu":"동대문구","idx":2,"match":{"id":"36003348","name":"청계8가노상공영주차장","address":"서울특별시 동대문구 신설동 109-2","roadAddress":"","x":"127.0249716","y":"37.5715668","tel":""}},{"gu":"동대문구","idx":3,"match":{"id":"35992933","name":"외대주차빌딩 주차장","address":"서울특별시 동대문구 이문동 306-14","roadAddress":"서울특별시 동대문구 휘경로 28","x":"127.0626942","y":"37.5951609","tel":"02-969-5941"}},{"gu":"동대문구","idx":4,"match":{"id":"35977160","name":"장안2동공영주차장","address":"서울특별시 동대문구 장안2동 286-9","roadAddress":"서울특별시 동대문구 답십리로65길 124-5","x":"127.0706177","y":"37.5782728","tel":"02-2290-6417"}},{"gu":"동대문구","idx":5,"match":{"id":"35977144","name":"신설동공영주차장","address":"서울특별시 동대문구 신설동 114-29","roadAddress":"서울특별시 동대문구 난계로28길 16","x":"127.0246674","y":"37.5724109","tel":"02-2232-6096"}},{"gu":"동대문구","idx":6,"match":{"id":"35913825","name":"답십리부품상가노상공영주차장","address":"서울특별시 동대문구 답십리동 952-2","roadAddress":"서울특별시 동대문구 전농로4길 80","x":"127.0588126","y":"37.5647243","tel":""}},{"gu":"동대문구","idx":7,"match":{"id":"1432672528","name":"덕원 공영 주차장","address":"서울특별시 동대문구 장안동 458-8","roadAddress":"서울특별시 동대문구 장한로6길 54","x":"127.0688329","y":"37.5622810","tel":""}},{"gu":"동대문구","idx":8,"match":{"id":"1558885612","name":"장안1동공영주차장","address":"서울특별시 동대문구 장안동 392-3","roadAddress":"서울특별시 동대문구 답십리로66길 75","x":"127.0669289","y":"37.5695841","tel":""}},{"gu":"동대문구","idx":9,"match":{"id":"21185842","name":"회기동공영주차장","address":"서울특별시 동대문구 회기동 1-1","roadAddress":"서울특별시 동대문구 회기로25길 31","x":"127.0559381","y":"37.5922665","tel":""}},{"gu":"동대문구","idx":10,"match":{"id":"1163735972","name":"청량리시장 제3공영주차장","address":"서울특별시 동대문구 제기동 620-2","roadAddress":"서울특별시 동대문구 경동시장로 40","x":"127.0406853","y":"37.5824408","tel":"02-2247-9664"}},{"gu":"동대문구","idx":11,"match":{"id":"35913829","name":"정릉천변노상공영주차장","address":"서울특별시 동대문구 제기동 1205","roadAddress":"","x":"127.0355682","y":"37.5817156","tel":""}},{"gu":"동대문구","idx":12,"match":{"id":"21185773","name":"휘경유수지공영주차장","address":"서울특별시 동대문구 휘경동 7-18","roadAddress":"서울특별시 동대문구 한천로 326","x":"127.0695247","y":"37.5883820","tel":""}},{"gu":"동대문구","idx":13,"match":null},{"gu":"동대문구","idx":14,"match":{"id":"1178957071","name":"청량리시장 제1공영주차장","address":"서울특별시 동대문구 제기동 849","roadAddress":"","x":"127.0411462","y":"37.5792542","tel":"02-2247-9664"}},{"gu":"동대문구","idx":15,"match":{"id":"1077296201","name":"청량리시장 제2공영주차장","address":"서울특별시 동대문구 제기동 988","roadAddress":"서울특별시 동대문구 경동시장로 19-1","x":"127.0404028","y":"37.5807239","tel":""}},{"gu":"동대문구","idx":16,"match":{"id":"1365381207","name":"견인보관소 공영 주차장","address":"서울특별시 동대문구 휘경2동 348","roadAddress":"서울특별시 동대문구 한천로 326","x":"127.0695600","y":"37.5895700","tel":""}},{"gu":"동대문구","idx":17,"match":null},{"gu":"동대문구","idx":18,"match":{"id":"1409744986","name":"동대문구시설관리공단","address":"서울특별시 동대문구 제기동 271-48","roadAddress":"서울특별시 동대문구 정릉천동로 83","x":"127.0349578","y":"37.5797386","tel":"02-2247-9664"}},{"gu":"동대문구","idx":19,"match":{"id":"781877945","name":"신답고가 노상 공영 주차장","address":"서울특별시 동대문구 답십리동 530-3","roadAddress":"","x":"127.0502698","y":"37.5699045","tel":""}},{"gu":"동대문구","idx":20,"match":{"id":"1915576262","name":"약령시공영주차장","address":"서울특별시 동대문구 제기동 1082","roadAddress":"서울특별시 동대문구 약령중앙로 26","x":"127.0376113","y":"37.5805977","tel":"070-5088-2390"}},{"gu":"동대문구","idx":21,"match":{"id":"35913830","name":"신일피혁주변 노상 공영 주차장","address":"서울특별시 동대문구 장안동 480-9","roadAddress":"","x":"127.0683026","y":"37.5655120","tel":"02-456-2591"}},{"gu":"동대문구","idx":22,"match":{"id":"1560839924","name":"삼희상가 노상 공영 주차장","address":"서울특별시 동대문구 답십리동 530-3","roadAddress":"","x":"127.0525159","y":"37.5678636","tel":""}},{"gu":"동대문구","idx":23,"match":{"id":"1218182846","name":"동대문소방서 노상공영주차장","address":"서울특별시 동대문구 장안동 480-9","roadAddress":"","x":"127.0669503","y":"37.5636479","tel":""}},{"gu":"노원구","idx":0,"match":{"id":"1035781410","name":"마들스타디움 근린공원 주차장","address":"서울특별시 노원구 상계6.7동 770-2","roadAddress":"서울특별시 노원구 덕릉로 450","x":"127.0583268","y":"37.6448936","tel":"02-2289-6736"}},{"gu":"노원구","idx":1,"match":{"id":"36010824","name":"노원골 노상 공영 주차장","address":"서울특별시 노원구 상계동 1120-72","roadAddress":"","x":"127.0574146","y":"37.6751379","tel":"02-2289-6720"}},{"gu":"노원구","idx":2,"match":{"id":"1668120574","name":"등나무근린공원 공영주차장","address":"서울특별시 노원구 중계동 508-1","roadAddress":"","x":"127.0674491","y":"37.6407960","tel":"1661-8838"}},{"gu":"노원구","idx":3,"match":{"id":"1739042847","name":"건영백화점 앞 공영주차장","address":"서울특별시 노원구 중계동 507","roadAddress":"서울특별시 노원구 동일로203가길 2-2","x":"127.0647226","y":"37.6405103","tel":""}},{"gu":"노원구","idx":4,"match":{"id":"1029910854","name":"하계동 한글비 공영 주차장","address":"서울특별시 노원구 하계동 256-1","roadAddress":"","x":"127.0760472","y":"37.6440038","tel":""}},{"gu":"노원구","idx":5,"match":{"id":"18646988","name":"상계2동공영주차장","address":"서울특별시 노원구 상계동 373-13","roadAddress":"서울특별시 노원구 상계로10길 14","x":"127.0676393","y":"37.6568343","tel":"02-931-2758"}},{"gu":"노원구","idx":6,"match":null},{"gu":"노원구","idx":7,"match":null},{"gu":"노원구","idx":8,"match":{"id":"1035781410","name":"마들스타디움 근린공원 주차장","address":"서울특별시 노원구 상계6.7동 770-2","roadAddress":"서울특별시 노원구 덕릉로 450","x":"127.0583268","y":"37.6448936","tel":"02-2289-6736"}},{"gu":"노원구","idx":9,"match":{"id":"21186070","name":"상계주공7단지아파트공영주차장","address":"서울특별시 노원구 상계동 692","roadAddress":"서울특별시 노원구 동일로 1456","x":"127.0609971","y":"37.6563632","tel":""}},{"gu":"노원구","idx":10,"match":{"id":"36010807","name":"불암산공영주차장","address":"서울특별시 노원구 중계동 산26","roadAddress":"서울특별시 노원구 덕릉로94길 73","x":"127.0792624","y":"37.6614653","tel":""}},{"gu":"노원구","idx":11,"match":null},{"gu":"노원구","idx":12,"match":null},{"gu":"노원구","idx":13,"match":null},{"gu":"노원구","idx":14,"match":null},{"gu":"노원구","idx":15,"match":null},{"gu":"노원구","idx":16,"match":null},{"gu":"노원구","idx":17,"match":null},{"gu":"노원구","idx":18,"match":null},{"gu":"노원구","idx":19,"match":{"id":"21185652","name":"공릉동 공영 주차장","address":"서울특별시 노원구 공릉동 633-19","roadAddress":"","x":"127.0774375","y":"37.6201403","tel":""}},{"gu":"노원구","idx":20,"match":{"id":"21185652","name":"공릉동 공영 주차장","address":"서울특별시 노원구 공릉동 633-19","roadAddress":"","x":"127.0774375","y":"37.6201403","tel":""}},{"gu":"노원구","idx":21,"match":{"id":"37020624","name":"노원구청 주차장","address":"서울특별시 노원구 상계동 701-1","roadAddress":"서울특별시 노원구 노해로 437","x":"127.0569339","y":"37.6538856","tel":"02-2116-4229"}},{"gu":"노원구","idx":22,"match":{"id":"35977137","name":"석계역공영주차장","address":"서울특별시 노원구 월계동 50-9","roadAddress":"서울특별시 노원구 석계로9길 66","x":"127.0629741","y":"37.6153172","tel":""}},{"gu":"노원구","idx":23,"match":{"id":"35977137","name":"석계역공영주차장","address":"서울특별시 노원구 월계동 50-9","roadAddress":"서울특별시 노원구 석계로9길 66","x":"127.0629741","y":"37.6153172","tel":""}},{"gu":"노원구","idx":24,"match":{"id":"37020624","name":"노원구청 주차장","address":"서울특별시 노원구 상계동 701-1","roadAddress":"서울특별시 노원구 노해로 437","x":"127.0569339","y":"37.6538856","tel":"02-2116-4229"}},{"gu":"노원구","idx":25,"match":{"id":"21187058","name":"중계문화공원주차장","address":"서울특별시 노원구 중계동","roadAddress":"","x":"127.0650912","y":"37.6395186","tel":""}},{"gu":"노원구","idx":26,"match":{"id":"21187058","name":"중계문화공원주차장","address":"서울특별시 노원구 중계동","roadAddress":"","x":"127.0650912","y":"37.6395186","tel":""}}];

const naverDir = path.join("/Users/gwonsunhyeon/Desktop/Trip웹사이트", "naver-map", "서울특별시");
const today = new Date().toISOString().split("T")[0];

const byGu = {};
for (const r of results) {
  if (!r.match) continue;
  if (!byGu[r.gu]) byGu[r.gu] = [];
  byGu[r.gu].push(r);
}

function getDong(address) {
  const m = address.match(/[가-힣]+[동가]\d*(?:-\d+)?/);
  if (m) return m[0].replace(/\d+-?\d*$/, "");
  return "";
}

for (const [gu, items] of Object.entries(byGu)) {
  const filePath = path.join(naverDir, gu + ".json");
  let existing = { items: [] };
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  const existingIds = new Set(existing.items.map(i => i.naverPlaceId));
  let added = 0;

  for (const r of items) {
    if (existingIds.has(r.match.id)) continue;
    existing.items.push({
      naverPlaceId: r.match.id,
      name: r.match.name,
      address: r.match.address,
      roadAddress: r.match.roadAddress,
      lat: parseFloat(r.match.y),
      lng: parseFloat(r.match.x),
      phone: r.match.tel,
      dong: getDong(r.match.address)
    });
    existingIds.add(r.match.id);
    added++;
  }

  existing.sido = "서울특별시";
  existing.sigungu = gu;
  existing.totalCount = existing.items.length;
  existing.source = "naver-map";
  existing.scrapedAt = today;

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + "\n");
  console.log(gu + ": " + existing.items.length + "개 (신규 " + added + "개)");
}
