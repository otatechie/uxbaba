// JSON entry point — the bridge for a host process (e.g. a Laravel queue worker)
// that shells out to this Node engine and parses the result. Runs the EXACT same
// pipeline as run.js (capture → deterministic checks → fenced judge → grouping),
// but emits a single JSON object on stdout instead of a pretty terminal report.
// No new analysis lives here; it's a second serialization of already-grounded
// findings. Any diagnostic/log noise goes to stderr so stdout stays clean JSON.
//
// Usage:
//   node src/run-json.js <url> "<goal>" ["persona"]
// Output (stdout): { ok, url, title, goal, persona, measured[], judged[], notEvaluated[], summary }
// On failure (stdout): { ok:false, error } with a non-zero exit code.

import { capture } from "./capture.js";
import { HEURISTICS } from "./heuristics.js";
import { DETERMINISTIC, accessibilityPrimitives } from "./checks/index.js";
import { judge } from "./judge.js";

const [url, goal, persona] = process.argv.slice(2);

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }) + "\n");
  process.exit(1);
}

if (!url || !goal) {
  fail('Usage: node src/run-json.js <url> "<goal>" ["persona"] — goal is required.');
}

// Same grouping as run.js: collapse repeated findings, keeping distinct measured
// values apart (strip only quoted per-element text, KEEP numbers so 2.75:1 and
// 4.04:1 don't merge). See run.js for the full rationale.
function group(findings) {
  const byKey = new Map();
  for (const f of findings) {
    const sig = `${f.heuristicId}|${(f.measured || "").replace(/["'].*?["']/g, "")}`;
    if (!byKey.has(sig)) byKey.set(sig, { ...f, count: 1, examples: [f.selector] });
    else {
      const g = byKey.get(sig);
      g.count++;
      if (g.examples.length < 3) g.examples.push(f.selector);
    }
  }
  return [...byKey.values()];
}

function serialize(f) {
  // h may be undefined if a finding cites an unknown heuristicId; guarded below.
  const h = HEURISTICS.find((x) => x.id === f.heuristicId);
  return {
    heuristicId: f.heuristicId,
    heuristic: h ? h.name : "",
    source: f.source, // "measured" | "judged"
    severity: f.severity,
    message: f.message,
    measured: f.measured,
    count: f.count || 1,
    selector: f.selector,
    examples: f.examples || [f.selector],
  };
}

let snap;
try {
  snap = await capture(url);
} catch (err) {
  fail(`capture failed: ${err.message}`);
}

// Sanity floor (same as run.js): a handful of elements means we captured a
// bot-block / error shell, not the page. Refuse rather than emit findings on
// garbage — a "clean" report on a Cloudflare error page is the tool lying.
const MIN_REAL_ELEMENTS = 12;
if (snap.elements.length < MIN_REAL_ELEMENTS) {
  fail(
    `only ${snap.elements.length} elements captured (title: "${snap.title}") — ` +
      `likely a bot-block or error shell, not the real page. Abstaining rather than reporting garbage.`
  );
}

// Strip embedded demos + hidden elements for the deterministic pass (same as run.js).
const realElements = snap.elements.filter((e) => !e.inDemo && e.visible !== false);
const pageSnap = { ...snap, elements: realElements };

const deterministic = [];
for (const h of HEURISTICS) {
  if (h.layer !== "deterministic" || !h.checkId) continue;
  const fn = DETERMINISTIC[h.checkId];
  if (fn) deterministic.push(...fn(pageSnap).map((f) => ({ ...f, source: "measured" })));
}
deterministic.push(...accessibilityPrimitives(pageSnap).map((f) => ({ ...f, source: "measured" })));

// Judge layer (grounded, may abstain). Never let a judge failure crash the run —
// it's allowed to invent nothing, including on error. Pass the demo-stripped,
// visible-only pageSnap (not the raw snapshot) so the model can't read embedded
// product-demo mockups as real UI — see run.js for the Linear hallucination this
// prevents.
let j = { kept: [], dropped: [] };
try {
  j = await judge(pageSnap, { goal, persona });
} catch (err) {
  process.stderr.write(`judge error (abstained): ${err.message}\n`);
}

const sevRank = { high: 0, medium: 1, low: 2 };
const measured = group(deterministic)
  .sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3))
  .map(serialize);
const judged = (j.kept || []).map((f) => serialize({ ...f, source: "judged" }));

const notEvaluated = HEURISTICS.filter((h) => h.layer === "abstain").map((h) => ({
  heuristicId: h.id,
  heuristic: h.name,
  note: h.note,
}));

process.stdout.write(
  JSON.stringify({
    ok: true,
    url: snap.url,
    title: snap.title,
    goal,
    persona: persona || null,
    measured,
    judged,
    notEvaluated,
    truncated: !!snap.truncated,
    summary: {
      measuredCount: measured.length,
      judgedCount: judged.length,
      abstainedCount: notEvaluated.length,
      elementsScanned: deterministic.length,
    },
  }) + "\n"
);
