export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  try {
    const posts = await getCollection('blog');
    // 기존 하드코딩 글 5개 + Content Collections 글
    const blogCount = 5 + posts.length;

    // 주차장 개수는 25개 구가 아닌 실제 주차장 개수로 표시
    // (대시보드에서는 단순히 구 개수 표시로 유지)
    return new Response(
      JSON.stringify({ blogCount, parkingDistricts: 25 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ blogCount: 5, parkingDistricts: 25 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
