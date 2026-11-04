# Code walkthrough

ChangeScope answers a specific question: which callers and tests are statically connected to a changed Python function?

## Browser and API

`public/index.html` defines the dashboard, `styles.css` provides its layout, and `client.js` handles uploads, graph rendering, source inspection and report export.

The browser sends `{name, files, diff}` as JSON to `POST /api/analyze`. Each file has a relative path and source text. The response includes function nodes, call edges, affected nodes, test selectors and diagnostics. The browser renders the computed result without saving project source to browser storage.

## Server and engine

`standalone/server.mjs` serves the frontend and passes API requests to `core/http.mjs`. That handler validates the HTTP boundary and invokes `core/analyzer.mjs`. The current Vercel deployment runs the standalone server in a container; `api/index.mjs` also provides an API adapter.

`core/diff.mjs` validates unified diff hunks and reconstructs previous source. The analyzer parses both versions, resolves supported calls and builds reverse adjacency. A queue and visited map identify affected callers and attach a shortest witness path. `core/report.mjs` produces Markdown reports for the CLI.

The engine uses deterministic syntax and graph analysis. No model API or database is required. Reports are the explicit persistence mechanism.

## Follow one example

1. Run the app and inspect the diff for `apply_discount`.
2. Follow its path through `calculate_total`, `create_order` and `checkout` to a test.
3. Compare those functions with the source in `core/sample.mjs`.
4. Read an alias-resolution test and the Git integration test in `tests/`.
5. Find reverse adjacency, the queue and the visited map in `analyze`.

For complexity and correctness boundaries, see [ALGORITHM.md](ALGORITHM.md) and [LIMITATIONS.md](LIMITATIONS.md).
