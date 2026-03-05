# typescripting

A TypeScript script that fetches the latest GitHub issues for a repository using the GitHub REST API.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (v18+ includes the global `fetch` API)
- npm (bundled with Node.js)

## Setup

1. Install dependencies:
   ```sh
   npm install
   ```

2. *(Optional)* Configure a GitHub token to avoid rate limiting:
   ```sh
   copy .env.example .env      # Windows
   cp .env.example .env        # macOS / Linux
   ```
   Then edit `.env` and set your `GITHUB_TOKEN`.

---

## Ways to Run `src/index.ts`

### Option 1 — Compile then run (recommended)

Compile TypeScript to JavaScript and run the output:

```sh
npm run build   # tsc → emits to dist/
npm start       # node dist/index.js
```

Or as a single command:

```sh
npm run build && npm start
```

### Option 2 — Run directly with ts-node (no compile step)

`ts-node` is already installed as a dev dependency. Use its ESM register hook to run the source directly:

```sh
npm run dev
# equivalent: node --import ts-node/esm --no-warnings src/index.ts
```

> **Note:** `--import` (used above) requires Node.js v20.6 or later. On older Node.js versions replace `--import` with `--loader`:

```sh
node --loader ts-node/esm --no-warnings src/index.ts
```

### Option 3 — Run directly with `npx tsx`

[`tsx`](https://github.com/privatenumber/tsx) is a zero-config TypeScript runner. You don't need to install it globally:

```sh
npx tsx src/index.ts
```

### Option 4 — Global `ts-node` CLI

If you have `ts-node` v10+ installed globally, use the `--esm` flag which enables ESM support:

```sh
ts-node --esm src/index.ts
```

---

## Windows Quick-Start Script

A convenience script `run.cmd` is included. It installs dependencies, compiles the project, and runs it in one step:

```cmd
run.cmd
```

Double-click `run.cmd` in File Explorer, or open a Command Prompt in the project root and run it as shown above.

---

## npm Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Compile TypeScript (`src/`) → `dist/` |
| `start` | `npm start` | Run the compiled output (`dist/index.js`) |
| `dev`   | `npm run dev`   | Run `src/index.ts` directly via `ts-node/esm` (no compile step) |
