export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async () => {
  const hookUrl = import.meta.env.VERCEL_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    return new Response(
      JSON.stringify({ error: 'VERCEL_DEPLOY_HOOK_URL 환경변수가 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });

    if (!res.ok) {
      throw new Error(`Vercel 응답: ${res.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: '배포가 시작되었습니다.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
