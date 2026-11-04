#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze } from "../core/analyzer.mjs";
import { markdown } from "../core/report.mjs";
const args = process.argv.slice(2);
function arg(k, fallback) {
  const i = args.indexOf(k);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error("Missing value for " + k);
  return args[i + 1];
}
if (args.includes("--help")) {
  console.log(
    "ChangeScope: node standalone/cli.mjs --repo PATH --base HEAD [--json report.json] [--markdown report.md]\nAnalyzes the working tree against a local commit. Python source is never executed.",
  );
  process.exit(0);
}
try {
  const repo = resolve(arg("--repo", ".")),
    base = arg("--base", "HEAD");
  const git = (...a) =>
    execFileSync("git", a, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 4000000,
      timeout: 15000,
    });
  const sha = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    base + "^{commit}",
  ).trim();
  const paths = git("ls-files", "-z", "--", "*.py").split("\0").filter(Boolean);
  const files = [];
  for (const path of paths) {
    if (
      path.split("/").some((p) => [".venv", "venv", "__pycache__"].includes(p))
    )
      continue;
    const abs = resolve(repo, path);
    try {
      const st = lstatSync(abs);
      if (!st.isFile() || st.isSymbolicLink()) continue;
      if (st.size > 600000)
        throw new Error(
          "A Python file exceeds 600 KB. Analyze a smaller package.",
        );
      if (files.length >= 80)
        throw new Error("Too many Python files. Analyze a smaller package.");
      files.push({ path, content: readFileSync(abs, "utf8") });
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  const diff = git(
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "--unified=3",
    sha,
    "--",
    "*.py",
  );
  if (!diff.trim()) {
    console.log("No Python changes against " + base);
    process.exit(0);
  }
  const r = analyze({ name: repo.split(/[\\/]/).at(-1), files, diff });
  const { files: source, ...report } = r;
  const json = arg("--json", null),
    md = arg("--markdown", null);
  if (json) writeFileSync(resolve(json), JSON.stringify(report, null, 2));
  if (md) writeFileSync(resolve(md), markdown(r));
  console.log(markdown(r));
} catch (e) {
  console.error("ChangeScope: " + e.message);
  process.exit(1);
}
