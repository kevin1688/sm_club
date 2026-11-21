import type { DrawRecord, GitHubConfig } from '../types';
import { formatAmount, mergeDrawRecords } from '../utils/drawLogic';

interface GitHubFileResponse {
  sha: string;
  content: string;
  encoding: string;
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function buildHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').trim() || 'data/history.json';
}

export function isGitHubReadReady(config: GitHubConfig): boolean {
  return Boolean(config.owner.trim() && config.repo.trim());
}

export function isGitHubWriteReady(config: GitHubConfig): boolean {
  return Boolean(config.owner.trim() && config.repo.trim() && config.token.trim());
}

/**
 * Auto-detect GitHub owner & repo when hosted on GitHub Pages (https://<owner>.github.io/<repo>/).
 */
export function detectGitHubPagesRepo(): { owner: string; repo: string } | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (!host.endsWith('.github.io')) return null;

  const owner = host.slice(0, -'.github.io'.length);
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  const repo = pathSegments[0] || `${owner}.github.io`;
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Fetch history JSON file from GitHub repository.
 */
export async function fetchGitHubHistory(
  config: GitHubConfig
): Promise<{ records: DrawRecord[]; sha: string | null }> {
  if (!isGitHubReadReady(config)) {
    throw new Error('請先填寫 GitHub 擁有者 (Owner) 與倉庫名稱 (Repo)。');
  }

  const owner = encodeURIComponent(config.owner.trim());
  const repo = encodeURIComponent(config.repo.trim());
  const branch = encodeURIComponent(config.branch.trim() || 'main');
  const filePath = normalizePath(config.filePath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(config.token),
    cache: 'no-store',
  });

  if (res.status === 404) {
    return { records: [], sha: null };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`無法讀取 GitHub 紀錄 (HTTP ${res.status})${errText ? `：${errText.slice(0, 120)}` : ''}`);
  }

  const data = (await res.json()) as GitHubFileResponse;
  const decoded = decodeBase64Utf8(data.content);
  const parsed = JSON.parse(decoded);
  if (!Array.isArray(parsed)) {
    throw new Error('GitHub 上的歷史檔案格式不是有效的 JSON 陣列。');
  }

  const records: DrawRecord[] = parsed.map((item) => ({
    ...item,
    itemName: item.itemName || '未指定項目',
    syncedToGitHub: true,
  }));

  return { records, sha: data.sha };
}

/**
 * Merge local records with remote GitHub history and commit to GitHub.
 * Includes automatic single retry on HTTP 409 SHA conflict.
 */
export async function syncRecordsToGitHub(
  config: GitHubConfig,
  localRecords: DrawRecord[],
  commitMessage?: string
): Promise<DrawRecord[]> {
  if (!isGitHubWriteReady(config)) {
    throw new Error('需要設定 GitHub Owner、Repo 與具備 Contents 寫入權限的 Personal Access Token。');
  }

  const owner = encodeURIComponent(config.owner.trim());
  const repo = encodeURIComponent(config.repo.trim());
  const branch = config.branch.trim() || 'main';
  const filePath = normalizePath(config.filePath)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { records: remoteRecords, sha } = await fetchGitHubHistory(config);
    const merged = mergeDrawRecords(localRecords, remoteRecords).map((r) => ({
      ...r,
      syncedToGitHub: true,
    }));

    // Persist clean records without redundant runtime flag clutter (keep clean schema)
    const payloadRecords = merged.map(({ syncedToGitHub: _ignored, ...rest }) => rest);
    const contentBase64 = encodeBase64Utf8(JSON.stringify(payloadRecords, null, 2) + '\n');

    const latest = merged[0];
    const defaultMsg = latest
      ? `chore(draw): [${latest.itemName || '未指定項目'}] ${latest.winnerId} - ${formatAmount(latest.amount, latest.currencyUnit)}`
      : 'chore(draw): sync roulette history';

    const body: Record<string, string> = {
      message: commitMessage || defaultMsg,
      content: contentBase64,
      branch,
    };
    if (sha) {
      body.sha = sha;
    }

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        ...buildHeaders(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (putRes.status === 409 && attempt === 0) {
      continue; // Re-fetch latest SHA & merge on conflict
    }

    if (!putRes.ok) {
      const errBody = await putRes.text().catch(() => '');
      throw new Error(
        `寫入 GitHub 失敗 (HTTP ${putRes.status})：請確認 Token 具備此 Repo 的 Contents 讀寫權限。${
          errBody ? ` (${errBody.slice(0, 120)})` : ''
        }`
      );
    }

    return merged;
  }

  throw new Error('GitHub 同步發生併發衝突，請稍後再試。');
}

/**
 * Test connectivity and inspect repository metadata.
 */
export async function testGitHubConnection(
  config: GitHubConfig
): Promise<{ ok: boolean; message: string; recordCount?: number }> {
  if (!isGitHubReadReady(config)) {
    return { ok: false, message: '請先輸入 GitHub Owner 與 Repo 名稱。' };
  }

  const owner = encodeURIComponent(config.owner.trim());
  const repo = encodeURIComponent(config.repo.trim());

  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: buildHeaders(config.token),
    cache: 'no-store',
  });

  if (!repoRes.ok) {
    return {
      ok: false,
      message: `找不到倉庫或權限不足 (HTTP ${repoRes.status})，請確認 Owner / Repo 與 Token。`,
    };
  }

  const repoInfo = (await repoRes.json()) as { permissions?: { push?: boolean }; default_branch?: string };
  const { records } = await fetchGitHubHistory(config);

  if (config.token.trim()) {
    if (repoInfo.permissions && repoInfo.permissions.push === false) {
      return {
        ok: false,
        message: '可讀取倉庫，但此 Token 缺少寫入權限（請開啟 Contents: Read and write）。',
      };
    }
    return {
      ok: true,
      recordCount: records.length,
      message: `連線成功！具備讀寫權限，目前雲端共有 ${records.length} 筆歷史紀錄。`,
    };
  }

  return {
    ok: true,
    recordCount: records.length,
    message: `唯讀連線成功（未填 Token），目前雲端共有 ${records.length} 筆歷史紀錄。填入 Token 後即可自動上傳。`,
  };
}

