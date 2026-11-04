# Interview preparation

## Project explanation

“ChangeScope is a Python change-impact analyzer. It reconstructs the previous version from a Git diff, builds call graphs for both versions, and uses reverse BFS to find affected callers and suggest tests with evidence paths. A Node API powers its dashboard and a local Git CLI uses the same engine.”

## Questions to practice

| Question | Explain |
| --- | --- |
| Why a parser? | Syntax structure distinguishes definitions, nesting and calls. Name resolution is a separate step. |
| Why reverse BFS? | Callers depend on callees. Reverse edges expose dependents and BFS produces short witness paths. |
| How do cycles terminate? | Mark nodes visited when enqueuing, so recursion does not enqueue forever. |
| Why old and new graphs? | Deleted dependencies vanish from the new graph; the union preserves them. |
| What is the complexity? | Basic BFS is O(V+E); path copying, range scans and module propagation have separate costs. |
| Is it AI? | No. Deterministic parsing and graph analysis fit the problem. |
| What was tested? | Aliases, deletions, recursion, shadowing, malformed diffs, uncertainty, API errors, real HTTP and Git. |
| Does it guarantee a safe test subset? | No. Dynamic Python and incomplete uploads can hide dependencies. |
| Why no database? | One-shot analysis needs no saved accounts/history. |
| How would it scale? | Incremental indexes, source hashes, parent pointers, interval indexing, jobs and rate limits. |
| What did you contribute? | Name the assistance used and the code/features/tests you personally understood and changed. |

## Resume wording after learning and extending it

“Developed a Python change-impact tool with a Node API and interactive dependency graph; used AST parsing and reverse BFS for explainable test suggestions with regression and integration tests.”

Adapt “developed” to your actual contribution. Do not claim independent authorship, production usage, users or unmeasured performance gains.

Trace one full frontend/API request. Draw a graph and manually perform reverse BFS. Explain deletion handling and a false-negative case. Add one meaningful feature/test and practice explaining a limitation honestly.
