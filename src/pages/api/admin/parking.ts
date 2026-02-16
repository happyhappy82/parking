export const prerender = false;

import type { APIRoute } from 'astro';
import { getFile, saveFile } from '../../../utils/github';
import { getEditorial, getEditorialsByDistrict, upsertEditorial } from '../../../utils/notion-editorial';

const PARKING_PATH = 'data/공단주소';

// GET: 구별 JSON 데이터 조회 + 에디토리얼 조회
export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get('action');
  const district = url.searchParams.get('district');

  if (action === 'editorial') {
    if (!district) {
      return json({ error: '구 이름이 필요합니다.' }, 400);
    }
    try {
      const name = url.searchParams.get('name');
      if (name) {
        const editorial = await getEditorial(name, district);
        return json({ editorial });
      } else {
        const editorials = await getEditorialsByDistrict(district);
        return json({ editorials });
      }
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  if (!district) {
    return json({ error: '구 이름이 필요합니다.' }, 400);
  }

  try {
    const filePath = `${PARKING_PATH}/${district}.json`;
    const { content, sha } = await getFile(filePath);

    return json({ content, sha, district });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// POST: 에디토리얼 저장 (노션)
export const POST: APIRoute = async ({ request }) => {
  try {
    const { parkingName, district, category, editorOpinion } = await request.json();

    if (!parkingName || !district) {
      return json({ error: '주차장명과 자치구가 필요합니다.' }, 400);
    }

    await upsertEditorial({ parkingName, district, category: category || '', editorOpinion: editorOpinion || '' });
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// PUT: 구별 JSON 데이터 수정 (기존 유지)
export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { district, content, sha } = data;

    if (!district || !content) {
      return json({ error: '구 이름과 데이터가 필요합니다.' }, 400);
    }

    // JSON 유효성 검사
    try {
      JSON.parse(content);
    } catch {
      return json({ error: 'JSON 형식이 올바르지 않습니다.' }, 400);
    }

    const filePath = `${PARKING_PATH}/${district}.json`;
    await saveFile(
      filePath,
      content,
      `data: ${district} 공단주소 에디토리얼 수정`,
      sha
    );

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
