import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../core/analyzer.mjs";
import { parseDiff, reversePatch } from "../core/diff.mjs";
import { sample } from "../core/sample.mjs";
import { api } from "../core/http.mjs";
import { createApp } from "../standalone/server.mjs";
function scenario(before, after, others = [], path = "app.py") {
  const b = before ? before.trimEnd().split("\n") : [],
    a = after ? after.trimEnd().split("\n") : [];
  return {
    name: "test",
    files: [{ path, content: after }, ...others],
    diff: `--- a/${path}\n+++ b/${path}\n@@ -${b.length ? 1 : 0},${b.length} +${a.length ? 1 : 0},${a.length} @@\n${b.map((s) => "-" + s).join("\n")}\n${a.map((s) => "+" + s).join("\n")}\n`,
  };
}
test("sample finds exact expected impact and excludes unrelated catalog", () => {
  const r = analyze(sample);
  assert.equal(r.summary.changed, 1);
  assert.equal(r.summary.affected, 9);
  assert.equal(r.tests.length, 5);
  assert(!r.tests.some((t) => t.name === "test_catalog"));
  assert.equal(r.summary.warnings, 0);
  assert(r.tests.find((t) => t.name === "test_checkout").path.length === 5);
});
test("patch reconstruction restores before source", () => {
  const c = parseDiff(sample.diff)[0];
  const old = reversePatch(sample.files[0].content, c);
  assert(old.includes("return subtotal - percent"));
  assert(old.includes("def calculate_total"));
});
test("reject mismatched patch", () =>
  assert.throws(
    () =>
      analyze({
        ...sample,
        files: sample.files.map((f, i) =>
          i ? f : { ...f, content: "wrong\n" },
        ),
      }),
    /does not match/,
  ));
