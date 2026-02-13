/**
 * Notion → Blog 동기화 스크립트
 *
 * Notion DB에서 컨텐츠를 가져와 Notion API 블록을 직접 HTML로 변환한다.
 * (텍스트/문자 파싱 없이 Notion 블록 구조를 그대로 HTML로 보존)
 *
 * 모든 Published 페이지 → src/content/blog/*.md
 *
 * 환경변수:
 *   NOTION_API_KEY       - Notion Integration 토큰
 *   NOTION_DATABASE_ID   - Notion DB ID
 *   TRIGGER_TYPE         - 트리거 종류 (schedule | repository_dispatch | workflow_dispatch)
 *   SYNC_ACTION          - 웹훅 액션 (create | update | delete)
 *   SYNC_PAGE_ID         - 웹훅으로 전달된 특정 페이지 ID
 */

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── 설정 ──
const notion = new Client({ auth: process.env.NOTION_API_KEY });
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
    case 'status':
      return prop.status ? prop.status.name : '';
    case 'date':
      return prop.date ? prop.date.start : '';
    default:
      return '';
  }
}

// page_id → slug 매핑 로드/저장
function loadPageMap() {
  if (fs.existsSync(PAGE_MAP_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(PAGE_MAP_FILE, 'utf-8'));
      const migrated = {};
      for (const [key, value] of Object.entries(raw)) {
        if (typeof value === 'string') {
          migrated[key] = value;
        } else if (value && value.slug) {
          migrated[key] = value.slug;
        }
      }
      return migrated;
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

// ── HTML 이스케이프 ──
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Notion 리치 텍스트 → HTML ──
function richTextToHtml(richTextArray) {
  if (!richTextArray || !richTextArray.length) return '';
  return richTextArray.map((rt) => {
    let text = escapeHtml(rt.plain_text);
    // 줄바꿈 → <br>
    text = text.replace(/\n/g, '<br>');

    if (rt.href) {
      text = `<a href="${escapeHtml(rt.href)}">${text}</a>`;
    }

    const ann = rt.annotations;
    if (ann.code) text = `<code>${text}</code>`;
    if (ann.bold) text = `<strong>${text}</strong>`;
    if (ann.italic) text = `<em>${text}</em>`;
    if (ann.strikethrough) text = `<del>${text}</del>`;
    if (ann.underline) text = `<u>${text}</u>`;
    if (ann.color && ann.color !== 'default') {
      const cls = ann.color.includes('_background')
        ? `notion-bg-${ann.color.replace('_background', '')}`
        : `notion-color-${ann.color}`;
      text = `<span class="${cls}">${text}</span>`;
    }

    return text;
  }).join('');
}

// ── Notion 블록 재귀 조회 ──
async function fetchBlockChildren(blockId) {
  const blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  for (const block of blocks) {
    if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      block.children = await fetchBlockChildren(block.id);
    }
  }
  return blocks;
}

// ── YouTube ID 추출 ──
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match ? match[1] : null;
}

// ── 이미지 블록 처리 ──
async function handleImageBlock(block, slug) {
  const imageData = block.image;
  const url = imageData.type === 'external' ? imageData.external.url : imageData.file.url;
  const captionHtml = imageData.caption ? richTextToHtml(imageData.caption) : '';
  const captionPlain = imageData.caption ? richTextToPlain(imageData.caption) : '';

  const filename = sanitizeFilename(url);
  const localPath = path.join(IMAGE_DIR, slug, filename);
  const publicPath = `/notion-images/${slug}/${filename}`;

  try {
    ensureDir(path.join(IMAGE_DIR, slug));
    await downloadFile(url, localPath);
    console.log(`    [IMG] ${filename}`);

    let html = '<figure class="notion-image">';
    html += `<img src="${publicPath}" alt="${escapeHtml(captionPlain)}" loading="lazy">`;
    if (captionHtml) {
      html += `<figcaption>${captionHtml}</figcaption>`;
    }
    html += '</figure>';
    return html;
  } catch (err) {
    console.warn(`    [IMG FAIL] ${filename}: ${err.message}`);
    return `<figure class="notion-image"><img src="${escapeHtml(url)}" alt="${escapeHtml(captionPlain)}" loading="lazy"></figure>`;
  }
}

