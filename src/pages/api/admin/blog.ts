export const prerender = false;

import type { APIRoute } from 'astro';
import { getFile, saveFile, deleteFile, listFiles } from '../../../utils/github';

const BLOG_PATH = 'src/content/blog';
const LEGACY_PATH = 'src/pages/blog';

// 기존 하드코딩 블로그 목록
const LEGACY_POSTS = [
  { slug: 'resident-priority-parking-guide', title: '거주자 우선주차 신청방법 — 자격부터 배정까지 완벽 가이드', description: '거주자 우선주차제 신청 자격, 필요 서류, 온라인 신청 방법, 배정 기준, 요금까지 한 번에 정리했습니다.', date: '2026-02-12', source: 'legacy', category: '블로그' },
  { slug: 'seoul-public-parking-guide-2026', title: '2026 서울 공영주차장 완벽 가이드 (요금, 위치, 꿀팁 총정리)', description: '서울시 공영주차장 요금, 위치, 무료주차장 찾는 법까지 총정리했습니다.', date: '2026-02-12', source: 'legacy', category: '블로그' },
  { slug: 'seoul-most-searched-parking-top30', title: '서울 가장 많이 검색된 주차장 TOP 30', description: '서울시 공영주차장 중 주차 면수가 가장 많은 대형 주차장 30곳을 한눈에 정리했습니다.', date: '2026-02-12', source: 'legacy', category: '블로그' },
  { slug: 'gangdong-holiday-parking-tips', title: '강동구 명절·연휴 주차 꿀팁 총정리', description: '설날, 추석, 연휴 기간 강동구에서 주차하기 좋은 공영주차장과 꿀팁을 정리했습니다.', date: '2026-02-12', source: 'legacy', category: '블로그' },
  { slug: 'seoul-free-parking-tips', title: '서울 무료주차장 이용 꿀팁 5가지', description: '서울에서 무료로 주차할 수 있는 곳과 알아두면 유용한 주차 꿀팁을 정리했습니다.', date: '2026-02-12', source: 'legacy', category: '블로그' },
];

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {} as Record<string, string>, body: content };

  const meta: Record<string, string> = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      meta[key] = val;
    }
  });

  return { meta, body: match[2] };
}

function buildMarkdown(data: {
  title: string;
  description: string;
  date: string;
  content: string;
  category?: string;
  notionPageId?: string;
  breadcrumbName?: string;
}) {
  const lines = [
    '---',
    `title: "${data.title}"`,
    `description: "${data.description}"`,
    `date: "${data.date}"`,
    `category: "${data.category || '블로그'}"`,
  ];

  if (data.notionPageId) {
    lines.push(`notionPageId: "${data.notionPageId}"`);
  }

  if (data.breadcrumbName) {
    lines.push(`breadcrumbName: "${data.breadcrumbName}"`);
  }

  lines.push('---', '', data.content);

  return lines.join('\n');
}

// GET: 목록 or 개별 조회
export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const type = url.searchParams.get('type');

  try {
    if (slug) {
      // 레거시 (.astro) 개별 조회
      if (type === 'legacy') {
        const { content } = await getFile(`${LEGACY_PATH}/${slug}.astro`);
        return json({ slug, content });
      }

      // 마크다운 개별 조회
      const { content } = await getFile(`${BLOG_PATH}/${slug}.md`);
      const { meta, body } = parseFrontmatter(content);
      return json({
        slug,
        title: meta.title || '',
        description: meta.description || '',
        date: meta.date || '',
        category: meta.category || '블로그',
        notionPageId: meta.notionPageId || '',
        breadcrumbName: meta.breadcrumbName || '',
        content: body.trim(),
      });
    }

    // 목록 조회
    const mdPosts: any[] = [];

    try {
      const files = await listFiles(BLOG_PATH);
      for (const file of files) {
        if (!file.name.endsWith('.md')) continue;
        const fileSlug = file.name.replace('.md', '');
        try {
          const { content } = await getFile(file.path);
          const { meta } = parseFrontmatter(content);
          mdPosts.push({
            slug: fileSlug,
            title: meta.title || fileSlug,
            description: meta.description || '',
            date: meta.date || '',
            category: meta.category || '블로그',
            source: 'md',
          });
        } catch {
          mdPosts.push({ slug: fileSlug, title: fileSlug, description: '', date: '', category: '블로그', source: 'md' });
        }
      }
    } catch {
      // GitHub API 실패해도 레거시 글은 보여줌
    }

    const allPosts = [...LEGACY_POSTS, ...mdPosts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return json({ posts: allPosts });
  } catch (e: any) {
    // 최후의 fallback: 레거시 글이라도 보여줌
    return json({ posts: LEGACY_POSTS });
  }
};

// POST: 새 글 생성
export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { slug, title, description, date, content, category, breadcrumbName } = data;

    if (!slug || !title || !content) {
      return json({ error: '필수 항목이 누락되었습니다.' }, 400);
    }

    const markdown = buildMarkdown({ title, description, date, content, category, breadcrumbName });
    await saveFile(
      `${BLOG_PATH}/${slug}.md`,
      markdown,
      `blog: ${title} 글 추가`
    );

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// PUT: 글 수정
export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { slug, type, title, description, date, content, category, notionPageId, breadcrumbName } = data;

    if (!slug) return json({ error: '슬러그가 필요합니다.' }, 400);

    // 레거시 (.astro) 수정
    if (type === 'legacy') {
      const filePath = `${LEGACY_PATH}/${slug}.astro`;
      const existing = await getFile(filePath);
      await saveFile(filePath, content, `blog: ${slug}.astro 수정`, existing.sha);
      return json({ success: true });
    }

    // 마크다운 수정
    const filePath = `${BLOG_PATH}/${slug}.md`;
    const existing = await getFile(filePath);
    const markdown = buildMarkdown({ title, description, date, content, category, notionPageId, breadcrumbName });

    await saveFile(filePath, markdown, `blog: ${title} 글 수정`, existing.sha);

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
};

// DELETE: 글 삭제
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { slug } = data;

    if (!slug) return json({ error: '슬러그가 필요합니다.' }, 400);

    const filePath = `${BLOG_PATH}/${slug}.md`;
    const existing = await getFile(filePath);
    await deleteFile(filePath, existing.sha, `blog: ${slug} 글 삭제`);

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
