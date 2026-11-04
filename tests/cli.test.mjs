import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

test("CLI analyzes an actual Git working tree and exports both reports", () => {
  const repo = mkdtempSync(join(tmpdir(), "changescope-test-"));
  const cli = fileURLToPath(new URL("../standalone/cli.mjs", import.meta.url));
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, stdio: "pipe" });
  try {
    git("init");
    git("config", "user.name", "ChangeScope Test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(repo, "app.py"), "def value():\n    return 1\n");
    writeFileSync(
      join(repo, "test_app.py"),
      "from app import value\ndef test_value():\n    assert value() == 2\n",
    );
    git("add", ".");
    git("commit", "-m", "Baseline");
    writeFileSync(join(repo, "app.py"), "def value():\n    return 2\n");
    const output = execFileSync(
      process.execPath,
      [
        cli,
        "--repo",
        repo,
        "--base",
        "HEAD",
        "--json",
        join(repo, "report.json"),
        "--markdown",
        join(repo, "report.md"),
      ],
      { encoding: "utf8" },
    );
    const report = JSON.parse(readFileSync(join(repo, "report.json"), "utf8"));
    assert.equal(report.tests.length, 1);
    assert.equal(report.tests[0].selector, "test_app.py::test_value");
    assert.equal(report.summary.changed, 1);
    assert(!("files" in report));
    assert(output.includes("test_app.py::test_value"));
    assert(
      readFileSync(join(repo, "report.md"), "utf8").includes("## Evidence"),
    );
    git("checkout", "--", "app.py");
    assert(
      execFileSync(process.execPath, [cli, "--repo", repo], {
        encoding: "utf8",
      }).includes("No Python changes"),
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