// ── 단일 블록 → HTML ──
async function renderBlock(block, slug) {
  const type = block.type;
  const data = block[type];
  if (!data) return '';

  switch (type) {
    case 'paragraph': {
      const text = richTextToHtml(data.rich_text);
      let childHtml = '';
      if (block.children) {
        childHtml = await blocksToHtml(block.children, slug);
      }
      if (!text && !childHtml) return '';
      return `<p>${text}</p>${childHtml}`;
    }

    case 'heading_1': {
      const text = richTextToHtml(data.rich_text);
      if (data.is_toggleable && block.children) {
        return `<details class="notion-toggle-heading"><summary><h2>${text}</h2></summary>${await blocksToHtml(block.children, slug)}</details>`;
      }
      return `<h2>${text}</h2>`;
    }

    case 'heading_2': {
      const text = richTextToHtml(data.rich_text);
      if (data.is_toggleable && block.children) {
        return `<details class="notion-toggle-heading"><summary><h3>${text}</h3></summary>${await blocksToHtml(block.children, slug)}</details>`;
      }
      return `<h3>${text}</h3>`;
    }

    case 'heading_3': {
      const text = richTextToHtml(data.rich_text);
      if (data.is_toggleable && block.children) {
        return `<details class="notion-toggle-heading"><summary><h4>${text}</h4></summary>${await blocksToHtml(block.children, slug)}</details>`;
      }
      return `<h4>${text}</h4>`;
    }

    case 'bulleted_list_item':
    case 'numbered_list_item':
      // blocksToHtml에서 그룹핑 처리
      return '';

    case 'to_do': {
      const checked = data.checked ? ' checked' : '';
      const text = richTextToHtml(data.rich_text);
      let childHtml = '';
      if (block.children) {
        childHtml = await blocksToHtml(block.children, slug);
      }
      return `<div class="notion-todo"><label><input type="checkbox"${checked} disabled> ${text}</label>${childHtml}</div>`;
    }

    case 'toggle': {
      const summary = richTextToHtml(data.rich_text);
      let childHtml = '';
      if (block.children) {
        childHtml = await blocksToHtml(block.children, slug);
      }
      return `<details class="notion-toggle"><summary>${summary}</summary><div class="notion-toggle-content">${childHtml}</div></details>`;
    }

    case 'callout': {
      const icon = data.icon
        ? data.icon.type === 'emoji'
          ? data.icon.emoji
          : ''
        : '';
      const text = richTextToHtml(data.rich_text);
      const colorClass = data.color && data.color !== 'default'
        ? ` notion-callout-${data.color}`
        : '';
      let childHtml = '';
      if (block.children) {
        childHtml = await blocksToHtml(block.children, slug);
      }
      return `<div class="notion-callout${colorClass}"><div class="notion-callout-icon">${icon}</div><div class="notion-callout-content">${text}${childHtml}</div></div>`;
    }

    case 'quote': {
      const text = richTextToHtml(data.rich_text);
      let childHtml = '';
      if (block.children) {
        childHtml = await blocksToHtml(block.children, slug);
      }
      return `<blockquote><p>${text}</p>${childHtml}</blockquote>`;
    }

    case 'code': {
      const code = richTextToPlain(data.rich_text);
      const lang = data.language || '';
      const captionHtml = data.caption ? richTextToHtml(data.caption) : '';
      let html = `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
      if (captionHtml) {
        html += `<p class="notion-code-caption">${captionHtml}</p>`;
      }
      return html;
    }

    case 'image':
      return await handleImageBlock(block, slug);

    case 'divider':
      return '<hr>';

    case 'table': {
      const hasColumnHeader = data.has_column_header;
      const hasRowHeader = data.has_row_header;
      let html = '<table>';

      if (block.children) {
        let inBody = false;
        block.children.forEach((row, rowIndex) => {
          if (row.type !== 'table_row') return;
          const cells = row.table_row.cells;
          const isHeaderRow = hasColumnHeader && rowIndex === 0;

          if (isHeaderRow) {
            html += '<thead><tr>';
            cells.forEach((cell) => {
              html += `<th>${richTextToHtml(cell)}</th>`;
            });
            html += '</tr></thead>';
          } else {
            if (!inBody) {
              html += '<tbody>';
              inBody = true;
            }
            html += '<tr>';
            cells.forEach((cell, cellIndex) => {
              const tag = hasRowHeader && cellIndex === 0 ? 'th' : 'td';
              html += `<${tag}>${richTextToHtml(cell)}</${tag}>`;
            });
            html += '</tr>';
          }
        });
        if (inBody) html += '</tbody>';
      }

      html += '</table>';
      return html;
    }

    case 'bookmark': {
      const url = data.url || '';
      const captionHtml = data.caption ? richTextToHtml(data.caption) : '';
      return `<div class="notion-bookmark"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${captionHtml || escapeHtml(url)}</a></div>`;
    }

    case 'link_preview': {
      const url = data.url || '';
      return `<div class="notion-bookmark"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div>`;
    }

    case 'embed': {
      const url = data.url || '';
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `<div class="notion-video"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
      return `<div class="notion-embed"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div>`;
    }

    case 'video': {
      if (data.type === 'external') {
        const url = data.external.url;
        const videoId = extractYouTubeId(url);
        if (videoId) {
          return `<div class="notion-video"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
        }
        return `<div class="notion-video"><video src="${escapeHtml(url)}" controls></video></div>`;
      }
      if (data.type === 'file') {
        return `<div class="notion-video"><video src="${escapeHtml(data.file.url)}" controls></video></div>`;
      }
      return '';
    }

    case 'column_list': {
      if (!block.children) return '';
      const cols = block.children.filter((c) => c.type === 'column');
      let html = `<div class="notion-columns" style="--col-count:${cols.length}">`;
      for (const col of cols) {
        html += '<div class="notion-column">';
        if (col.children) {
          html += await blocksToHtml(col.children, slug);
        }
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    case 'column':
      return '';

    case 'equation': {
      const expr = data.expression || '';
      return `<div class="notion-equation"><code>${escapeHtml(expr)}</code></div>`;
    }

    case 'synced_block': {
      if (block.children) {
        return await blocksToHtml(block.children, slug);
      }
      return '';
    }

    case 'file': {
      const fileUrl = data.type === 'external' ? data.external.url : (data.file ? data.file.url : '');
      const captionHtml = data.caption ? richTextToHtml(data.caption) : '';
      const name = data.name || captionHtml || fileUrl;
      return `<div class="notion-file"><a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">📎 ${name}</a></div>`;
    }

    case 'pdf': {
      const pdfUrl = data.type === 'external' ? data.external.url : (data.file ? data.file.url : '');
      return `<div class="notion-file"><a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener noreferrer">📄 PDF 파일 보기</a></div>`;
    }

    case 'audio': {
      const audioUrl = data.type === 'external' ? data.external.url : (data.file ? data.file.url : '');
      return `<div class="notion-audio"><audio src="${escapeHtml(audioUrl)}" controls></audio></div>`;
    }

    case 'child_page':
    case 'child_database':
    case 'table_of_contents':
    case 'breadcrumb':
    case 'link_to_page':
    case 'unsupported':
      return '';

    default:
      console.warn(`    [BLOCK] 미지원 블록 타입: ${type}`);
      return '';
  }
}

// ── 블록 배열 → HTML (리스트 그룹핑 포함) ──
async function blocksToHtml(blocks, slug) {
  const parts = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // 연속 bulleted_list_item → <ul>
    if (block.type === 'bulleted_list_item') {
      let listHtml = '<ul>';
      while (i < blocks.length && blocks[i].type === 'bulleted_list_item') {
        const item = blocks[i];
        const text = richTextToHtml(item.bulleted_list_item.rich_text);
        let childHtml = '';
        if (item.children) {
          childHtml = await blocksToHtml(item.children, slug);
        }
        listHtml += `<li>${text}${childHtml}</li>`;
        i++;
      }
      listHtml += '</ul>';
      parts.push(listHtml);
      continue;
    }

    // 연속 numbered_list_item → <ol>
    if (block.type === 'numbered_list_item') {
      let listHtml = '<ol>';
      while (i < blocks.length && blocks[i].type === 'numbered_list_item') {
        const item = blocks[i];
        const text = richTextToHtml(item.numbered_list_item.rich_text);
        let childHtml = '';
        if (item.children) {
          childHtml = await blocksToHtml(item.children, slug);
        }
        listHtml += `<li>${text}${childHtml}</li>`;
        i++;
      }
      listHtml += '</ol>';
      parts.push(listHtml);
      continue;
    }

    // 연속 to_do → <div class="notion-todo-list">
    if (block.type === 'to_do') {
      let todoHtml = '<div class="notion-todo-list">';
      while (i < blocks.length && blocks[i].type === 'to_do') {
        todoHtml += await renderBlock(blocks[i], slug);
        i++;
      }
      todoHtml += '</div>';
      parts.push(todoHtml);
      continue;
    }

    const html = await renderBlock(block, slug);
    if (html) parts.push(html);
    i++;
  }

  return parts.join('\n');
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
        status: { equals: 'Published' },
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

/** 타이틀 → slug 자동 생성 */
function titleToSlug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\uAC00-\uD7A3\u3131-\u3163\u1100-\u11FF-]/g, '-') // 영숫자, 한글, 하이픈 외 제거
    .replace(/-{2,}/g, '-')    // 연속 하이픈 → 하나로
    .replace(/^-|-$/g, '');    // 앞뒤 하이픈 제거
}

