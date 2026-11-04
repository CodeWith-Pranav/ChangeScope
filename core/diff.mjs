export function parseDiff(text) {
  if (typeof text !== "string" || text.length > 600000)
    throw new Error("Supply a unified Git diff under 600 KB.");
  const changes = [];
  let file = null,
    hunk = null,
    oldSeen = 0,
    newSeen = 0;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (hunk) throw new Error("Incomplete diff hunk.");
      file = null;
      continue;
    }
    if (raw.startsWith("--- ") && !hunk) {
      const p = raw.slice(4).split("\t")[0];
      if (p.startsWith('"'))
        throw new Error(
          "Quoted Git paths are unsupported. Use simple relative filenames.",
        );
      file = {
        oldPath: p === "/dev/null" ? null : p.replace(/^a\//, ""),
        path: null,
        hunks: [],
      };
      changes.push(file);
      continue;
    }
    if (raw.startsWith("+++ ") && file && !hunk) {
      const p = raw.slice(4).split("\t")[0];
      file.path = p === "/dev/null" ? null : p.replace(/^b\//, "");
      continue;
    }
    const m = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      if (hunk) throw new Error("Incomplete diff hunk.");
      if (!file) throw new Error("Diff hunk is missing file headers.");
      hunk = {
        oldStart: +m[1],
        oldCount: m[2] === undefined ? 1 : +m[2],
        newStart: +m[3],
        newCount: m[4] === undefined ? 1 : +m[4],
        lines: [],
      };
      if (
        ![hunk.oldStart, hunk.oldCount, hunk.newStart, hunk.newCount].every(
          Number.isSafeInteger,
        ) ||
        (!hunk.oldCount && !hunk.newCount)
      )
        throw new Error("Invalid diff hunk range.");
      file.hunks.push(hunk);
      oldSeen = 0;
      newSeen = 0;
      continue;
    }
    if (hunk && /^[ +\-]/.test(raw)) {
      hunk.lines.push(raw);
      if (raw[0] !== "+") oldSeen++;
      if (raw[0] !== "-") newSeen++;
      if (oldSeen > hunk.oldCount || newSeen > hunk.newCount)
        throw new Error("Malformed diff hunk lengths.");
      if (oldSeen === hunk.oldCount && newSeen === hunk.newCount) hunk = null;
    }
  }
  if (hunk) throw new Error("Incomplete diff hunk.");
  for (const f of changes)
    if (!f.hunks.length)
      throw new Error(
        "Diff contains a change without text hunks. Include text hunks; pure renames and binary changes are unsupported.",
      );
  if (!changes.length)
    throw new Error(
      "No unified diff hunks found. Try git diff --no-ext-diff --unified=3.",
    );
  return changes;
}
export function reversePatch(after, change) {
  const a = (after ?? "").replace(/\r\n/g, "\n").split("\n");
  if (a.at(-1) === "") a.pop();
  for (const h of [...change.hunks].reverse()) {
    const expected = h.lines.filter((l) => l[0] !== "-").map((l) => l.slice(1));
    const old = h.lines.filter((l) => l[0] !== "+").map((l) => l.slice(1));
    const at = h.newCount === 0 ? h.newStart : Math.max(0, h.newStart - 1);
    if (
      at > a.length ||
      JSON.stringify(a.slice(at, at + expected.length)) !==
        JSON.stringify(expected)
    )
      throw new Error(
        `Diff does not match the current contents of ${change.path || change.oldPath} near line ${h.newStart}. Upload the files AFTER the change.`,
      );
    a.splice(at, expected.length, ...old);
  }
  return a.join("\n") + "\n";
}
export function changedLines(f) {
  const old = [],
    current = [];
  for (const h of f.hunks) {
    let o = h.oldStart,
      n = h.newStart;
    for (const l of h.lines) {
      if (l[0] === "-") old.push(o++);
      else if (l[0] === "+") current.push(n++);
      else {
        o++;
        n++;
      }
    }
  }
  return { old, current };
}
