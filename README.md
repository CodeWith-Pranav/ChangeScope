# ChangeScope

**Know what your change touches.**

A working Python change-impact analyzer with a browser frontend, Node.js backend, and local Git CLI. It parses source and a unified diff, builds previous/current call graphs, walks reverse dependencies and suggests pytest tests with explanation paths.

[Public demo](https://changescope-psi.vercel.app)

The dashboard runs on Vercel. A local CLI uses the same analysis engine for repositories on disk. [Architecture](docs/ARCHITECTURE.md) · [Algorithm](docs/ALGORITHM.md) · [Supported scope](docs/LIMITATIONS.md)

## How it works

1. Validate the current Python source against the supplied diff.
2. Reconstruct the previous source and parse both snapshots.
3. Combine their call graphs to retain deleted dependencies.
4. Run reverse breadth-first search from changed functions.
5. Show affected callers and suggested tests with witness paths.

## Run locally

Install Node.js 22.13+ and Git. Open a terminal inside this extracted folder:

```sh
npm ci
npm start
```

Visit **http://localhost:3000**. Keep the terminal open; Ctrl+C stops the server. No database, API key, Python installation or frontend build is required to run ChangeScope. It uses deterministic static analysis, not an AI model.

```sh
npm test
```

Git is required for the CLI integration test. Python/pytest are required only to execute the target project's suggested tests yourself; ChangeScope never executes uploaded Python.

## Features

- Folder/file uploads, drag/drop, pasted or uploaded unified diffs.
- Validation of patch context and reconstruction of previous source.
- Python function/import indexing with aliases and nested definitions.
- Combined before/current call graph, including deleted functions.
- Reverse BFS with explanation paths to affected callers and tests.
- Interactive graph, search, zoom, source viewer and diff viewer.
- Suggested test commands, clipboard copying and JSON/Markdown reports.
- Diagnostics and explicit limitations for unsupported dynamic behavior.
- Local Git CLI, sample Python project, automated checks, Docker and Render configurations.

The built-in example computes **1 changed function, 9 affected functions and 5 suggested tests out of 6**.

## Analyze your own Python repository

From the repository root after editing:

```sh
git diff --no-ext-diff --no-textconv --no-renames --unified=3 HEAD -- '*.py' > changes.diff
```

Choose New analysis, upload the repository folder containing current source, and upload the matching diff. Folder selection preserves relative paths; individual files preserve basenames. New untracked files must be staged for Git to include them. Review Diagnostics before using the test plan. Always run the full suite before release.

Limits: 80 current Python files, 600 KB source, 600 KB diff, 1,200 functions per snapshot and 1.4 MB HTTP body. The tool cannot prove that unselected tests are safe to skip.

## CLI

```sh
node standalone/cli.mjs --repo /path/to/python-repo --base HEAD --json report.json --markdown report.md
```

Analyzes tracked working-tree files against a local commit. Reports can contain source snippets. No Python is executed.

## Source map

| Folder | Purpose |
| --- | --- |
| public | HTML, CSS and browser JavaScript |
| standalone | Node server and local Git CLI |
| core | Parser, diff handling, call graph, BFS and API |
| tests | Engine, HTTP and Git checks |
| examples | Uploadable example project, diff and reports |
| docs | Architecture, algorithm, API, deployment and walkthroughs |

## GitHub and deployment

Clone this repository to work with the source and history. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Git commands and hosting instructions. GitHub Pages alone cannot run this backend.

See the [code walkthrough](docs/BEGINNER.md), [example workflow](docs/DEMO.md), and [engineering questions](docs/INTERVIEW.md) for implementation details and design tradeoffs.

The app holds source in memory, without application database/log/browser-storage persistence. Hosted requests still cross the network; use local hosting for private code. See [limitations](docs/LIMITATIONS.md) and [validation](docs/VALIDATION.md).

Original app code: MIT. Parser dependencies retain their own MIT license notices in THIRD_PARTY_NOTICES.md.