/** Notion 페이지 → HTML 변환 (frontmatter + HTML 본문) */
async function pageToContent(page, pageMap) {
  const pageId = page.id;
  const title = getPropertyValue(page, 'Title');
  const description = getPropertyValue(page, 'Description');
  const breadcrumbName = getPropertyValue(page, 'BreadcrumbName');

  if (!title) {
    console.warn(`  [SKIP] 제목 없는 페이지`);
    return null;
  }

  // 기존 매핑에 slug가 있으면 그대로 사용 (중복 방지)
  const existingSlug = pageMap[pageId];
  let slug = existingSlug || getPropertyValue(page, 'Slug') || titleToSlug(title);

  // 중첩 경로 → flat slug (파일시스템 호환)
  slug = slug.replace(/\//g, '-');

  // Date 없으면 오늘 날짜 사용
  const date = getPropertyValue(page, 'Date') || new Date().toISOString().slice(0, 10);

  // Notion 본문 블록 → HTML 직접 변환 (텍스트 파싱 없음)
  console.log(`  [FETCH] 블록 가져오는 중...`);
  const blocks = await fetchBlockChildren(pageId);
  console.log(`  [CONVERT] ${blocks.length}개 블록 → HTML 변환`);
  const htmlContent = await blocksToHtml(blocks, slug);

  // Frontmatter 생성
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `notionPageId: "${pageId}"`,
  ];

  if (breadcrumbName) {
    frontmatter.push(`breadcrumbName: "${breadcrumbName.replace(/"/g, '\\"')}"`);
  }

  frontmatter.push('---');

  return {
    slug,
    pageId,
    content: frontmatter.join('\n') + '\n\n' + htmlContent.trim() + '\n',
  };
}

