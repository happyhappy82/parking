#!/usr/bin/env node
/**
 * 노션 에디토리얼 DB에서 불필요한 컬럼 삭제
 * 공공데이터 관련 컬럼 및 중복 컬럼 제거
 */
import { Client } from '@notionhq/client';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_EDITORIAL_DB_ID || '30a753ebc01381cd950de995f4bdc0bf';
const notion = new Client({ auth: NOTION_TOKEN });

const COLUMNS_TO_REMOVE = [
  '동',           // 소재지에 이미 포함
  '도로명주소',    // 소재지와 중복
  '위도',         // 공단 데이터에 불필요
  '경도',         // 공단 데이터에 불필요
  '총주차면수',    // 구획수와 중복
  '무료여부',      // 요금정보에서 파악 가능
  '운영요일',      // 운영시간에 포함
  '요금정보_공공',  // 공공데이터 더 이상 불필요
];

async function main() {
  console.log('=== 노션 DB 불필요 컬럼 삭제 ===\n');
  console.log(`삭제 대상: ${COLUMNS_TO_REMOVE.join(', ')}\n`);

  const propsToRemove = {};
  for (const col of COLUMNS_TO_REMOVE) {
    propsToRemove[col] = null;
  }

  await notion.databases.update({
    database_id: DB_ID,
    properties: propsToRemove,
  });

  console.log(`✓ ${COLUMNS_TO_REMOVE.length}개 컬럼 삭제 완료!`);

  // 삭제 후 남은 컬럼 확인
  const db = await notion.databases.retrieve({ database_id: DB_ID });
  const remaining = Object.keys(db.properties);
  console.log(`\n남은 컬럼 (${remaining.length}개):`);
  remaining.forEach(col => console.log(`  - ${col}`));
}

main().catch(console.error);
