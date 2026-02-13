/**
 * Notion → Blog/Parking 동기화 스크립트
 *
 * Notion DB에서 컨텐츠를 가져와 src/content/blog/*.md 로 동기화한다.
 * 카테고리: 블로그 / 주차장
 *
 * 환경변수:
 *   NOTION_API_KEY       - Notion Integration 토큰
 *   NOTION_DATABASE_ID   - Notion DB ID
 *   TRIGGER_TYPE         - 트리거 종류 (schedule | repository_dispatch | workflow_dispatch)
 *   SYNC_ACTION          - 웹훅 액션 (create | update | delete)
 *   SYNC_PAGE_ID         - 웹훅으로 전달된 특정 페이지 ID
 */

const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── 설정 ──
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
const IMAGE_DIR = path.join(__dirname, '..', 'public', 'notion-images');
const PAGE_MAP_FILE = path.join(__dirname, '..', '.notion-page-map.json');
const SLUG_FILE = path.join(__dirname, '..', '.published-slug');

// ── 유틸 ──
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function richTextToPlain(richTextArray) {
  if (!richTextArray || !richTextArray.length) return '';
  return richTextArray.map((t) => t.plain_text).join('');
}

function getPropertyValue(page, name) {
  const prop = page.properties[name];
  if (!prop) return '';

  switch (prop.type) {
    case 'title':
      return richTextToPlain(prop.title);
    case 'rich_text':
      return richTextToPlain(prop.rich_text);
    case 'select':
      return prop.select ? prop.select.name : '';
    case 'date':
      return prop.date ? prop.date.start : '';
    default:
      return '';
  }
}

// page_id ↔ slug 매핑 로드/저장
function loadPageMap() {
  if (fs.existsSync(PAGE_MAP_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PAGE_MAP_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

function savePageMap(map) {
  fs.writeFileSync(PAGE_MAP_FILE, JSON.stringify(map, null, 2), 'utf-8');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    protocol
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function sanitizeFilename(url) {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  let filename = pathParts[pathParts.length - 1] || 'image';
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const hash = Buffer.from(url).toString('base64url').slice(0, 8);
  const ext = path.extname(filename) || '.png';
  const base = path.basename(filename, ext);
  return `${base}-${hash}${ext}`;
}

// ── 메인 로직 ──

/** DB에서 Published 페이지 전체 조회 */
async function getPublishedPages() {
  const pages = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Status',
        select: { equals: 'Published' },
      },
      start_cursor: cursor,
    });

    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}

/** 특정 페이지 조회 */
async function getPageById(pageId) {
  return notion.pages.retrieve({ page_id: pageId });
}

/** Notion 페이지 → Markdown 변환 (심플 파싱) */
async function pageToMarkdown(page, pageMap) {
  const pageId = page.id;
  const title = getPropertyValue(page, 'Title');
  const category = getPropertyValue(page, 'Category') || '블로그';
  const description = getPropertyValue(page, 'Description');
  const date = getPropertyValue(page, 'Date');
  const breadcrumbName = getPropertyValue(page, 'BreadcrumbName');

  // 기존 매핑에 slug가 있으면 그대로 사용 (중복 방지)
  let slug = pageMap[pageId] || getPropertyValue(page, 'Slug');

  if (!slug) {
    console.warn(`  [SKIP] "${title}" — Slug 없음`);
    return null;
  }

  if (!date) {
    console.warn(`  [SKIP] "${title}" — Date 없음`);
    return null;
  }

  // Notion 본문 → 마크다운 (notion-to-md 그대로 사용)
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  let mdContent = n2m.toMarkdownString(mdBlocks).parent || '';

  // 이미지 다운로드 & 경로 치환
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  const imagePromises = [];

  while ((match = imageRegex.exec(mdContent)) !== null) {
    const [fullMatch, alt, imageUrl] = match;
    const filename = sanitizeFilename(imageUrl);
    const localPath = path.join(IMAGE_DIR, slug, filename);
    const publicPath = `/notion-images/${slug}/${filename}`;

    imagePromises.push(
      (async () => {
        try {
          ensureDir(path.join(IMAGE_DIR, slug));
          await downloadFile(imageUrl, localPath);
          console.log(`    [IMG] ${filename}`);
          return { fullMatch, replacement: `![${alt}](${publicPath})` };
        } catch (err) {
          console.warn(`    [IMG FAIL] ${filename}: ${err.message}`);
          return null;
        }
      })()
    );
  }

  const imageResults = await Promise.all(imagePromises);
  for (const result of imageResults) {
    if (result) {
      mdContent = mdContent.replace(result.fullMatch, result.replacement);
    }
  }

  // Frontmatter 생성
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `category: "${category}"`,
    `notionPageId: "${pageId}"`,
  ];

  if (breadcrumbName) {
    frontmatter.push(`breadcrumbName: "${breadcrumbName.replace(/"/g, '\\"')}"`);
  }

  frontmatter.push('---');

  return {
    slug,
    pageId,
    content: frontmatter.join('\n') + '\n\n' + mdContent.trim() + '\n',
  };
}

