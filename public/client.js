"use strict";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let result = null,
  input = null,
  view = "overview",
  selected = null,
  uploaded = [],
  sampleMode = true,
  busy = false,
  zoom = 1,
  filter = "",
  allGraph = false;
const icon = { changed: "±", affected: "⌘", tests: "✓", warnings: "◉" };
const pretty = (id) => id?.split("::")[1] || id;
const tag = (text, kind = "neutral") =>
  `<span class="tag ${kind}">${esc(text)}</span>`;
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.add("hidden"), 3500);
}
function download(content, name, type) {
  const u = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
async function copy(t) {
  if (!t) {
    toast("No command available.");
    return;
  }
  try {
    await navigator.clipboard.writeText(t);
    toast("Copied to clipboard");
  } catch {
    toast("Clipboard unavailable. Select and copy the command shown.");
  }
}
function setBusy(value) {
  busy = value;
  $("#analyze-button").disabled = value;
  $("#analyze-button").textContent = value ? "Analyzing…" : "Analyze change →";
  document
    .querySelectorAll('[data-action="refresh"],[data-action="sample"]')
    .forEach((b) => (b.disabled = value));
}
async function run(payload, isSample = false) {
  if (busy) return;
  setBusy(true);
  $("#error-banner").classList.add("hidden");
  $("#upload-error").textContent = "";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed");
    result = data;
    input = payload;
    sampleMode = isSample;
    view = "overview";
    selected = result.affected[0]?.id || result.nodes[0]?.id;
    filter = "";
    zoom = 1;
    $("#upload-dialog").close();
    render();
  } catch (e) {
    $("#upload-error").textContent = e.message;
    $("#error-banner").textContent = e.message;
    $("#error-banner").classList.remove("hidden");
    if (!result)
      $("#content").innerHTML =
        '<div class="empty"><h2>Could not complete analysis.</h2><p>Check the error above, then retry or choose a project.</p><button class="primary" data-action="sample">Retry example</button></div>';
  } finally {
    setBusy(false);
  }
}
async function loadSample() {
  if (busy) return;
  try {
    const r = await fetch("/api/sample");
    if (!r.ok) throw new Error("Could not load example");
    const data = await r.json();
    await run(data, true);
  } catch (e) {
    $("#error-banner").textContent = e.message;
    $("#error-banner").classList.remove("hidden");
  }
}
function stats() {
  const s = result.summary;
  return `<div class="stats">${[
    [
      "changed",
      "Changed functions",
      s.changed,
      "Directly touched by this diff",
    ],
    [
      "affected",
      "Affected functions",
      s.affected,
      "Including callers and tests",
    ],
    ["tests", "Suggested tests", s.tests, `of ${s.totalTests} detected tests`],
    [
      "warnings",
      "Analysis warnings",
      s.warnings,
      s.warnings
        ? "Review before relying on results"
        : "No unresolved calls detected",
    ],
  ]
    .map(
      ([key, title, value, note]) =>
        `<div class="stat"><div class="stat-label">${title}<span class="stat-icon ${key}">${icon[key]}</span></div><div class="stat-value">${value}<span>${key === "tests" ? "tests" : key === "warnings" ? "flags" : "functions"}</span></div><div class="stat-note">${key === "warnings" && !s.warnings ? '<i class="green-dot"></i>' : ""}${note}</div></div>`,
    )
    .join("")}</div>`;
}
function graphMarkup(full = false) {
  const affected = new Map(result.affected.map((n) => [n.id, n])),
    base = allGraph ? result.nodes : result.affected;
  const nodes = base
    .filter((n) => !filter || n.id.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, full ? 60 : 24);
  const groups = [[], [], []];
  for (const n of nodes)
    groups[n.isTest ? 2 : affected.get(n.id)?.direct ? 0 : 1].push(n);
  const w = full ? 860 : 690,
    spacing = (w - 230) / 2,
    height = Math.max(240, Math.max(...groups.map((g) => g.length)) * 64 + 65),
    positions = new Map();
  groups.forEach((g, col) =>
    g.forEach((n, i) =>
      positions.set(n.id, { x: 24 + col * spacing, y: 50 + i * 64 }),
    ),
  );
  const pathIds = new Set(affected.get(selected)?.path || []);
  const lines = result.edges
    .filter((e) => positions.has(e.from) && positions.has(e.to))
    .map((e) => {
      const a = positions.get(e.to),
        b = positions.get(e.from),
        highlight = pathIds.has(e.from) && pathIds.has(e.to);
      if (e.from === e.to) return "";
      return `<path d="M ${a.x + 180} ${a.y + 23} C ${a.x + 220} ${a.y + 23}, ${b.x - 38} ${b.y + 23}, ${b.x} ${b.y + 23}" fill="none" stroke="${highlight ? "#8c73e8" : "#dce1e9"}" stroke-width="${highlight ? 2 : 1.3}" marker-end="url(#arrow-${full ? "big" : "small"})"/>`;
    })
    .join("");
  return `<div class="graph-scroll ${full ? "graph-full" : ""}"><div class="graph-canvas" style="width:${w * zoom}px;height:${height * zoom}px"><div class="graph-inner" style="width:${w}px;height:${height}px;transform:scale(${zoom})"><div class="graph-columns"><span>CHANGED</span><span>CALLERS</span><span>TESTS</span></div><svg width="${w}" height="${height}" aria-hidden="true"><defs><marker id="arrow-${full ? "big" : "small"}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b2a4da"/></marker></defs>${lines}</svg>${nodes
    .map((n) => {
      const p = positions.get(n.id),
        direct = affected.get(n.id)?.direct;
      return `<button class="graph-node ${n.isTest ? "test-node" : direct ? "changed-node" : ""} ${selected === n.id ? "node-selected" : ""} ${pathIds.has(n.id) ? "in-path" : ""}" data-node="${esc(n.id)}" style="left:${p.x}px;top:${p.y}px" title="${esc(n.id)}"><span class="node-icon">${n.isTest ? "✓" : "ƒ"}</span><div><strong>${esc(n.name)}</strong><small>${esc(n.file.split("/").at(-1))}${n.deleted ? " · removed" : ""}</small></div></button>`;
    })
    .join(
      "",
    )}${!nodes.length ? '<div class="graph-empty">No matching functions.</div>' : ""}</div></div></div><div class="graph-footer"><div class="legend"><span><i class="purple"></i>Direct change</span><span><i></i>Caller</span><span><i class="green"></i>Test</span></div><span>Impact flows → · ${nodes.length}/${base.length} shown</span></div>`;
}
function evidencePanel() {
  const n =
    result.affected.find((n) => n.id === selected) ||
    result.nodes.find((n) => n.id === selected);
  if (!n)
    return '<div class="empty">Select a function to inspect its path.</div>';
  const p = n.path || [];
  return `<div class="evidence"><span class="eyebrow">WHY THIS FUNCTION?</span><h3>${esc(n.name)}</h3><div class="evidence-file">${esc(n.file)}:${n.start}</div>${tag(n.direct ? "Direct change" : n.isTest ? "Suggested test" : n.path ? "Transitive caller" : "No resolved impact", n.direct ? "purple" : n.isTest ? "green" : "neutral")}<p>${n.direct ? "This function contains edited lines or is conservatively included by a module-level change." : p.length ? "A resolved call path connects this function to the change." : "No resolved path to a change was found. Dynamic dependencies may still exist."}</p><div class="path-list">${[
    ...p,
  ]
    .reverse()
    .map(
      (id, i) =>
        `<div><span>${i + 1}</span><button data-node="${esc(id)}">${esc(pretty(id))}</button>${i === 0 ? "<small>changed</small>" : ""}</div>`,
    )
    .join(
      "",
    )}</div>${!n.deleted ? `<button class="secondary full" data-source="${esc(n.id)}">View source <span>↗</span></button>` : '<div class="notice">Removed in the current version. Inspect the diff for previous source.</div>'}</div>`;
}
function overview() {
  const s = result.summary;
  return `${stats()}<div class="analysis-banner"><span class="check-ring">✓</span><div><strong>Analysis complete. Here’s the ripple effect.</strong><p>${s.changed} changed ${s.changed === 1 ? "function" : "functions"} → ${Math.max(0, s.affected - s.changed)} downstream functions · ${s.tests} suggested tests</p></div><span class="time-badge">${s.elapsedMs} ms</span><button class="link-button" data-action="export-md">Export report ↗</button></div><div class="overview-grid"><section class="panel graph-panel"><div class="panel-heading"><div><h2>Impact at a glance</h2><p>Click a function to follow its dependencies.</p></div><button class="small-button" data-view="graph">Explore graph ↗</button></div>${graphMarkup()}<div class="graph-caption">Includes dependencies from both source versions. ${result.conservative ? "Warnings require broader test coverage." : "Static reachability does not prove test completeness."}</div></section><section class="panel test-preview"><div class="panel-heading"><div><h2>Your test plan</h2><p>A starting point, backed by call paths.</p></div><span class="soft-icon">✓</span></div><div class="test-list">${
    result.tests
      .slice(0, 5)
      .map(
        (t) =>
          `<button class="test-item" data-test="${esc(t.id)}"><span class="test-check">✓</span><div><strong>${esc(t.name)}</strong><small>${esc(t.file)}</small></div><span>↗</span></button>`,
      )
      .join("") ||
    '<div class="empty small">No reachable tests found. Run the full suite and review coverage.</div>'
  }</div><div class="test-preview-footer"><span>${s.tests} suggested / ${s.totalTests} detected</span><button class="secondary full" data-view="tests">Review test plan <span>→</span></button></div></section></div><section class="panel affected-panel"><div class="panel-heading"><div><h2>What’s affected</h2><p>From the lines you edited to the functions that depend on them.</p></div><button class="link-button" data-view="changes">View diff ↗</button></div>${affectedTable(result.affected.slice(0, 8))}${result.affected.length > 8 ? `<button class="table-more" data-view="graph">Explore all ${result.affected.length} affected functions →</button>` : ""}</section>`;
}
function affectedTable(nodes) {
  return `<div class="table-scroll"><table><thead><tr><th>FUNCTION</th><th>FILE</th><th>IMPACT</th><th>DEPTH</th><th></th></tr></thead><tbody>${nodes.map((n) => `<tr><td><span class="function-icon">${n.isTest ? "✓" : "ƒ"}</span><button class="function-link" data-node="${esc(n.id)}">${esc(n.qual)}</button>${n.deleted ? ' <span class="removed-label">removed</span>' : ""}</td><td class="mono muted">${esc(n.file)}</td><td>${tag(n.direct ? "Direct" : n.isTest ? "Test" : "Transitive", n.direct ? "purple" : n.isTest ? "green" : "neutral")}</td><td class="mono depth">${n.depth ?? "—"}</td><td><button class="icon-button" data-source="${esc(n.id)}" aria-label="View source for ${esc(n.name)}">↗</button></td></tr>`).join("") || '<tr><td colspan="5">No affected functions found.</td></tr>'}</tbody></table></div>`;
}
function graphView() {
  return `<div class="section-title"><div><h2>Follow every connection.</h2><p>Changed functions, their callers and the tests that reach them.</p></div><div class="button-row"><button class="secondary" data-action="export-json">Export JSON ↓</button></div></div><div class="graph-toolbar"><label class="search-field"><span>⌕</span><input id="graph-search" placeholder="Filter functions or files…" value="${esc(filter)}"></label><label class="toggle-label"><input id="all-graph" type="checkbox" ${allGraph ? "checked" : ""}> Include unaffected</label><div class="zoom-controls"><button data-action="zoom-out" aria-label="Zoom out">−</button><span>${Math.round(zoom * 100)}%</span><button data-action="zoom-in" aria-label="Zoom in">＋</button><button data-action="zoom-reset">Reset</button></div></div><div class="graph-layout"><section class="panel graph-panel">${graphMarkup(true)}</section><aside class="panel">${evidencePanel()}</aside></div><section class="panel affected-panel"><div class="panel-heading"><h2>All affected functions <span class="count-badge">${result.affected.length}</span></h2></div>${affectedTable(result.affected.filter((n) => n.id.toLowerCase().includes(filter.toLowerCase())))}</section>`;
}
function changesView() {
  return `<div class="section-title"><div><h2>The change, in context.</h2><p>Validated against your uploaded current source.</p></div><button class="secondary" data-action="export-diff">Download diff ↓</button></div>${result.changes
    .map((c) => {
      let rows = "";
      for (const h of c.hunks) {
        let o = h.oldStart,
          n = h.newStart;
        rows += `<div class="diff-hunk">@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@</div>`;
        for (const l of h.lines) {
          const add = l[0] === "+",
            del = l[0] === "-";
          rows += `<div class="diff-line ${add ? "added" : del ? "deleted" : ""}"><span>${add ? "" : o++}</span><span>${del ? "" : n++}</span><code>${esc(l)}</code></div>`;
        }
      }
      return `<section class="panel diff-panel"><div class="panel-heading"><strong class="mono">${esc(c.path || c.oldPath)}${c.path && c.oldPath && c.path !== c.oldPath ? " ← " + esc(c.oldPath) : ""}</strong><div class="button-row">${tag("+" + c.lines.current.length, "green")}${tag("−" + c.lines.old.length, "red")}</div></div><div class="diff-code">${rows}</div></section>`;
    })
    .join(
      "",
    )}<div class="notice"><span>ⓘ</span>Edits outside functions are treated conservatively as module-level changes. ${result.moduleChanges.length ? esc(result.moduleChanges.join(", ")) : "No module-level changes in this analysis."}</div>`;
}
function testsView() {
  return `<div class="section-title"><div><h2>Test with a reason.</h2><p>Every suggestion links back to the changed code.</p></div><button class="secondary" data-action="export-md">Export report ↓</button></div><div class="notice ${result.conservative ? "amber" : ""}"><span>${result.conservative ? "⚠" : "ⓘ"}</span>${result.conservative ? "Unresolved behavior or module changes were detected. Run the complete test suite; the focused plan is incomplete." : "These are statically reachable tests, not a guarantee of complete coverage. Run the full suite before release."}</div><section class="panel command-panel"><div><span class="eyebrow">FOCUSED TEST COMMAND</span><p>Run this from your repository root after reviewing the plan.</p></div><div class="command"><code>${esc(result.command || "# No statically reachable tests. Run your full suite.")}</code><button class="small-button" data-action="copy-command">Copy</button></div><div class="command-secondary"><span>Full suite:</span><code>python -m pytest</code><button class="link-button" data-action="copy-full">Copy ↗</button></div></section><div class="test-plan-list">${
    result.tests
      .map(
        (t, i) =>
          `<section class="panel test-plan-card"><div class="test-plan-top"><span class="test-check">✓</span><div><h3>${esc(t.name)}</h3><span class="mono muted">${esc(t.selector)}</span></div><button class="secondary" data-source="${esc(t.id)}">Source ↗</button></div><div class="path-chips">${[
            ...t.path,
          ]
            .reverse()
            .map(
              (id, j) =>
                `${j ? "<span>→</span>" : ""}<button data-node="${esc(id)}" class="${j === 0 ? "changed-chip" : ""}">${esc(pretty(id))}</button>`,
            )
            .join("")}</div></section>`,
      )
      .join("") ||
    '<div class="empty"><span class="empty-icon">✓</span><h2>No tests linked to this change.</h2><p>This may indicate missing tests, missing source files or dependencies outside the supported analysis.</p></div>'
  }</div>`;
}
function diagnosticsView() {
  return `<div class="section-title"><div><h2>Know the blind spots.</h2><p>Explicit uncertainty makes a better test plan.</p></div>${tag(result.summary.warnings + " warnings", result.summary.warnings ? "amber" : "green")}</div>${result.diagnostics.length ? `<section class="panel"><div class="diagnostic-list">${result.diagnostics.map((d) => `<div class="diagnostic"><span class="warning-icon">!</span><div>${tag(d.kind, "amber")}<p>${esc(d.message)}</p><small class="mono">${esc(d.file)}:${d.line} · ${esc(d.version)} source</small></div></div>`).join("")}</div>${result.diagnosticsTruncated ? '<p class="notice">Showing the first 250 diagnostics. Analyze a smaller package for the full detail.</p>' : ""}</section>` : '<div class="panel clean-state"><span class="check-ring">✓</span><h2>No unresolved calls detected.</h2><p>The analyzed code fits the supported resolution rules. This does not establish that the project has no hidden dependencies.</p></div>'}<div class="limits-grid">${[
    [
      "Static, not runtime",
      "Runtime dispatch, fixtures and monkey-patching may create paths that cannot be resolved here.",
    ],
    [
      "Bounded project view",
      "Only uploaded files are visible. External packages and omitted modules may add dependencies.",
    ],
    [
      "Conservative fallback",
      "Module edits include importers. Unresolved or recovered syntax means you should run the complete suite.",
    ],
  ]
    .map(
      ([t, p]) =>
        `<div class="panel"><span class="soft-icon">◈</span><h3>${t}</h3><p>${p}</p></div>`,
    )
    .join("")}</div>`;
}
function render() {
  if (!result) return;
  $("#project-name").textContent = result.project;
  $("#project-files").textContent = result.summary.files + " files";
  $("#sample-label").textContent = sampleMode
    ? "Example project"
    : "Uploaded project";
  $("#graph-count").textContent = result.summary.affected;
  $("#warning-count").textContent = result.summary.warnings;
  $("#breadcrumb").textContent = {
    overview: "Overview",
    graph: "Impact graph",
    changes: "Code changes",
    tests: "Test plan",
    diagnostics: "Diagnostics",
  }[view];
  document
    .querySelectorAll(".nav[data-view]")
    .forEach((n) => n.classList.toggle("active", n.dataset.view === view));
  $("#content").innerHTML = {
    overview,
    graph: graphView,
    changes: changesView,
    tests: testsView,
    diagnostics: diagnosticsView,
  }[view]();
}
function report() {
  return `# ChangeScope — ${result.project}\n\n${result.summary.changed} changed functions; ${result.summary.affected} affected functions; ${result.summary.tests} suggested tests.\n\n## Focused command\n\n\`\`\`sh\n${result.command || "python -m pytest"}\n\`\`\`\n\nRun the full suite before release: python -m pytest\n\n## Evidence\n\n${result.tests.map((t) => "- " + t.selector + "\n  Path: " + [...t.path].reverse().join(" → ")).join("\n")}\n\n## Diagnostics\n\n${result.diagnostics.map((d) => "- " + d.file + ":" + d.line + " " + d.message).join("\n") || "No diagnostics in the supported scope."}\n\n## Limits\n\n${result.limitations.map((l) => "- " + l).join("\n")}\n`;
}
function showSource(id) {
  const n = result.nodes.find((n) => n.id === id);
  if (!n) return;
  const f = result.files.find((f) => f.path === n.file);
  if (!f || n.deleted) {
    view = "changes";
    render();
    return;
  }
  $("#source-title").textContent = n.file + " · " + n.qual;
  const lines = f.content.split("\n");
  $("#source-code").innerHTML = lines
    .map(
      (line, i) =>
        `<span class="source-line ${i + 1 >= n.start && i + 1 <= n.end ? "source-highlight" : ""}"><b>${i + 1}</b>${esc(line)}</span>`,
    )
    .join("");
  $("#source-dialog").showModal();
  $(".source-highlight")?.scrollIntoView({ block: "center" });
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-close")) {
    b.closest("dialog").close();
    return;
  }
  if (b.dataset.view) {
    view = b.dataset.view;
    filter = "";
    render();
    return;
  }
  if (b.dataset.node) {
    selected = b.dataset.node;
    view = "graph";
    render();
    return;
  }
  if (b.dataset.test) {
    selected = b.dataset.test;
    view = "graph";
    render();
    return;
  }
  if (b.dataset.source) {
    showSource(b.dataset.source);
    return;
  }
  const a = b.dataset.action;
  if (a === "upload") {
    $("#upload-dialog").showModal();
    return;
  }
  if (a === "guide") {
    $("#guide-dialog").showModal();
    return;
  }
  if (a === "sample") {
    loadSample();
    return;
  }
  if (a === "refresh" && input) {
    await run(input, sampleMode);
    return;
  }
  if (!result) return;
  if (a === "copy-command") copy(result.command);
  if (a === "copy-full") copy("python -m pytest");
  if (a === "export-json") {
    const { files, ...withoutSource } = result;
    download(
      JSON.stringify(withoutSource, null, 2),
      "changescope-report.json",
      "application/json",
    );
  }
  if (a === "export-md") {
    $("#report-text").value = report();
    $("#report-dialog").showModal();
  }
  if (a === "download-md")
    download(report(), "changescope-report.md", "text/plain;charset=utf-8");
  if (a === "copy-report") copy(report());
  if (a === "export-diff")
    download(input.diff, "changescope.patch", "text/plain");
  if (a === "zoom-in" || a === "zoom-out" || a === "zoom-reset") {
    zoom =
      a === "zoom-reset"
        ? 1
        : Math.max(0.5, Math.min(1.5, zoom + (a === "zoom-in" ? 0.1 : -0.1)));
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "graph-search") {
    const pos = e.target.selectionStart;
    filter = e.target.value;
    render();
    const el = $("#graph-search");
    el.focus();
    el.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "all-graph") {
    allGraph = e.target.checked;
    render();
  }
});
$("#folder-button").addEventListener("click", () => $("#folder-input").click());
$("#files-button").addEventListener("click", () => $("#files-input").click());
$("#patch-button").addEventListener("click", () => $("#patch-input").click());
async function chooseFiles(list) {
  try {
    const candidates = [...list].filter(
      (f) =>
        f.name.endsWith(".py") &&
        !/(^|\/)(\.git|\.venv|venv|node_modules|__pycache__)(\/|$)/.test(
          f.webkitRelativePath || f.name,
        ),
    );
    if (!candidates.length) throw new Error("Select at least one Python file.");
    if (
      candidates.length > 80 ||
      candidates.reduce((n, f) => n + f.size, 0) > 600000
    )
      throw new Error("Use up to 80 .py files and 600 KB total.");
    uploaded = await Promise.all(
      candidates.map(async (f) => ({
        path: f.webkitRelativePath
          ? f.webkitRelativePath.split("/").slice(1).join("/")
          : f.name,
        content: await f.text(),
      })),
    );
    $("#upload-status").textContent =
      `✓ ${uploaded.length} Python files ready · ${Math.ceil(candidates.reduce((n, f) => n + f.size, 0) / 1024)} KB`;
    $("#upload-error").textContent = "";
    if (candidates[0].webkitRelativePath)
      $("#analysis-name").value =
        candidates[0].webkitRelativePath.split("/")[0];
  } catch (e) {
    $("#upload-error").textContent = e.message;
  }
}
$("#folder-input").addEventListener("change", (e) =>
  chooseFiles(e.target.files),
);
$("#files-input").addEventListener("change", (e) =>
  chooseFiles(e.target.files),
);
$("#dropzone").addEventListener("dragover", (e) => {
  e.preventDefault();
  $("#dropzone").classList.add("dragover");
});
$("#dropzone").addEventListener("dragleave", () =>
  $("#dropzone").classList.remove("dragover"),
);
$("#dropzone").addEventListener("drop", (e) => {
  e.preventDefault();
  $("#dropzone").classList.remove("dragover");
  chooseFiles(e.dataTransfer.files);
});
$("#patch-input").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 600000) {
    $("#upload-error").textContent = "Diff exceeds 600 KB.";
    return;
  }
  $("#diff-input").value = await f.text();
});
$("#analyze-button").addEventListener("click", () => {
  if (!uploaded.length) {
    $("#upload-error").textContent = "Choose your Python files first.";
    return;
  }
  run({
    name: $("#analysis-name").value || "Python project",
    files: uploaded,
    diff: $("#diff-input").value,
  });
});
for (const d of document.querySelectorAll("dialog"))
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  });
loadSample();
