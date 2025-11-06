/**
 * Fetch the latest GitHub issues for a repository.
 *
 * Notes:
 * - Requires a global `fetch` (browsers and newer Node.js). In Node.js <18, install a fetch polyfill (e.g. node-fetch).
 * - If you provide a token in options.token it will be used. Otherwise the function will look for
 *   process.env.GITHUB_TOKEN or process.env.GH_TOKEN.
 * - The GitHub "issues" endpoint returns pull requests as well — by default this function filters them out.
 */

export type IssueState = 'open' | 'closed' | 'all';

export interface IssueAuthor {
  login: string;
  avatar_url?: string;
  html_url?: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  state: IssueState;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  author?: IssueAuthor | null;
  labels: string[];
  isPullRequest: boolean;
}

export interface FetchIssuesOptions {
  perPage?: number; // 1 - 100, default 30
  page?: number; // pagination page, default 1
  state?: IssueState; // default 'open'
  token?: string; // GitHub token; if omitted the function will check env vars
  includePullRequests?: boolean; // default false
  timeoutMs?: number; // optional request timeout in ms (only used if AbortController is available)
}

/**
 * Fetches latest issues for the given owner/repo sorted by creation date (descending).
 *
 * @example
 * const issues = await fetchLatestIssues('octocat', 'Hello-World', { perPage: 10 });
 */
export async function fetchLatestIssues(
  owner: string,
  repo: string,
  options: FetchIssuesOptions = {}
): Promise<Issue[]> {
  if (!owner || !repo) {
    throw new Error('owner and repo are required');
  }

  const perPage = Math.max(1, Math.min(100, options.perPage ?? 30));
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const state = options.state ?? 'open';
  const includePRs = Boolean(options.includePullRequests);
  const token = options.token ?? (typeof process !== 'undefined' ? (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) : undefined);

  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
  url.searchParams.set('state', state);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  // Ask GitHub to sort by created, newest first
  url.searchParams.set('sort', 'created');
  url.searchParams.set('direction', 'desc');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'fetch-latest-issues-script'
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Optional timeout via AbortController if available
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (options.timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), options.timeoutMs);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
    signal: controller ? controller.signal : undefined
  }).catch((err) => {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${options.timeoutMs}ms`);
    }
    throw err;
  }).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error: ${res.status} ${res.statusText} ${text ? '- ' + text : ''}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Unexpected GitHub API response: expected an array of issues');
  }

  const issues: Issue[] = data
    .filter((raw: any) => {
      if (includePRs) return true;
      // Filter out pull requests — the issues endpoint returns PRs with a "pull_request" field
      return !Object.prototype.hasOwnProperty.call(raw, 'pull_request');
    })
    .map((raw: any) => {
      const labels: string[] = Array.isArray(raw.labels)
        ? raw.labels.map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
        : [];

      const author: IssueAuthor | null = raw.user
        ? {
            login: raw.user.login,
            avatar_url: raw.user.avatar_url,
            html_url: raw.user.html_url
          }
        : null;

      return {
        id: raw.id,
        number: raw.number,
        title: raw.title,
        body: raw.body ?? null,
        html_url: raw.html_url,
        state: raw.state as IssueState,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        closed_at: raw.closed_at ?? null,
        author,
        labels,
        isPullRequest: Boolean(raw.pull_request)
      } as Issue;
    });

  return issues;
}

/*
Example usage:

(async () => {
  try {
    const issues = await fetchLatestIssues('octocat', 'Hello-World', { perPage: 5 });
    console.log('Latest issues:', issues.map(i => `#${i.number} ${i.title}`));
  } catch (err) {
    console.error('Failed to fetch issues:', err);
  }
})();
*/