/** 전체 동기화 (예약 발행 / 수동 실행) */
async function syncAll() {
  console.log('=== Full Sync: Notion → Blog ===\n');

  const pages = await getPublishedPages();
  console.log(`Published pages: ${pages.length}\n`);

  ensureDir(BLOG_DIR);

  // 기존 파일 목록 (삭제 감지용)
  const existingFiles = new Set(
    fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
  );

  // page_id 매핑 로드
  const pageMap = loadPageMap();

  const syncedSlugs = new Set();
  const newSlugs = [];

  for (const page of pages) {
    const title = getPropertyValue(page, 'Title');
    console.log(`Processing: "${title}"`);

    const result = await pageToMarkdown(page, pageMap);
    if (!result) continue;

    const filePath = path.join(BLOG_DIR, `${result.slug}.md`);
    const isNew = !existingFiles.has(result.slug);

    // 기존 파일과 비교해서 변경된 경우만 쓰기
    let shouldWrite = true;
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      if (existing === result.content) {
        console.log(`  [SKIP] 변경 없음`);
        shouldWrite = false;
      }
    }

    if (shouldWrite) {
      fs.writeFileSync(filePath, result.content, 'utf-8');
      console.log(`  [${isNew ? 'NEW' : 'UPDATE'}] ${result.slug}.md`);
    }

    if (isNew) {
      newSlugs.push(result.slug);
    }

    // 매핑 업데이트
    pageMap[result.pageId] = result.slug;
    syncedSlugs.add(result.slug);
  }

  // Notion에서 삭제/비공개된 글 제거 (매핑 기반)
  for (const slug of existingFiles) {
    if (!syncedSlugs.has(slug)) {
      // 매핑에 있는 slug만 삭제 (어드민에서 직접 만든 파일은 건드리지 않음)
      const isNotionManaged = Object.values(pageMap).includes(slug);
      if (isNotionManaged) {
        const filePath = path.join(BLOG_DIR, `${slug}.md`);
        fs.unlinkSync(filePath);
        console.log(`  [DELETE] ${slug}.md`);

        // 이미지 폴더도 삭제
        const imgDir = path.join(IMAGE_DIR, slug);
        if (fs.existsSync(imgDir)) {
          fs.rmSync(imgDir, { recursive: true });
          console.log(`  [DELETE] images for ${slug}`);
        }

        // 매핑에서도 제거
        for (const [pid, s] of Object.entries(pageMap)) {
          if (s === slug) delete pageMap[pid];
        }
      }
    }
  }

  // 매핑 저장
  savePageMap(pageMap);

  // 새로 발행된 slug 기록
  if (newSlugs.length > 0) {
    fs.writeFileSync(SLUG_FILE, newSlugs[newSlugs.length - 1], 'utf-8');
    console.log(`\nNewly published: ${newSlugs.join(', ')}`);
  } else if (fs.existsSync(SLUG_FILE)) {
    fs.unlinkSync(SLUG_FILE);
  }

  console.log('\n=== Sync complete ===');
}

