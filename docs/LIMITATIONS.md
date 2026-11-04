# Supported scope and limits

This is a small-project Python change-impact assistant, not a complete Python semantic analyzer.

Supported patterns include ordinary and nested functions, class methods, explicit imports/aliases, relative imports, direct named calls, same-class self/cls calls, standard pytest functions/methods, unified diffs and deleted functions/files.

Not fully modeled: dynamic callables, higher-order functions, runtime/wildcard imports, re-exports, fixture injection, decorators, inheritance, polymorphism, monkey-patching, globals/nonlocals, descriptors, generated code, environment-dependent imports, and calls in annotations/default expressions. Conditional or duplicate definitions can be ambiguous. Some unsupported patterns can be missed without a warning.

Identity uses qualified names; a renamed function appears as old/deleted plus new. Pure file renames and quoted/nonstandard diff paths are rejected. Source must be the AFTER version matching the diff. Only supplied source and reconstructed deleted files are considered.

Test discovery recognizes `test_*.py` or `*_test.py`, names starting `test_`, and methods immediately inside a `Test*` class. Custom pytest configuration/plugins, unittest naming and parameterized instances may differ.

The focused commands use POSIX single-quote escaping. On Windows use PowerShell/Git Bash or copy selectors manually. No tests are executed by the analyzer. Zero suggestions does not mean zero risk. Run `python -m pytest` from your repository root before release.

Limits: 80 current source files; 600 KB source; 600 KB diff text; 1,200 functions per snapshot; 1.4 MB request; AST recursion depth 150; first 250 diagnostics shown. Large graphs are visually capped with shown/total labels; the affected-function table remains available.

Source is held in browser/request memory by application code. Hosted requests still cross the network. Exports can include code. Use the standalone app locally for private source.

This release does not include accounts, saved project history, collaboration, arbitrary remote clone, background jobs or large-repository indexing.
