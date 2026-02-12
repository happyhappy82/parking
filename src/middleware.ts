import { defineMiddleware } from 'astro:middleware';
import { verifyToken } from './utils/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // /admin/login은 인증 불필요
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    return next();
  }

  // /api/auth/ 경로는 인증 불필요
  if (pathname.startsWith('/api/auth/')) {
    return next();
  }

  // /admin 경로만 보호
  if (pathname.startsWith('/admin')) {
    const token = context.cookies.get('admin_token')?.value;

    if (!token || !(await verifyToken(token))) {
      return context.redirect('/admin/login/');
    }
  }

  return next();
});
