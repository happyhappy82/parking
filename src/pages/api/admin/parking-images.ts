export const prerender = false;

import type { APIRoute } from 'astro';
import { getFile, saveFile, saveBinaryFile, deleteFile, listFiles, deleteMultipleFiles, saveMultipleBinaryFiles } from '../../../utils/github';

const PARKING_DATA_PATH = 'public/data/parking/서울특별시';
const IMAGES_BASE_PATH = 'public/images/parking';
const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
const GITHUB_REPO = import.meta.env.GITHUB_REPO;
const GITHUB_BRANCH = import.meta.env.GITHUB_BRANCH || 'main';

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
        url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/public/images/parking/${district}/${slug}/${f.name}?v=${f.sha}`,
      }));

    return json({ images });
  } catch {
    return json({ images: [] });
  }
};

// POST: 이미지 일괄 업로드 (한 커밋)
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { district, slug, files: uploadFiles, originalIndex } = data;

    if (!district || !slug || !uploadFiles || !Array.isArray(uploadFiles) || uploadFiles.length === 0) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, 400);
    }

    const filesToSave = uploadFiles.map((f: { fileName: string; base64Data: string }) => ({
      path: `${IMAGES_BASE_PATH}/${district}/${slug}/${f.fileName}`,
      base64Content: f.base64Data,
    }));

    const fileNames = uploadFiles.map((f: { fileName: string }) => f.fileName);
    await saveMultipleBinaryFiles(
      filesToSave,
      `img: ${district} ${slug} 사진 추가 (${fileNames.join(', ')})`
    );

    // 주차장 JSON에 images 배열 업데이트
    if (originalIndex !== undefined) {
      await updateParkingImages(district, originalIndex, slug);
    }

    return json({ success: true, count: uploadFiles.length });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// DELETE: 이미지 일괄 삭제 (한 커밋)
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { district, slug, files: deleteFiles, originalIndex } = data;

    if (!district || !slug || !deleteFiles || !Array.isArray(deleteFiles) || deleteFiles.length === 0) {
      return json({ error: '필수 파라미터가 누락되었습니다.' }, 400);
    }

    const pathsToDelete = deleteFiles.map((f: { fileName: string; sha: string }) => ({
      path: `${IMAGES_BASE_PATH}/${district}/${slug}/${f.fileName}`,
      sha: f.sha,
    }));

    const fileNames = deleteFiles.map((f: { fileName: string }) => f.fileName);
    await deleteMultipleFiles(
      pathsToDelete,
      `img: ${district} ${slug} 사진 삭제 (${fileNames.join(', ')})`
    );

    // 주차장 JSON에 images 배열 업데이트
    if (originalIndex !== undefined) {
      await updateParkingImages(district, originalIndex, slug);
    }

    return json({ success: true, count: deleteFiles.length });
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
