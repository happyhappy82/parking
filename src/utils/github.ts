const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
const GITHUB_REPO = import.meta.env.GITHUB_REPO;
const GITHUB_BRANCH = import.meta.env.GITHUB_BRANCH || 'main';

const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

interface GitHubFileResponse {
  content: string;
  sha: string;
  name: string;
  path: string;
}

interface GitHubListItem {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

/** 파일 읽기 */
export async function getFile(path: string): Promise<{ content: string; sha: string }> {
  const res = await fetch(`${API_BASE}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: headers(),
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error(`파일을 찾을 수 없습니다: ${path}`);
    throw new Error(`GitHub API 오류: ${res.status}`);
  }

  const data: GitHubFileResponse = await res.json();
  const content = decodeBase64(data.content);
  return { content, sha: data.sha };
}

/** 파일 저장 (생성 or 업데이트) */
export async function saveFile(
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: encodeBase64(content),
    branch: GITHUB_BRANCH,
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub 저장 실패: ${res.status} - ${(err as any).message || ''}`);
  }
}

/** 파일 삭제 */
export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({
      message,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub 삭제 실패: ${res.status}`);
  }
}

/** 디렉토리 내 파일 목록 */
export async function listFiles(path: string): Promise<GitHubListItem[]> {
  const res = await fetch(`${API_BASE}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: headers(),
  });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`GitHub API 오류: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => ({
    name: item.name,
    path: item.path,
    sha: item.sha,
    type: item.type,
  }));
}

/** 바이너리 파일 저장 (이미 base64 인코딩된 데이터) */
export async function saveBinaryFile(
  path: string,
  base64Content: string,
  message: string,
  sha?: string
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: base64Content,
    branch: GITHUB_BRANCH,
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub 저장 실패: ${res.status} - ${(err as any).message || ''}`);
  }
}

function encodeBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str: string): string {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}
