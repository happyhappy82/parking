// 전체 content/parking 디렉토리의 JSON 파일에 대해 naver-enrich.mjs 실행
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const parkingDir = path.join(process.cwd(), 'content', 'parking');
const skipDone = process.argv.includes('--skip-done'); // 이미 enrichment된 파일 스킵

const sidos = fs.readdirSync(parkingDir).filter(f =>
  fs.statSync(path.join(parkingDir, f)).isDirectory()
);

let totalFiles = 0;
let processedFiles = 0;
let skippedFiles = 0;

// 각 시도 → 시군구 JSON 파일 목록
const allFiles = [];
for (const sido of sidos) {
  const sidoDir = path.join(parkingDir, sido);
  const files = fs.readdirSync(sidoDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    allFiles.push(path.join(sidoDir, file));
  }
}

totalFiles = allFiles.length;
console.log(`\n[전체] ${totalFiles}개 JSON 파일 발견\n`);

for (const filePath of allFiles) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const items = data.items || [];

  // naverName 없는 항목 수 체크
  const needsEnrich = items.filter(item => !item.naverPlaceId).length;

  if (skipDone && needsEnrich === 0) {
    skippedFiles++;
    console.log(`[스킵] ${data.sido} ${data.sigungu} - 이미 완료 (${items.length}개)`);
    continue;
  }

  if (needsEnrich === 0) {
    skippedFiles++;
    console.log(`[스킵] ${data.sido} ${data.sigungu} - 모든 항목 naverPlaceId 있음`);
    continue;
  }

  processedFiles++;
  console.log(`\n========================================`);
  console.log(`[${processedFiles}/${totalFiles - skippedFiles}] ${data.sido} ${data.sigungu} - ${needsEnrich}/${items.length}개 enrichment 필요`);
  console.log(`========================================\n`);

  try {
    execSync(`node scripts/naver-enrich.mjs "${filePath}"`, {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 600000, // 10분 타임아웃
    });
  } catch (e) {
    console.error(`[에러] ${filePath}: ${e.message}`);
  }
}

console.log(`\n[완료] 처리: ${processedFiles}개 / 스킵: ${skippedFiles}개 / 전체: ${totalFiles}개`);