/** 단일 페이지 동기화 (웹훅 발행) */
async function syncSinglePage(pageId, action) {
  console.log(`=== Webhook Sync: ${action} (${pageId}) ===\n`);

  ensureDir(BLOG_DIR);

  const pageMap = loadPageMap();

  if (action === 'delete') {
    const slug = pageMap[pageId];
    if (slug) {
      const filePath = path.join(BLOG_DIR, `${slug}.md`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[DELETE] ${slug}.md`);
      }

      const imgDir = path.join(IMAGE_DIR, slug);
      if (fs.existsSync(imgDir)) {
        fs.rmSync(imgDir, { recursive: true });
        console.log(`[DELETE] images for ${slug}`);
      }

      delete pageMap[pageId];
      savePageMap(pageMap);
    } else {
      console.log('Page ID not found in mapping — running full sync');
      return syncAll();
    }
    console.log('\n=== Webhook sync complete ===');
    return;
  }

  const page = await getPageById(pageId);
  const status = getPropertyValue(page, 'Status');

  // Deleted 상태면 삭제 처리
  if (status === 'Deleted') {
    console.log(`Status is "Deleted" — removing content`);
    const slug = pageMap[pageId];
    if (slug) {
      const filePath = path.join(BLOG_DIR, `${slug}.md`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[DELETE] ${slug}.md`);
      }

      const imgDir = path.join(IMAGE_DIR, slug);
      if (fs.existsSync(imgDir)) {
        fs.rmSync(imgDir, { recursive: true });
        console.log(`[DELETE] images for ${slug}`);
      }

      delete pageMap[pageId];
      savePageMap(pageMap);
    }
    console.log('\n=== Webhook sync complete ===');
    return;
  }

  if (status !== 'Published') {
    console.log(`Status is "${status}", not Published — skipping`);
    console.log('\n=== Webhook sync complete ===');
    return;
  }

  const title = getPropertyValue(page, 'Title');
  console.log(`Processing: "${title}"`);

  const result = await pageToMarkdown(page, pageMap);
  if (!result) {
    console.log('Could not convert page — skipping');
    return;
  }

  const filePath = path.join(BLOG_DIR, `${result.slug}.md`);
  const isNew = !fs.existsSync(filePath);

  fs.writeFileSync(filePath, result.content, 'utf-8');
  console.log(`[${isNew ? 'NEW' : 'UPDATE'}] ${result.slug}.md`);

  // 매핑 업데이트
  pageMap[result.pageId] = result.slug;
  savePageMap(pageMap);

  if (isNew) {
    fs.writeFileSync(SLUG_FILE, result.slug, 'utf-8');
    console.log(`Newly published: ${result.slug}`);
  } else if (fs.existsSync(SLUG_FILE)) {
    fs.unlinkSync(SLUG_FILE);
  }

  console.log('\n=== Webhook sync complete ===');
}

// ── 실행 ──
async function main() {
  if (!process.env.NOTION_API_KEY) {
    console.error('NOTION_API_KEY is required');
    process.exit(1);
  }
  if (!DATABASE_ID) {
    console.error('NOTION_DATABASE_ID is required');
    process.exit(1);
  }

  const triggerType = process.env.TRIGGER_TYPE || 'manual';
  const syncAction = process.env.SYNC_ACTION;
  const syncPageId = process.env.SYNC_PAGE_ID;

  console.log(`Trigger: ${triggerType}`);
  console.log(`Action: ${syncAction || 'full'}`);
  console.log(`Page ID: ${syncPageId || 'all'}`);
  console.log('');

  if (triggerType === 'repository_dispatch' && syncPageId && syncAction) {
    await syncSinglePage(syncPageId, syncAction);
  } else {
    await syncAll();
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
