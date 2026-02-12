export const prerender = false;

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  try {
    const posts = await getCollection('blog');
    // 기존 하드코딩 글 5개 + Content Collections 글
    const blogCount = 5 + posts.length;

    return new Response(
      JSON.stringify({ blogCount, parkingCount: 25 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ blogCount: 5, parkingCount: 25 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
