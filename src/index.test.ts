import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The IIFE at the bottom of index.ts reads process.argv[2] and calls process.exit(1) when
// missing. Set a dummy arg at module level (before the dynamic import) so it doesn't fire.
const originalArgv = process.argv;
process.argv = [...originalArgv.slice(0, 2), '__test_owner__'];

// Stub global fetch *before* importing index.ts so the IIFE's fetchOpenIssuesForAllRepos
// call doesn't hit the real GitHub API. The per-test stubs will override as needed.
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true, status: 200, statusText: 'OK',
  json: () => Promise.resolve([]),
  text: () => Promise.resolve(''),
}) as unknown as typeof fetch;

const { fetchLatestIssues, fetchOpenIssuesForAllRepos } = await import('./index.js');

// Restore original argv now that the module is loaded
process.argv = originalArgv;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal GitHub-style issue JSON object. */
function fakeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    number: 42,
    title: 'Bug report',
    body: 'Something broke',
    html_url: 'https://github.com/owner/repo/issues/42',
    state: 'open',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    closed_at: null,
    user: { login: 'octocat', avatar_url: 'https://a.com/u.png', html_url: 'https://github.com/octocat' },
    labels: [{ name: 'bug' }],
    ...overrides,
  };
}

/** Build a minimal GitHub-style repo JSON object. */
function fakeRepo(name: string) {
  return { name, full_name: `user/${name}`, html_url: `https://github.com/user/${name}` };
}

/** Stub global fetch to return a successful JSON response. */
function stubFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ---------------------------------------------------------------------------
// Tests — fetchLatestIssues
// ---------------------------------------------------------------------------

describe('fetchLatestIssues', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when owner or repo is missing', async () => {
    await expect(fetchLatestIssues('', 'repo')).rejects.toThrow('owner and repo are required');
    await expect(fetchLatestIssues('owner', '')).rejects.toThrow('owner and repo are required');
  });

  it('returns mapped issues and filters out PRs by default', async () => {
    const raw = [
      fakeIssue(),
      fakeIssue({ id: 2, number: 99, title: 'A PR', pull_request: { url: '...' } }),
    ];
    globalThis.fetch = stubFetch(raw) as unknown as typeof fetch;

    const issues = await fetchLatestIssues('owner', 'repo', { token: 'tok' });

    expect(issues).toHaveLength(1);
    expect(issues[0]!.number).toBe(42);
    expect(issues[0]!.labels).toEqual(['bug']);
    expect(issues[0]!.isPullRequest).toBe(false);
  });

  it('includes PRs when includePullRequests is true', async () => {
    const raw = [
      fakeIssue(),
      fakeIssue({ id: 2, number: 99, title: 'A PR', pull_request: { url: '...' } }),
    ];
    globalThis.fetch = stubFetch(raw) as unknown as typeof fetch;

    const issues = await fetchLatestIssues('owner', 'repo', { includePullRequests: true, token: 'tok' });

    expect(issues).toHaveLength(2);
    expect(issues[1]!.isPullRequest).toBe(true);
  });

  it('clamps perPage to 1..100 and page to >= 1', async () => {
    globalThis.fetch = stubFetch([]) as unknown as typeof fetch;

    await fetchLatestIssues('owner', 'repo', { perPage: 999, page: -3, token: 'tok' });

    const calledUrl = new URL((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get('per_page')).toBe('100');
    expect(calledUrl.searchParams.get('page')).toBe('1');
  });

  it('throws on non-OK HTTP response', async () => {
    globalThis.fetch = stubFetch({ message: 'Not Found' }, 404) as unknown as typeof fetch;

    await expect(fetchLatestIssues('owner', 'repo', { token: 'tok' })).rejects.toThrow(/GitHub API error: 404/);
  });

  it('sends correct headers including Authorization when token is provided', async () => {
    globalThis.fetch = stubFetch([]) as unknown as typeof fetch;

    await fetchLatestIssues('owner', 'repo', { token: 'my-token' });

    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].headers;
    expect(headers.Authorization).toBe('Bearer my-token');
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(headers['User-Agent']).toBe('fetch-latest-issues-script');
  });
});

// ---------------------------------------------------------------------------
// Tests — fetchOpenIssuesForAllRepos
// ---------------------------------------------------------------------------

describe('fetchOpenIssuesForAllRepos', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws when user is empty', async () => {
    await expect(fetchOpenIssuesForAllRepos('')).rejects.toThrow('user is required');
  });

  it('returns only repos that have open issues', async () => {
    // First call: fetchUserRepos -> returns two repos
    // Subsequent calls: fetchLatestIssues per repo
    const repos = [fakeRepo('has-issues'), fakeRepo('no-issues')];
    const issuesForFirst = [fakeIssue()];
    const issuesForSecond: unknown[] = [];

    let callIndex = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callIndex++;
      // 1st call -> repos list
      if (callIndex === 1) {
        return Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          json: () => Promise.resolve(repos),
          text: () => Promise.resolve(''),
        });
      }
      // 2nd call -> issues for has-issues
      if (callIndex === 2) {
        return Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          json: () => Promise.resolve(issuesForFirst),
          text: () => Promise.resolve(''),
        });
      }
      // 3rd call -> issues for no-issues (empty)
      return Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(issuesForSecond),
        text: () => Promise.resolve(''),
      });
    }) as unknown as typeof fetch;

    const results = await fetchOpenIssuesForAllRepos('user', { token: 'tok' });

    expect(results).toHaveLength(1);
    expect(results[0]!.repo).toBe('user/has-issues');
    expect(results[0]!.issues).toHaveLength(1);
  });

  it('swallows per-repo errors and returns empty issues', async () => {
    const repos = [fakeRepo('bad-repo')];

    let callIndex = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          json: () => Promise.resolve(repos),
          text: () => Promise.resolve(''),
        });
      }
      // Per-repo fetch fails
      return Promise.resolve({
        ok: false, status: 500, statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('boom'),
      });
    }) as unknown as typeof fetch;

    const results = await fetchOpenIssuesForAllRepos('user', { token: 'tok' });

    // bad-repo error is swallowed -> issues: [] -> filtered out
    expect(results).toHaveLength(0);
  });
});

