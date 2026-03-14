#!/usr/bin/env node
/**
 * 노션 에디토리얼 DB에 전체 주차장 데이터를 채워넣는 스크립트
 * 공단주소 데이터만 사용 (공공데이터는 더 이상 사용하지 않음)
 */

import { Client } from '@notionhq/client';
import fs from 'node:fs';
import path from 'node:path';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_EDITORIAL_DB_ID || '30a753ebc01381cd950de995f4bdc0bf';

const notion = new Client({ auth: NOTION_TOKEN });

const DISTRICTS = [
  '강남구','강동구','강북구','강서구','관악구','광진구','구로구','금천구',
  '노원구','도봉구','동대문구','동작구','마포구','서대문구','서초구','성동구',
  '성북구','송파구','양천구','영등포구','용산구','은평구','종로구','중구','중랑구'
];

// ─── 1. 공단주소 데이터 로드 ───
function loadGongdanData() {
  const items = [];

  for (const gu of DISTRICTS) {
    const filePath = path.join('data', '공단주소', `${gu}.json`);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const [categoryKey, category] of [['노상주차장', '노상'], ['노외주차장', '노외'], ['부설주차장', '부설']]) {
      const section = data[categoryKey];
      if (!section) continue;

      const lots = section['주차장목록'] || [];
      const fees = section['요금정보'] || [];

      const feeMap = new Map();
      for (const fee of fees) {
        if (fee['주차장명']) feeMap.set(fee['주차장명'], fee);
      }

      for (const lot of lots) {
        const name = lot['주차장명'];
        const normalizedName = name.replace(/\(.*\)/, '').trim();
        const feeData = feeMap.get(name) || feeMap.get(normalizedName);

        let feeText = '';
        if (feeData) {
          const parts = [];
          if (categoryKey === '노상주차장') {
            if (feeData['시간제요금'] && feeData['시간제요금'] !== '-') parts.push(`시간제: ${feeData['시간제요금']}`);
            if (feeData['월정기권'] && feeData['월정기권'] !== '-') parts.push(`월정기권: ${feeData['월정기권']}`);
            if (feeData['비고']) parts.push(feeData['비고']);
          } else {
            if (feeData['시간제']) parts.push(`시간제: ${feeData['시간제']}`);
            if (feeData['주간월정기권'] && feeData['주간월정기권'] !== '-') parts.push(`주간: ${feeData['주간월정기권']}`);
            if (feeData['야간월정기권'] && feeData['야간월정기권'] !== '-') parts.push(`야간: ${feeData['야간월정기권']}`);
            if (feeData['전일월정기권'] && feeData['전일월정기권'] !== '-') parts.push(`전일: ${feeData['전일월정기권']}`);
            if (feeData['비고']) parts.push(feeData['비고']);
          }
          feeText = parts.join(' / ');
        }

        items.push({
          주차장명: name,
          자치구: gu,
          분류: category,
          소재지: lot['소재지'] || '',
          면적: lot['면적'] || '',
          구획수: lot['구획수'] || '',
          급지: lot['급지'] || '',
          인수일: lot['인수일'] || '',
          운영시간: feeData?.['운영시간'] || '',
          요금정보_공단: feeText,
          공단명칭: data['공단명칭'] || '',
          전화번호: data['대표전화번호'] || '',
        });
      }
    }
  }

  console.log(`공단주소 데이터: ${items.length}개 로드됨`);
  return items;
}

// ─── 2. 기존 데이터 조회 (중복 방지) ───
async function getExistingPages() {
  const existing = new Map();
  let cursor = undefined;

  do {
    const res = await notion.databases.query({
      database_id: DB_ID,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of res.results) {
      const name = page.properties['주차장명']?.title?.[0]?.plain_text || '';
      const district = page.properties['자치구']?.select?.name || '';
      const category = page.properties['분류']?.select?.name || '';
      if (name && district) {
        existing.set(`${category}_${district}_${name}`, page.id);
      }
    }

    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(`기존 노션 페이지: ${existing.size}개`);
  return existing;
}

// ─── 3. 노션에 페이지 생성/업데이트 ───
function makeRichText(text) {
  if (!text) return [];
  const str = String(text).slice(0, 2000);
  return [{ text: { content: str } }];
}

function buildProperties(item) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    '주차장명': { title: [{ text: { content: item.주차장명 } }] },
    '자치구': { select: { name: item.자치구 } },
    '분류': { select: { name: item.분류 } },
    '소재지': { rich_text: makeRichText(item.소재지) },
    '면적': { rich_text: makeRichText(item.면적) },
    '구획수': { rich_text: makeRichText(item.구획수) },
    '급지': { rich_text: makeRichText(item.급지) },
    '인수일': { rich_text: makeRichText(item.인수일) },
    '운영시간': { rich_text: makeRichText(item.운영시간) },
    '요금정보_공단': { rich_text: makeRichText(item.요금정보_공단) },
    '공단명칭': { rich_text: makeRichText(item.공단명칭) },
    '전화번호': { rich_text: makeRichText(item.전화번호) },
    '데이터소스': { select: { name: '공단전용' } },
    '수정일': { date: { start: today } },
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadToNotion(items, existingPages) {
  let created = 0;
  let updated = 0;
  let errors = 0;

  console.log(`\n총 ${items.length}개 주차장 업로드 시작...\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = `${item.분류}_${item.자치구}_${item.주차장명}`;
    const props = buildProperties(item);

    try {
      const existingId = existingPages.get(key);

      if (existingId) {
        const { '주차장명': _title, ...updateProps } = props;
        await notion.pages.update({
          page_id: existingId,
          properties: updateProps,
        });
        updated++;
      } else {
        props['에디토리얼상태'] = { select: { name: '미작성' } };
        await notion.pages.create({
          parent: { database_id: DB_ID },
          properties: props,
        });
        created++;
      }

      if ((i + 1) % 50 === 0 || i === items.length - 1) {
        console.log(`진행: ${i + 1}/${items.length} (생성: ${created}, 업데이트: ${updated}, 에러: ${errors})`);
      }
    } catch (err) {
      errors++;
      console.error(`[에러] ${item.자치구} ${item.분류} ${item.주차장명}: ${err.message}`);
    }

    await sleep(350);
  }

  console.log(`\n=== 완료 ===`);
  console.log(`생성: ${created}개`);
  console.log(`업데이트: ${updated}개`);
  console.log(`에러: ${errors}개`);
}

// ─── 메인 실행 ───
async function main() {
  console.log('=== 노션 에디토리얼 DB 데이터 채우기 (공단전용) ===\n');

  const items = loadGongdanData();
  const existingPages = await getExistingPages();
  await uploadToNotion(items, existingPages);
}

main().catch(console.error);
