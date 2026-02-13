export const prerender = false;

import type { APIRoute } from 'astro';
import { getFile, saveFile, saveBinaryFile, deleteFile, listFiles } from '../../../utils/github';

const PARKING_DATA_PATH = 'public/data/parking/서울특별시';
const IMAGES_BASE_PATH = 'public/images/parking';

// GET: 주차장 이미지 목록
export const GET: APIRoute = async ({ url }) => {
  const district = url.searchParams.get('district');
  const slug = url.searchParams.get('slug');

  if (!district || !slug) {
    return json({ error: '구 이름과 슬러그가 필요합니다.' }, 400);
  }

  try {
    const dirPath = `${IMAGES_BASE_PATH}/${district}/${slug}`;
    const files = await listFiles(dirPath);
    const images = files
      .filter(f => f.type === 'file' && /\.(webp|jpg|jpeg|png)$/i.test(f.name))
      .map(f => ({
        name: f.name,
        path: f.path,
        sha: f.sha,
        url: `/images/parking/${district}/${slug}/${f.name}`,
      }));

    return json({ images });
  } catch {
    return json({ images: [] });
  }
};

// POST: 이미지 업로드 (base64 WebP)
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { district, slug, fileName, base64Data, originalIndex } = data;

    if (!district || !slug || !fileName || !base64Data) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, 400);
    }

    // 1. 이미지를 GitHub에 저장
    const imagePath = `${IMAGES_BASE_PATH}/${district}/${slug}/${fileName}`;
    await saveBinaryFile(
      imagePath,
      base64Data,
      `img: ${district} ${slug} 사진 추가 (${fileName})`
    );

    // 2. 주차장 JSON에 images 배열 업데이트
    if (originalIndex !== undefined) {
      await updateParkingImages(district, originalIndex, slug);
    }

    return json({
      success: true,
      url: `/images/parking/${district}/${slug}/${fileName}`,
    });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// DELETE: 이미지 삭제
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { district, slug, fileName, sha, originalIndex } = data;

    if (!district || !slug || !fileName || !sha) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, 400);
    }

    // 1. GitHub에서 이미지 삭제
    const imagePath = `${IMAGES_BASE_PATH}/${district}/${slug}/${fileName}`;
    await deleteFile(imagePath, sha, `img: ${district} ${slug} 사진 삭제 (${fileName})`);

    // 2. 주차장 JSON에 images 배열 업데이트
    if (originalIndex !== undefined) {
      await updateParkingImages(district, originalIndex, slug);
    }

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// 주차장 JSON의 images 배열을 GitHub 실제 파일 목록으로 동기화
async function updateParkingImages(district: string, originalIndex: number, slug: string) {
  try {
    // 현재 이미지 목록 조회
    const dirPath = `${IMAGES_BASE_PATH}/${district}/${slug}`;
    let imageFiles: string[] = [];
    try {
      const files = await listFiles(dirPath);
      imageFiles = files
        .filter(f => f.type === 'file' && /\.(webp|jpg|jpeg|png)$/i.test(f.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(f => `/images/parking/${district}/${slug}/${f.name}`);
    } catch {
      // 디렉토리가 없으면 빈 배열
    }

    // 주차장 JSON 업데이트
    const filePath = `${PARKING_DATA_PATH}/${district}.json`;
    const { content, sha } = await getFile(filePath);
    const districtData = JSON.parse(content);

    if (districtData.items && districtData.items[originalIndex]) {
      districtData.items[originalIndex].images = imageFiles;
      await saveFile(
        filePath,
        JSON.stringify(districtData, null, 2),
        `data: ${district} ${slug} 이미지 목록 업데이트`,
        sha
      );
    }
  } catch (e) {
    console.error('이미지 목록 업데이트 실패:', e);
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