test("reject malformed and incomplete diff", () => {
  assert.throws(() => parseDiff("hello"), /No unified/);
  assert.throws(
    () => parseDiff("--- a/x.py\n+++ b/x.py\n@@ -1,2 +1,2 @@\n a\n"),
    /Incomplete/,
  );
});
test("import aliases connect tests", () => {
  const r = analyze(
    scenario("def price():\n return 1\n", "def price():\n return 2\n", [
      {
        path: "test_app.py",
        content:
          "from app import price as p\ndef test_price():\n assert p() == 2\n",
      },
    ]),
  );
  assert.equal(r.tests.length, 1);
});
test("module alias resolves dotted call", () => {
  const r = analyze(
    scenario("def price():\n return 1\n", "def price():\n return 2\n", [
      {
        path: "test_app.py",
        content:
          "import app as service\ndef test_price():\n assert service.price() == 2\n",
      },
    ]),
  );
  assert.equal(r.tests.length, 1);
});
test("relative import resolves package sibling", () => {
  const r = analyze(
    scenario(
      "def price():\n return 1\n",
      "def price():\n return 2\n",
      [
        {
          path: "pkg/test_app.py",
          content:
            "from .app import price\ndef test_price():\n assert price() == 2\n",
        },
      ],
      "pkg/app.py",
    ),
  );
  assert.equal(r.tests.length, 1);
});
test("deleted function keeps old call paths", () => {
  const r = analyze(
    scenario("def gone():\n return 1\n", "", [
      {
        path: "test_app.py",
        content: "from app import gone\ndef test_removed():\n gone()\n",
      },
    ]),
  );
  assert(r.affected.some((n) => n.name === "gone" && n.deleted));
  assert.equal(r.tests.length, 1);
  assert(r.conservative);
});
test("deleted whole file can be reconstructed from diff", () => {
  const x = scenario("def gone():\n return 1\n", "", [
    {
      path: "test_app.py",
      content: "from app import gone\ndef test_removed():\n gone()\n",
    },
  ]);
  x.files = x.files.slice(1);
  x.diff = x.diff
    .replace("+++ b/app.py", "+++ /dev/null")
    .replace("+1,1", "+0,0")
    .replace(/\n\+\n$/, "\n");
  const r = analyze(x);
  assert(r.tests.length === 1);
});
test("recursion terminates graph walk", () => {
  const r = analyze(
    scenario(
      "def loop():\n return loop()\n",
      "def loop():\n return loop() + 1\n",
    ),
  );
  assert.equal(r.affected.length, 1);
});
test("parameter shadows global callable", () => {
  const r = analyze(
    scenario("def price():\n return 1\n", "def price():\n return 2\n", [
      {
        path: "test_app.py",
        content: "from app import price\ndef test_shadow(price):\n price()\n",
      },
    ]),
  );
  assert.equal(r.tests.length, 0);
  assert(r.diagnostics.some((d) => d.message.includes("parameter")));
  assert(r.conservative);
});
test("fixture dependencies are explicit uncertainty", () => {
  const r = analyze(
    scenario("def price():\n return 1\n", "def price():\n return 2\n", [
      {
        path: "test_app.py",
        content: "def test_db(database):\n assert database\n",
      },
    ]),
  );
  assert(r.diagnostics.some((d) => d.message.includes("fixtures")));
});
test("self calls resolve same class method", () => {
  const x = scenario(
    "class A:\n def inner(self):\n  return 1\n def outer(self):\n  return self.inner()\n",
    "class A:\n def inner(self):\n  return 2\n def outer(self):\n  return self.inner()\n",
  );
  const r = analyze(x);
  assert(
    r.edges.some(
      (e) => e.from === "app.py::A.outer" && e.to === "app.py::A.inner",
    ),
  );
});
test("nested lexical calls resolve", () => {
  const r = analyze(
    scenario(
      "def outer():\n def inner():\n  return 1\n return inner()\n",
      "def outer():\n def inner():\n  return 2\n return inner()\n",
    ),
  );
  assert(
    r.edges.some(
      (e) => e.from === "app.py::outer" && e.to === "app.py::outer.inner",
    ),
  );
});
test("module-level change conservatively includes importers", () => {
  const x = {
    files: [
      { path: "app.py", content: "RATE = 2\ndef price():\n return RATE\n" },
      {
        path: "test_app.py",
        content: "from app import price\ndef test_price():\n assert price()\n",
      },
    ],
    diff: "--- a/app.py\n+++ b/app.py\n@@ -1 +1 @@\n-RATE = 1\n+RATE = 2\n",
  };
  const r = analyze(x);
  assert(r.conservative);
  assert.equal(r.tests.length, 1);
});
test("syntax recovery and dynamic calls produce diagnostics", () => {
  const r = analyze(
    scenario("def x():\n return 1\n", "def x():\n return obj.method()\n"),
  );
  assert(r.diagnostics.some((d) => d.kind === "Unresolved"));
});
test("path traversal and duplicate files are rejected", () => {
  assert.throws(
    () => analyze({ ...sample, files: [{ path: "../bad.py", content: "" }] }),
    /relative/,
  );
  assert.throws(
    () => analyze({ ...sample, files: [sample.files[0], sample.files[0]] }),
    /Duplicate/,
  );
});
test("file and size bounds apply", () => {
  assert.throws(
    () =>
      analyze({
        ...sample,
        files: Array.from({ length: 81 }, (_, i) => ({
          path: i + ".py",
          content: "",
        })),
      }),
    /1–80/,
  );
  assert.throws(
    () =>
      analyze({
        ...sample,
        files: [{ path: "a.py", content: "x".repeat(600001) }],
      }),
    /600 KB/,
  );
});
test("HTTP API returns useful errors and rejects cross-origin POST", async () => {
  const r = await api(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      body: "bad",
    }),
  );
  assert.equal(r.status, 400);
  const x = await api(
    new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { origin: "https://other.example" },
      body: JSON.stringify(sample),
    }),
  );
  assert.equal(x.status, 403);
});
test("standalone server serves frontend and analyzes real HTTP requests", async () => {
  const server = createApp();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const url = "http://127.0.0.1:" + server.address().port;
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert((await page.text()).includes("ChangeScope"));
    const r = await fetch(url + "/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).tests.length, 5);
    assert.equal((await fetch(url + "/api/nope")).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("standalone HTTPS proxy honors opt-in and rejects foreign origin", async () => {
  const server = createApp({ trustProxy: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const url = "http://127.0.0.1:" + server.address().port;
    for (const [origin, status] of [
      ["https://127.0.0.1:" + server.address().port, 200],
      ["https://foreign.example", 403],
    ]) {
      const r = await fetch(url + "/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-proto": "https",
          origin,
        },
        body: JSON.stringify(sample),
      });
      assert.equal(r.status, status);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("an incomplete hunk cannot be hidden by another file header", () =>
  assert.throws(
    () =>
      parseDiff(
        "--- a/x.py\n+++ b/x.py\n@@ -1,2 +1,2 @@\n a\ndiff --git a/y.py b/y.py\n--- a/y.py\n+++ b/y.py\n@@ -1 +1 @@\n-a\n+b\n",
      ),
    /Incomplete/,
  ));
test("reject deletion positioned beyond end of current source", () => {
  const change = parseDiff(
    "--- a/x.py\n+++ b/x.py\n@@ -99 +99,0 @@\n-gone\n",
  )[0];
  assert.throws(() => reversePatch("ok\n", change), /does not match/);
});