/** 디렉토리에서 .md 파일 목록 수집 */
function collectMdFiles(dir) {
  const files = new Set();
  if (!fs.existsSync(dir)) return files;

  function scan(currentDir, prefix = '') {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scan(path.join(currentDir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.md')) {
        const slug = prefix ? `${prefix}/${entry.name.replace('.md', '')}` : entry.name.replace('.md', '');
        files.add(slug);
      }
    }
  }
  scan(dir);
  return files;
}

/** 파일 삭제 + 이미지 폴더 삭제 */
function deleteContent(slug) {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  [DELETE] ${slug}.md`);
  }

  const imgDir = path.join(IMAGE_DIR, slug);
  if (fs.existsSync(imgDir)) {
    fs.rmSync(imgDir, { recursive: true });
    console.log(`  [DELETE] images for ${slug}`);
  }
}

/** 전체 동기화 (예약 발행 — Date 기준 과거 글 1개씩) */
async function syncAll() {
  console.log('=== Full Sync: Notion → Blog (HTML 직접 변환) ===\n');

  const pages = await getPublishedPages();
  console.log(`Published pages: ${pages.length}\n`);

  ensureDir(BLOG_DIR);

  // 기존 파일 목록 (삭제 감지용)
  const existingFiles = collectMdFiles(BLOG_DIR);

  // page_id 매핑 로드
  const pageMap = loadPageMap();

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // 이미 싱크된 글 / 아직 안 된 글 분류
  const alreadySynced = [];
  const newCandidates = [];

  for (const page of pages) {
    const pageId = page.id;
    const date = getPropertyValue(page, 'Date') || today;

    if (pageMap[pageId]) {
      // 이미 싱크된 글 → 업데이트 체크 대상
      alreadySynced.push(page);
    } else if (date <= today) {
      // 아직 안 싱크됐고 Date가 오늘 이하 → 발행 후보
      newCandidates.push({ page, date });
    } else {
      console.log(`  [WAIT] "${getPropertyValue(page, 'Title')}" — 예약일 ${date} (아직 미도래)`);
    }
  }

  // 새 글은 Date 오래된 순 정렬, 1개만 발행
  newCandidates.sort((a, b) => a.date.localeCompare(b.date));
  const newPage = newCandidates.length > 0 ? newCandidates[0].page : null;

  if (newCandidates.length > 1) {
    console.log(`  [INFO] 발행 대기 ${newCandidates.length}개 중 1개만 싱크 (가장 오래된 글 우선)\n`);
  }

  const syncedSlugs = new Set();
  const newSlugs = [];

  // 1) 이미 싱크된 글 — 업데이트 체크
  for (const page of alreadySynced) {
    const title = getPropertyValue(page, 'Title');
    console.log(`Processing (update): "${title}"`);

    const result = await pageToContent(page, pageMap);
    if (!result) continue;

    const filePath = path.join(BLOG_DIR, `${result.slug}.md`);

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
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, result.content, 'utf-8');
      console.log(`  [UPDATE] ${result.slug}.md`);
    }

    pageMap[result.pageId] = result.slug;
    syncedSlugs.add(result.slug);
  }

  // 2) 새 글 1개 발행
  if (newPage) {
    const title = getPropertyValue(newPage, 'Title');
    console.log(`Processing (new): "${title}"`);

    const result = await pageToContent(newPage, pageMap);
    if (result) {
      const filePath = path.join(BLOG_DIR, `${result.slug}.md`);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, result.content, 'utf-8');
      console.log(`  [NEW] ${result.slug}.md`);

      pageMap[result.pageId] = result.slug;
      syncedSlugs.add(result.slug);
      newSlugs.push(result.slug);
    }
  }

  // Notion에서 삭제/비공개된 글 제거
  for (const [pid, slug] of Object.entries(pageMap)) {
    if (!syncedSlugs.has(slug)) {
      deleteContent(slug);
      delete pageMap[pid];
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
      deleteContent(slug);
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

  if (status === 'Deleted') {
    console.log(`Status is "Deleted" — removing content`);
    const slug = pageMap[pageId];
    if (slug) {
      deleteContent(slug);
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

  const result = await pageToContent(page, pageMap);
  if (!result) {
    console.log('Could not convert page — skipping');
    return;
  }

  const filePath = path.join(BLOG_DIR, `${result.slug}.md`);
  const isNew = !fs.existsSync(filePath);

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
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
