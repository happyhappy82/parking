import fs from 'fs';
import path from 'path';

// 디렉토리 생성 함수
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 숫자에 콤마 추가
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 운영시간 포맷
function formatOperatingHours(open, close) {
  if (open === '00:00' && close === '00:00') {
    return '24시간';
  }
  return `${open}~${close}`;
}

// 시도별로 데이터 수집
function collectDataBySido(parkingDataDir) {
  const sidoMap = new Map();

  // 모든 시도 디렉토리 읽기
  const sidoDirs = fs.readdirSync(parkingDataDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const sido of sidoDirs) {
    const sidoPath = path.join(parkingDataDir, sido);

    // 시군구별 JSON 파일 읽기
    const sigunguFiles = fs.readdirSync(sidoPath)
      .filter(file => file.endsWith('.json'));

    const sigunguData = [];

    for (const file of sigunguFiles) {
      const filePath = path.join(sidoPath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (data.items && data.items.length > 0) {
        sigunguData.push({
          sigungu: data.sigungu,
          items: data.items
        });
      }
    }

    if (sigunguData.length > 0) {
      sidoMap.set(sido, sigunguData);
    }
  }

  return sidoMap;
}

// 마크다운 생성
function generateMarkdown(sido, sigunguDataList) {
  let totalCount = 0;
  let freeCount = 0;
  let paidCount = 0;

  // 시군구별로 정렬
  sigunguDataList.sort((a, b) => a.sigungu.localeCompare(b.sigungu, 'ko'));

  // 각 시군구의 아이템들을 주차면수 기준 정렬
  for (const sigunguData of sigunguDataList) {
    sigunguData.items.sort((a, b) => (b.totalSpaces || 0) - (a.totalSpaces || 0));

    totalCount += sigunguData.items.length;
    freeCount += sigunguData.items.filter(item => item.isFree === true).length;
  }
  paidCount = totalCount - freeCount;

  const updatedAt = new Date().toISOString().split('T')[0];

  // Frontmatter
  let markdown = `---
region: "${sido}"
totalCount: ${totalCount}
freeCount: ${freeCount}
paidCount: ${paidCount}
sigunguCount: ${sigunguDataList.length}
updatedAt: "${updatedAt}"
---

# ${sido} 무료주차장

총 **${formatNumber(totalCount)}개** 주차장 (무료 ${formatNumber(freeCount)}개 / 유료 ${formatNumber(paidCount)}개)

`;

  // 시군구별 테이블 생성
  for (const sigunguData of sigunguDataList) {
    const { sigungu, items } = sigunguData;
    const sigunguFreeCount = items.filter(item => item.isFree === true).length;

    markdown += `## ${sigungu}\n\n`;
    markdown += `총 ${formatNumber(items.length)}개 주차장 (무료 ${formatNumber(sigunguFreeCount)}개)\n\n`;
    markdown += `| 주차장명 | 유형 | 구분 | 주소 | 주차면수 | 요금 | 운영시간(평일) | 전화번호 |\n`;
    markdown += `|---------|------|------|------|---------|------|--------------|---------|`;

    for (const item of items) {
      const name = item.name || '-';
      const type = item.type || '-';
      const category = item.category || '-';
      const address = item.address || '-';
      const totalSpaces = item.totalSpaces ? formatNumber(item.totalSpaces) : '-';
      const feeInfo = item.feeInfo || '-';
      const operatingHours = formatOperatingHours(item.weekdayOpen, item.weekdayClose);
      const phone = item.phone || '-';

      markdown += `\n| ${name} | ${type} | ${category} | ${address} | ${totalSpaces} | ${feeInfo} | ${operatingHours} | ${phone} |`;
    }

    markdown += '\n\n';
  }

  return markdown;
}

// 메인 함수
function main() {
  const baseDir = '/Users/gwonsunhyeon/Desktop/Trip웹사이트';
  const parkingDataDir = path.join(baseDir, 'public/data/parking');
  const outputDir = path.join(baseDir, 'src/content/parking');

  // 출력 디렉토리 생성
  ensureDirectoryExists(outputDir);

  console.log('주차장 데이터 수집 중...');
  const sidoMap = collectDataBySido(parkingDataDir);

  console.log(`총 ${sidoMap.size}개 시도 발견`);

  let filesCreated = 0;

  for (const [sido, sigunguDataList] of sidoMap) {
    console.log(`${sido} 마크다운 생성 중...`);
    const markdown = generateMarkdown(sido, sigunguDataList);

    const outputPath = path.join(outputDir, `${sido}.md`);
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    filesCreated++;
    console.log(`✓ ${sido}.md 생성 완료`);
  }

  console.log(`\n총 ${filesCreated}개 마크다운 파일 생성 완료!`);
}

main();
