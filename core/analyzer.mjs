import { parser } from "@lezer/python";
import { parseDiff, reversePatch, changedLines } from "./diff.mjs";
export const LIMITS = { files: 80, bytes: 600000, symbols: 1200 };
const builtins = new Set(
  "abs all any bool bytes callable chr dict enumerate filter float format frozenset getattr hasattr hash int isinstance issubclass iter len list map max min next object open ord pow print range repr reversed round set setattr slice sorted str sum super tuple type zip Exception ValueError RuntimeError KeyError TypeError AssertionError".split(
    " ",
  ),
);
const children = (n) => {
  const out = [];
  for (let c = n.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
};
const mod = (p) =>
  p
    .replace(/\.py$/, "")
    .replace(/\/__init__$/, "")
    .replaceAll("/", ".");
function normalizePath(p) {
  if (
    typeof p !== "string" ||
    p.length > 200 ||
    p.startsWith("/") ||
    p.includes("\\") ||
    p.split("/").some((x) => !x || x === "." || x === "..") ||
    !p.endsWith(".py") ||
    /[\x00-\x1f]/.test(p)
  )
    throw new Error(
      "Use relative .py paths without traversal, backslashes or control characters.",
    );
  return p;
}
function index(files, version) {
  const nodes = [],
    calls = [],
    imports = new Map(),
    diagnostics = [],
    modules = new Map();
  for (const f of files) {
    const source = f.content,
      tree = parser.parse(source),
      offsets = [0];
    for (let i = 0; i < source.length; i++)
      if (source[i] === "\n") offsets.push(i + 1);
    const line = (p) => {
      let a = 0,
        b = offsets.length;
      while (a < b) {
        const m = (a + b) >> 1;
        if (offsets[m] <= p) a = m + 1;
        else b = m;
      }
      return a;
    };
    const module = mod(f.path),
      aliases = new Map(),
      deps = new Set();
    modules.set(f.path, { module, deps });
    imports.set(f.path, aliases);
    const text = (n) => source.slice(n.from, n.to);
    const warn = (node, message) =>
      diagnostics.push({
        file: f.path,
        line: line(node.from),
        kind: "Uncertain",
        message,
        version,
      });
    function visit(node, scope = [], owner = null, cls = null, depth = 0) {
      if (depth > 150)
        throw new Error("Python nesting exceeds the analysis limit.");
      if (node.type.isError) {
        diagnostics.push({
          file: f.path,
          line: line(node.from),
          kind: "Syntax",
          message:
            "Parser recovery at this position. Review syntax before trusting the graph.",
          version,
        });
        return;
      }
      if (node.name === "ClassDefinition") {
        if (node.getChild("ArgList"))
          warn(node, "Inheritance may change method dispatch.");
        const name = node.getChild("VariableName");
        const body = node.getChild("Body");
        if (body)
          visit(body, [...scope, text(name)], owner, text(name), depth + 1);
        return;
      }
      if (node.name === "FunctionDefinition") {
        const name = text(node.getChild("VariableName")),
          qual = [...scope, name].join("."),
          id = f.path + "::" + qual;
        const params = node.getChild("ParamList");
        const shadow = new Set(
          params
            ? children(params)
                .filter((n) => n.name === "VariableName")
                .map(text)
            : [],
        );
        const n = {
          id,
          file: f.path,
          name,
          qual,
          start: line(node.from),
          end: line(Math.max(node.from, node.to - 1)),
          isTest:
            /(^|\/)(test_[^/]*|[^/]*_test)\.py$/.test(f.path) &&
            name.startsWith("test_") &&
            (scope.length === 0 ||
              (scope.length === 1 && cls?.startsWith("Test"))),
          version,
          cls,
          scope,
          shadow,
        };
        nodes.push(n);
        if (n.isTest && [...shadow].some((p) => !["self", "cls"].includes(p)))
          warn(
            node,
            "Test parameters may depend on fixtures not resolved by the call graph.",
          );
        if (params && text(params).includes("=")) {
          if (children(params).some((p) => p.name === "CallExpression"))
            warn(
              node,
              "Default argument expressions may add definition-time dependencies.",
            );
        }
        if (nodes.length > LIMITS.symbols)
          throw new Error(
            "Too many symbols; analyze a smaller package (maximum 1,200 functions).",
          );
        const body = node.getChild("Body");
        if (body) visit(body, [...scope, name], n, cls, depth + 1);
        return;
      }
      if (node.name === "ImportStatement") {
        if (owner) {
          warn(
            node,
            "Function-local imports require conservative test selection.",
          );
          return;
        }
        let s = text(node).replace(/\s+/g, " ").replace(/[()]/g, "");
        const from = s.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
        if (from) {
          let modulePath = from[1];
          if (modulePath.startsWith(".")) {
            const dots = modulePath.match(/^\.+/)[0].length;
            const base = f.path.endsWith("/__init__.py")
              ? module.split(".")
              : module.split(".").slice(0, -1);
            modulePath = [
              ...base.slice(0, Math.max(0, base.length - dots + 1)),
              modulePath.slice(dots),
            ]
              .filter(Boolean)
              .join(".");
          }
          deps.add(modulePath);
          for (const part of from[2].split(",")) {
            const a = part.trim().match(/^(\w+)(?:\s+as\s+(\w+))?$/);
            if (a) aliases.set(a[2] || a[1], modulePath + "." + a[1]);
            else if (part.trim())
              warn(
                node,
                "Wildcard or unsupported import cannot be resolved precisely.",
              );
          }
        } else if (s.startsWith("import ")) {
          for (const p of s.slice(7).split(",")) {
            const a = p.trim().match(/^([\w.]+)(?:\s+as\s+(\w+))?$/);
            if (a) {
              deps.add(a[1]);
              aliases.set(
                a[2] || a[1].split(".")[0],
                a[2] ? a[1] : a[1].split(".")[0],
              );
            }
          }
        }
        return;
      }
      if (
        ["DecoratedStatement", "Decorator", "LambdaExpression"].includes(
          node.name,
        )
      )
        warn(
          node,
          "Decorators and dynamic callable behavior may add dependencies not visible to static analysis.",
        );
      if (node.name === "AssignStatement" && owner) {
        const lhs = node.firstChild;
        if (lhs?.name === "VariableName") owner.shadow.add(text(lhs));
      }
      if (node.name === "CallExpression") {
        const callee = node.firstChild,
          expr = text(callee).replace(/\s+/g, "");
        if (owner)
          calls.push({
            from: owner.id,
            expr,
            line: line(node.from),
            file: f.path,
            owner,
          });
        else if (!builtins.has(expr))
          warn(node, "Module-level call may affect initialization: " + expr);
      }
      for (const c of children(node)) visit(c, scope, owner, cls, depth + 1);
    }
    visit(tree.topNode);
  }
  const byId = new Map(nodes.map((n) => [n.id, n])),
    global = new Map();
  for (const n of nodes) {
    const key = mod(n.file) + "." + n.qual;
    if (!global.has(key)) global.set(key, []);
    global.get(key).push(n);
  }
  const edges = [];
  for (const c of calls) {
    const parts = c.expr.split("."),
      alias = imports.get(c.file);
    let target = null,
      reason = "";
    if (c.owner.shadow.has(parts[0]) && !["self", "cls"].includes(parts[0])) {
      reason = "Callable is a parameter or reassigned local.";
    } else if (parts.length === 1) {
      const lexical = c.owner.qual.split(".");
      for (let i = lexical.length; i >= 0 && !target; i--)
        target = byId.get(
          c.file + "::" + [...lexical.slice(0, i), c.expr].join("."),
        );
      if (!target && alias.has(c.expr)) {
        const candidates = global.get(alias.get(c.expr));
        if (candidates?.length === 1) target = candidates[0];
      }
      if (!target && builtins.has(c.expr)) continue;
    } else if (
      ["self", "cls"].includes(parts[0]) &&
      c.owner.cls &&
      parts.length === 2
    ) {
      const parent = c.owner.scope;
      target = byId.get(c.file + "::" + [...parent, parts[1]].join("."));
    } else {
      const resolved = alias.has(parts[0])
        ? [alias.get(parts[0]), ...parts.slice(1)].join(".")
        : mod(c.file) + "." + c.expr;
      const candidates = global.get(resolved);
      if (candidates?.length === 1) target = candidates[0];
    }
    if (target)
      edges.push({ from: c.from, to: target.id, line: c.line, version });
    else
      diagnostics.push({
        file: c.file,
        line: c.line,
        kind: "Unresolved",
        message: `${c.expr}: ${reason || "Dynamic, external, or missing from the uploaded project."}`,
        version,
      });
  }
  return {
    nodes: nodes.map(({ shadow, scope, cls, ...n }) => n),
    edges,
    diagnostics,
    modules,
  };
}
export function analyze(input) {
  const started = performance.now();
  if (
    !input ||
    !Array.isArray(input.files) ||
    !input.files.length ||
    input.files.length > LIMITS.files
  )
    throw new Error("Upload 1–80 Python files.");
  const seen = new Set();
  let bytes = 0;
  const files = input.files.map((f) => {
    const path = normalizePath(f.path);
    if (seen.has(path)) throw new Error("Duplicate path: " + path);
    seen.add(path);
    if (typeof f.content !== "string")
      throw new Error("File contents must be text.");
    bytes += new TextEncoder().encode(f.content).length;
    return { path, content: f.content.replace(/\r\n/g, "\n") };
  });
  if (bytes > LIMITS.bytes)
    throw new Error("Project exceeds 600 KB. Analyze a smaller package.");
  const changes = parseDiff(input.diff);
  if (changes.length > 80) throw new Error("Diff contains too many files.");
  const before = new Map(files.map((f) => [f.path, f.content])),
    after = new Map(files.map((f) => [f.path, f.content]));
  for (const f of changes) {
    if (f.path) normalizePath(f.path);
    if (f.oldPath) normalizePath(f.oldPath);
    if (f.path && !after.has(f.path))
      throw new Error("Upload current source for " + f.path);
    const old = reversePatch(f.path ? after.get(f.path) : "", f);
    if (f.path) before.delete(f.path);
    if (f.oldPath) before.set(f.oldPath, old);
  }
  const old = index(
      [...before].map(([path, content]) => ({ path, content })),
      "before",
    ),
    current = index(files, "current");
  const nodes = new Map(old.nodes.map((n) => [n.id, { ...n, deleted: true }]));
  for (const n of current.nodes) nodes.set(n.id, { ...n, deleted: false });
  const edges = [
    ...new Map(
      [...old.edges, ...current.edges].map((e) => [e.from + "→" + e.to, e]),
    ).values(),
  ];
  const changed = new Set(),
    moduleChanged = new Set();
  const diagnostics = [...old.diagnostics, ...current.diagnostics];
  for (const c of changes) {
    const lines = changedLines(c);
    let hits = 0;
    for (const [snapshot, path, ls] of [
      [old, c.oldPath, lines.old],
      [current, c.path, lines.current],
    ])
      for (const l of ls) {
        const containing = snapshot.nodes.filter(
          (n) => n.file === path && n.start <= l && n.end >= l,
        );
        if (containing.length) {
          for (const n of containing) changed.add(n.id);
          hits++;
        } else if (path) moduleChanged.add(path);
      }
    if (!hits && !(lines.old.length + lines.current.length))
      diagnostics.push({
        file: c.path || c.oldPath,
        line: 1,
        kind: "Info",
        message: "No changed source lines detected.",
        version: "current",
      });
  }
  // A module-level change can alter globals/imports used by every function in that module and its importers.
  let progress = true;
  while (progress) {
    progress = false;
    for (const [path, info] of [...old.modules, ...current.modules]) {
      if (moduleChanged.has(path)) continue;
      for (const changedPath of moduleChanged) {
        if ([...info.deps].some((d) => d === mod(changedPath))) {
          moduleChanged.add(path);
          progress = true;
          break;
        }
      }
    }
  }
  for (const n of nodes.values())
    if (moduleChanged.has(n.file)) changed.add(n.id);
  const reverse = new Map();
  for (const e of edges) {
    if (!reverse.has(e.to)) reverse.set(e.to, []);
    reverse.get(e.to).push(e.from);
  }
  const reasons = new Map([...changed].map((id) => [id, [id]])),
    queue = [...changed];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const caller of reverse.get(id) || [])
      if (!reasons.has(caller)) {
        reasons.set(caller, [caller, ...reasons.get(id)]);
        queue.push(caller);
      }
  }
  const affected = [...nodes.values()]
    .filter((n) => reasons.has(n.id))
    .map((n) => ({
      ...n,
      direct: changed.has(n.id),
      path: reasons.get(n.id),
      depth: reasons.get(n.id).length - 1,
    }))
    .sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  const tests = current.nodes.filter((n) => n.isTest);
  const selected = tests
    .filter((n) => reasons.has(n.id))
    .map((n) => ({
      ...n,
      path: reasons.get(n.id),
      selector: n.file + "::" + n.qual.replaceAll(".", "::"),
    }));
  const warnings = [
    ...new Map(
      diagnostics.map((d) => [d.file + ":" + d.line + ":" + d.message, d]),
    ).values(),
  ];
  const conservative =
    warnings.some((d) => d.kind !== "Info") || moduleChanged.size > 0;
  const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
  const command = selected.length
    ? "python -m pytest " + selected.map((n) => quote(n.selector)).join(" ")
    : null;
  const allTests = [...new Set(tests.map((n) => n.file))];
  return {
    schemaVersion: 1,
    project:
      typeof input.name === "string"
        ? input.name.slice(0, 100)
        : "Python project",
    summary: {
      files: files.length,
      functions: current.nodes.length,
      changed: changed.size,
      affected: affected.length,
      tests: selected.length,
      totalTests: tests.length,
      edges: edges.length,
      warnings: warnings.length,
      elapsedMs: Math.round((performance.now() - started) * 10) / 10,
    },
    changes: changes.map((c) => ({ ...c, lines: changedLines(c) })),
    nodes: [...nodes.values()],
    edges,
    affected,
    tests: selected,
    allTests,
    command,
    conservative,
    conservativeCommand: allTests.length
      ? "python -m pytest " + allTests.map(quote).join(" ")
      : null,
    diagnostics: warnings.slice(0, 250),
    diagnosticsTruncated: warnings.length > 250,
    moduleChanges: [...moduleChanged],
    files,
    limitations: [
      "Static suggestions are not proof that other tests can be skipped.",
      "Supports explicit Python imports, direct function calls and same-class self/cls calls.",
      "Fixtures, runtime dispatch, monkey-patching, inheritance and decorators can hide dependencies.",
      "Only the uploaded files are analyzed; source is never executed.",
    ],
  };
}
