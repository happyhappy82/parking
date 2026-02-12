export const prerender = false;

import type { APIRoute } from 'astro';
import { verifyPassword, createToken } from '../../../utils/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !verifyPassword(password)) {
      return new Response(
        JSON.stringify({ error: '비밀번호가 올바르지 않습니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = await createToken();

    cookies.set('admin_token', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
