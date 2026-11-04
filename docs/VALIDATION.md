# Validation

24 Node tests passed, including real HTTP requests, HTTPS proxy origin checks and a temporary Git repository. The hosted production build passed. Browser checks covered the sample, a separate two-file upload, source view, evidence paths, graph filtering/zoom, clipboard commands, and a JSON download verified on disk.

Markdown preview and clipboard worked. The cloud browser did not return a completion signal for the .md download; preview/copy is available. CLI Markdown export was verified on disk.

Six bundled Python test functions passed by direct execution; pytest was unavailable in the build environment. The live Vercel deployment uses the supplied container configuration; Render remains an alternative deployment configuration. There is no exhaustive Python semantics, cross-device or production-load validation.

## Regression review — 4 November 2026
Reviewed the HTTP boundaries, path and patch validation, call graph logic and HTML escaping. Re-ran all 24 tests successfully. The Vercel production health endpoint and sample analysis were checked against the production deployment. No additional confirmed defect was found in this review; static analysis limitations in LIMITATIONS.md still apply.
