import { Client } from '@notionhq/client';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN || process.env.NOTION_TOKEN });
const DB_ID = import.meta.env.NOTION_EDITORIAL_DB_ID || process.env.NOTION_EDITORIAL_DB_ID;

export interface Editorial {
  pageId: string;
  parkingName: string;
  district: string;
  category: string;
  editorOpinion: string;
  updatedAt: string;
}

function parseEditorialPage(page: any): Editorial {
  const props = page.properties;
  return {
    pageId: page.id,
    parkingName: props['주차장명']?.title?.[0]?.plain_text || '',
    district: props['자치구']?.select?.name || '',
    category: props['분류']?.select?.name || '',
    editorOpinion: props['에디터의견']?.rich_text?.[0]?.plain_text || '',
    updatedAt: props['수정일']?.date?.start || '',
  };
}

// 주차장명+자치구로 기존 레코드 조회
export async function getEditorial(parkingName: string, district: string): Promise<Editorial | null> {
  const res = await notion.databases.query({
    database_id: DB_ID,
    filter: {
      and: [
        { property: '주차장명', title: { equals: parkingName } },
        { property: '자치구', select: { equals: district } },
      ],
    },
    page_size: 1,
  });
  if (res.results.length === 0) return null;
  return parseEditorialPage(res.results[0]);
}

// 자치구 기준으로 에디토리얼 목록 조회 (어드민 테이블용)
export async function getEditorialsByDistrict(district: string): Promise<Editorial[]> {
  const results: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res: any = await notion.databases.query({
      database_id: DB_ID,
      filter: { property: '자치구', select: { equals: district } },
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return results.map(parseEditorialPage);
}

// 전체 에디토리얼 목록 조회 (빌드 시 사용)
export async function getAllEditorials(): Promise<Editorial[]> {
  const results: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const res: any = await notion.databases.query({
      database_id: DB_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    results.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return results.map(parseEditorialPage);
}

// 에디토리얼 upsert (있으면 수정, 없으면 생성)
export async function upsertEditorial(data: {
  parkingName: string;
  district: string;
  category: string;
  editorOpinion: string;
}): Promise<void> {
  const existing = await getEditorial(data.parkingName, data.district);
  const today = new Date().toISOString().slice(0, 10);

  if (existing) {
    await notion.pages.update({
      page_id: existing.pageId,
      properties: {
        '분류': { select: { name: data.category } },
        '에디터의견': { rich_text: [{ text: { content: data.editorOpinion } }] },
        '수정일': { date: { start: today } },
      },
    });
  } else {
    await notion.pages.create({
      parent: { database_id: DB_ID },
      properties: {
        '주차장명': { title: [{ text: { content: data.parkingName } }] },
        '자치구': { select: { name: data.district } },
        '분류': { select: { name: data.category } },
        '에디터의견': { rich_text: [{ text: { content: data.editorOpinion } }] },
        '수정일': { date: { start: today } },
      },
    });
  }
}
