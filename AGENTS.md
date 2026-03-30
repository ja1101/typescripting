# AGENTS.md

## Big Picture
- `src/index.ts` is both the public library surface and the CLI entrypoint (bottom IIFE).
- Core exports are `fetchLatestIssues(owner, repo, options)` and `fetchOpenIssuesForAllRepos(user, options)`.
- Data flow for multi-repo mode: `fetchOpenIssuesForAllRepos` -> internal `fetchUserRepos` pagination -> per-repo `fetchLatestIssues` -> filter repos with `issues.length > 0`.
- This is ESM-first (`"type": "module"`, `module: "nodenext"`); keep imports/exports ESM-safe.

## API + Data Contract Conventions
- Keep normalized response shapes stable (`IssueAuthor`, `Issue`, `RepoIssues` in `src/index.ts`).
- `fetchLatestIssues` clamps `perPage` to `1..100` and floors `page` to `>= 1`; preserve this behavior.
- GitHub `/issues` API returns PRs too; default behavior filters PRs via `pull_request` presence unless `includePullRequests` is true.
- Timeout logic is optional and uses `AbortController`; timeout errors are surfaced as `Request timed out after <ms>ms`.
- `fetchOpenIssuesForAllRepos` is intentionally tolerant: repo-level failures become `{ repo, issues: [] }` so one bad repo does not fail all results.

## External Integration (GitHub REST)
- Requests target GitHub REST v3 endpoints:
  - `/users/{user}/repos` in `fetchUserRepos`
  - `/repos/{owner}/{repo}/issues` in `fetchLatestIssues`
- Required headers pattern: `Accept: application/vnd.github+json` and `User-Agent: fetch-latest-issues-script`.
- Token resolution order: `options.token` -> `process.env.GITHUB_TOKEN` -> `process.env.GH_TOKEN`.
- `dotenv.config()` runs at module load in `src/index.ts`, so `.env` is active for both CLI and library usage.

## Build, Run, and Validation
- Install + build + run compiled output:
  - `npm install`
  - `npm run build`
  - `npm start -- <owner>`
- Direct TS execution uses `npm run dev` (`node --import ts-node/esm ...`, Node >= 20.6 for `--import`).
- Convenience runners `run.cmd` and `run.py` run install/build/start with sample owner `ja1101`.
- CI currently validates type-check only (`.github/workflows/main.yml` runs `npx tsc --noEmit`); there is no real automated test suite.
- `npm test` is a placeholder that exits with error; do not treat it as project validation.

## Change Guidance for Agents
- Keep CLI output format readable and stable: per-repo header + indented `#<number> <title>` lines.
- If splitting code into new modules, preserve current exported API from `src/index.ts` unless intentionally changing versioned behavior.
- Prefer small focused edits over broad refactors; this repo is intentionally compact and single-file-centric right now.
