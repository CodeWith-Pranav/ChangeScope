# DSA and algorithm

A node represents a function, identified by `relative/path.py::qualified.name`. A call edge points from caller to callee. Maps index functions/imports and sets deduplicate changes and visited nodes.

For `test_checkout → checkout → create_order → calculate_total → apply_discount`, a change to the last function may affect every function to its left. Build reverse adjacency, so each callee points to its callers.

## Multi-source reverse BFS

Enqueue every changed node. Advance an array index to pop items without repeatedly shifting the array. For each unseen caller, record its path through the current node and enqueue it. A visited map prevents loops on recursive graphs. With multiple changed starting points, the first discovered path is a shortest path in edge count to one starting change. It is one witness, not every possible route.

A standard adjacency-list BFS takes O(V + E) time and O(V + E) space including the graph. This implementation copies witness arrays; path storage/copying can grow to O(V × D), where D is the longest returned path. Parent pointers are a possible improvement.

## Why analyze both snapshots?

Deleted functions and calls can disappear from the new graph. Reconstructing old source from the diff and combining both graphs preserves earlier dependencies. This can over-select tests, an intentional conservative tradeoff.

## Changed lines and broader impact

Changed lines are matched against function ranges in the corresponding snapshot. A change inside a nested function can also mark its containing function. Changes outside functions trigger broader module/importer impact.

The current range scan can cost O(L × F), with L changed lines and F functions. An interval index would improve this for larger inputs. Module propagation uses repeated scans. Do not claim the entire analyzer is O(V + E); that describes the basic graph walk.

## Correctness limits

Python can create dependencies at runtime. This static subset cannot prove that unselected tests are unrelated. Diagnostics identify some uncertainty but absence of warnings is not a proof of complete coverage.
