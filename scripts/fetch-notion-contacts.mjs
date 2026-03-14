#!/usr/bin/env node
/**
 * Notion에서 "서울시 구별 공단 주차장 연락처" 데이터를 가져와서 JSON으로 저장
 */

import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Notion DB ID: https://www.notion.so/a4685c8a55ef40dea24a66055d7fe3e0
const DATABASE_ID = 'a4685c8a55ef40dea24a66055d7fe3e0';

// .env 파일에서 NOTION_TOKEN 읽기
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const notionToken = envContent.match(/NOTION_TOKEN=(.+)/)?.[1]?.trim();

if (!notionToken) {
  console.error('❌ NOTION_TOKEN이 .env 파일에 없습니다!');
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

// 프로퍼티 값 추출 헬퍼
function getPropertyValue(page, propertyName) {
  const prop = page.properties[propertyName];
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return prop.title?.[0]?.plain_text || '';
    case 'rich_text':
      return prop.rich_text?.[0]?.plain_text || '';
    case 'select':
      return prop.select?.name || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'url':
      return prop.url || '';
    default:
      return null;
  }
}

async function fetchAllPages() {
  console.log('🔍 Notion 데이터베이스 조회 중...\n');

  const pages = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });

    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  console.log(`✅ 총 ${pages.length}개 데이터 가져옴\n`);
  return pages;
}

async function main() {
  try {
    const pages = await fetchAllPages();

    // 데이터 변환
    const contacts = pages.map(page => ({
      자치구: getPropertyValue(page, '자치구'),
      공단명칭: getPropertyValue(page, '공단 명칭'),
      공단유형: getPropertyValue(page, '공단 유형'),
      대표전화번호: getPropertyValue(page, '대표 전화번호'),
      세부연락처: getPropertyValue(page, '세부 연락처'),
      주차담당부서: getPropertyValue(page, '주차 담당 부서'),
      홈페이지: getPropertyValue(page, '홈페이지'),
      텍스트: getPropertyValue(page, '텍스트'),
    }));

    // JSON 저장
    const outputPath = path.join(__dirname, '..', 'data', 'seoul-parking-contacts.json');
    fs.writeFileSync(outputPath, JSON.stringify(contacts, null, 2), 'utf-8');

    console.log(`💾 저장 완료: ${outputPath}\n`);
    console.log('📊 데이터 미리보기:');
    console.log(JSON.stringify(contacts.slice(0, 3), null, 2));
    console.log(`\n... 외 ${contacts.length - 3}개`);

  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    process.exit(1);
  }
}

main();
