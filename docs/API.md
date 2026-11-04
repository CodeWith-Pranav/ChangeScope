# API

All paths share the frontend's origin. JSON responses use `Cache-Control: no-store`.

- `GET /api/health`: `{"status":"ok","version":"1.0.0"}`.
- `GET /api/sample`: the example project and unified diff in valid input format.
- `POST /api/analyze`: JSON with `name`, `files: [{path, content}]`, and `diff`.

Strings contain actual source and diff text; use `JSON.stringify` to escape newlines correctly.

```sh
curl http://localhost:3000/api/sample -o input.json
curl -H 'Content-Type: application/json' --data-binary @input.json http://localhost:3000/api/analyze
```

| Result field | Meaning |
| --- | --- |
| `schemaVersion` | Currently 1 |
| `project`, `summary` | Project name and computed counts/timing |
| `nodes`, `edges` | Combined old/current dependency graph |
| `affected` | Reachable nodes with `direct`, `depth`, `path` |
| `tests` | Suggested current pytest functions and selectors |
| `command` | Focused POSIX-shell command or null |
| `conservativeCommand` | All detected test files, not necessarily all project tests |
| `conservative` | Detected uncertainty or module-level change |
| `changes` | Parsed hunks and changed lines |
| `diagnostics` | First 250 warnings; summary count is full count |
| `diagnosticsTruncated` | Whether more diagnostics existed |
| `files` | Current source for the in-memory viewer |
| `limitations` | Scope caveats |

Evidence paths run from caller/test to changed function. The UI reverses them for a change-first display. `deleted` nodes occur only in the old snapshot.

Invalid input/mismatched diff returns 400 with an `error` string. Foreign Origin returns 403; unsupported analysis method 405; oversized body 413; unknown API route 404.

The standalone API has no authentication or durable storage. It does not accept repository URLs/tokens, fetch repositories, or execute uploaded source.
