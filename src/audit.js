// The audit pipeline as a single importable function — the one place capture →
// demo-strip → deterministic checks → fenced judge → grouping → serialization
// lives. Both the CLI (run-json.js) and the HTTP API (server.js) call this, so
// there is exactly one pipeline, not two copies to drift apart.
//
//   runAudit(url, goal, persona) → the same JSON object run-json.js has always
//   emitted: { ok, url, title, goal, persona, truncated, measured[], judged[],
//   notEvaluated[], summary }, or { ok:false, error } on failure.
//
// No new analysis lives here — it's the existing grounded pipeline, extracted.

import { capture } from "./capture.js";
import { HEURISTICS } from "./heuristics.js";
import { DETERMINISTIC, accessibilityPrimitives } from "./checks/index.js";
import { judge } from "./judge.js";

// A handful of elements means we captured a bot-block / error shell, not the
// page (DoorDash/Reddit serve a Cloudflare error page; Etsy returns 0). Reporting
// findings on that would be the tool lying — abstain instead. Keep in sync with
// the same floor in run.js.
const MIN_REAL_ELEMENTS = 12;

// Collapse repeated findings, keeping distinct measured values apart (strip only
// quoted per-element text, KEEP numbers so 2.75:1 and 4.04:1 don't merge).
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

// Run the full grounded pipeline. Never throws for expected failures (bad URL,
// bot-block, capture error) — returns { ok:false, error } so callers get a clean
// result object instead of an exception.
export async function runAudit(url, goal, persona) {
  if (!url || !goal) {
    return { ok: false, error: "url and goal are required — no goal, no evaluation." };
  }

  let snap;
  try {
    snap = await capture(url);
  } catch (err) {
    return { ok: false, error: `capture failed: ${err.message}` };
  }

  // Sanity floor: refuse to audit a bot-block / error shell.
  if (snap.elements.length < MIN_REAL_ELEMENTS) {
    return {
      ok: false,
      error:
        `only ${snap.elements.length} elements captured (title: "${snap.title}") — ` +
        `likely a bot-block or error shell, not the real page. Abstaining rather than reporting garbage.`,
    };
  }

  // Strip embedded demos + hidden elements for the deterministic pass and the
  // judge (feeding the judge demo mockups caused the Linear workspace hallucination).
  const realElements = snap.elements.filter((e) => !e.inDemo && e.visible !== false);
  const pageSnap = { ...snap, elements: realElements };

  // --- Layer 2: deterministic ---
  const deterministic = [];
  for (const h of HEURISTICS) {
    if (h.layer !== "deterministic" || !h.checkId) continue;
    const fn = DETERMINISTIC[h.checkId];
    if (fn) deterministic.push(...fn(pageSnap).map((f) => ({ ...f, source: "measured" })));
  }
  deterministic.push(
    ...accessibilityPrimitives(pageSnap).map((f) => ({ ...f, source: "measured" }))
  );

  // --- Layer 3: judgment (grounded, may abstain). A judge failure must not fail
  // the whole audit — it's allowed to invent nothing, including on error.
  let j = { kept: [], dropped: [] };
  try {
    j = await judge(pageSnap, { goal, persona });
  } catch (err) {
    j = { kept: [], dropped: [], error: String(err.message || err) };
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

  return {
    ok: true,
    url: snap.url,
    title: snap.title,
    goal,
    persona: persona || null,
    truncated: !!snap.truncated,
    measured,
    judged,
    notEvaluated,
    summary: {
      measuredCount: measured.length,
      judgedCount: judged.length,
      abstainedCount: notEvaluated.length,
      elementsScanned: deterministic.length,
    },
  };
}
