// Runner: capture DOM → deterministic checks → fenced judgment → layered report.
//
// Usage:
//   node src/run.js <url> "<what the user should accomplish>" ["persona"]
// Example:
//   node src/run.js https://example.com "renew my subscription" "returning customer, in a hurry"

import { capture } from "./capture.js";
import { HEURISTICS } from "./heuristics.js";
import { DETERMINISTIC, accessibilityPrimitives } from "./checks/index.js";
import { judge } from "./judge.js";
import { writeReport } from "./report.js";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const [url, goal, persona] = process.argv.slice(2);
if (!url || !goal) {
  console.error(
    'Usage: node src/run.js <url> "<goal>" ["persona"]\n' +
      'The goal is required — this is the Cooper input a scanner never has. No goal, no evaluation.'
  );
  process.exit(1);
}

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};
const sev = { high: c.red("●"), medium: c.yellow("●"), low: c.dim("●") };

console.log(c.bold(`\nUX Guide — ${url}`));
console.log(c.dim(`Goal: "${goal}"${persona ? `  ·  Persona: "${persona}"` : ""}\n`));

console.log(c.dim("Capturing DOM (not a screenshot)…"));
let snap;
try {
  snap = await capture(url);
} catch (err) {
  console.log(c.red(`\n✗ Could not capture ${url}\n  ${err.message}\n`));
  console.log(c.dim("  (The site may be down, slow, or blocking automated browsers. Try again or check the URL.)"));
  process.exit(1);
}
console.log(c.dim(`Captured ${snap.elements.length} elements from "${snap.title}".\n`));

// Sanity floor. A real page has dozens of elements. A handful means we captured
// a bot-block / error shell, not the page (DoorDash & Reddit serve headless
// Chromium a Cloudflare "trouble loading" page — 3–7 elements). Auditing that and
// reporting findings would be the tool lying: a "clean" report on an error page.
// Refuse and say so, rather than quietly evaluate garbage. This IS the tool's
// ethos — abstain honestly instead of inventing a verdict from nothing.
const MIN_REAL_ELEMENTS = 12;
if (snap.elements.length < MIN_REAL_ELEMENTS) {
  console.log(
    c.red(
      `✗ Only ${snap.elements.length} elements captured — this is almost certainly not the real page.\n`
    ) +
      c.dim(
        `  The site likely blocked the automated browser or served an error/consent shell\n` +
          `  (page title: "${snap.title}"). Reporting UX findings on this would be dishonest, so\n` +
          `  the tool is abstaining. Try a URL that renders server-side, or a non-bot-blocked page.\n`
      )
  );
  process.exit(2);
}
if (snap.truncated) {
  console.log(
    c.yellow(
      `⚠ Page truncated at ${snap.elements.length} of ${snap.totalVisible}+ visible elements. ` +
        `Whole-page checks (help, density) saw only the top of the page and may be incomplete.\n`
    )
  );
}

// Deterministic checks evaluate the PAGE's real UI, so strip embedded product
// demos / scaled mockups first (see capture.js inDemo). Otherwise a SaaS landing
// page's app-replica marketing asset gets audited as if it were the page chrome
// (Linear's demo kanban cards read as destructive actions, its 14px demo buttons
// as too-small). The judge still receives the full snapshot.
// Deterministic checks evaluate the PAGE's real, VISIBLE UI. Strip (a) embedded
// product demos / scaled mockups and (b) present-in-DOM-but-hidden elements
// (mega-nav dropdowns, off-canvas menus). Otherwise the page's marketing assets
// and collapsed menus get audited as on-screen chrome (Linear's demo cards;
// Stripe's 17 hidden mega-nav CTAs). The judge still receives the full snapshot.
const realElements = snap.elements.filter((e) => !e.inDemo && e.visible !== false);
const pageSnap = { ...snap, elements: realElements };
const demoCount = snap.elements.filter((e) => e.inDemo).length;
const hiddenCount = snap.elements.filter((e) => !e.inDemo && e.visible === false).length;
const skipBits = [];
if (demoCount > 0) skipBits.push(`${demoCount} in embedded demos/mockups`);
if (hiddenCount > 0) skipBits.push(`${hiddenCount} hidden (collapsed menus, off-screen)`);
if (skipBits.length) {
  console.log(
    c.dim(`(Skipped ${skipBits.join(" + ")} — evaluating the page's own visible UI.)\n`)
  );
}

// --- Layer 2: deterministic ---
const deterministic = [];
for (const h of HEURISTICS) {
  if (h.layer !== "deterministic" || !h.checkId) continue;
  const fn = DETERMINISTIC[h.checkId];
  if (fn) deterministic.push(...fn(pageSnap).map((f) => ({ ...f, source: "measured" })));
}
deterministic.push(...accessibilityPrimitives(pageSnap).map((f) => ({ ...f, source: "measured" })));

// --- Layer 3: judgment (grounded, may abstain) ---
// Feed the judge the SAME demo-stripped, visible-only snapshot the deterministic
// layer uses — NOT the raw snapshot. Passing the full snapshot let the model read
// Linear's embedded product-demo mockup (a marketing image of the app) as if it
// were a real logged-in workspace, and it hallucinated "the user bypassed the
// signup flow / is in a demo environment" on a public landing page. Grounding a
// selector doesn't ground the reasoning; the least we can do is not feed the
// judge the mockup elements the deterministic layer already knows to strip.
const j = await judge(pageSnap, { goal, persona });

// Collapse repeated findings. "14 footer links are 20px" is ONE observation, not
// 14. Group by heuristic + a normalized measured-signature. We strip only the
// QUOTED text (the per-element label, which varies and shouldn't split a group)
// but KEEP the numbers — so a 20px link and a 40px link stay separate, and a
// 2.75:1 button doesn't merge with 4.04:1 contact links under one exemplar.
// (Stripping all digits, as an earlier version did, wrongly merged different
// contrast values into one misleading finding — MLAR's green DONATE button at
// 2.75:1 got lumped with 4.04:1 footer links.)
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

// --- Report ---
function line(f) {
  // Fall back to a placeholder name if the finding cites a heuristicId not in the
  // table — one malformed finding must not crash the whole report render.
  const h = HEURISTICS.find((x) => x.id === f.heuristicId) || { name: "(unknown heuristic)" };
  const tag = f.source === "measured" ? c.cyan("[measured]") : c.dim("[judged]  ");
  const count = f.count > 1 ? c.bold(` ×${f.count}`) : "";
  console.log(`  ${sev[f.severity] || "○"} ${tag} ${c.bold("H" + f.heuristicId)} ${h.name}${count}`);
  console.log(`      ${f.message}`);
  if (f.count > 1) {
    console.log(c.dim(`      → ${f.count} elements, e.g. ${f.examples.join(", ")}   (${f.measured})`));
  } else {
    console.log(c.dim(`      → ${f.selector}   (${f.measured})`));
  }
}

const sevRank = { high: 0, medium: 1, low: 2 };
const groupedDet = group(deterministic).sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3));

console.log(c.bold("MEASURED — grounded in real elements, cannot hallucinate"));
if (groupedDet.length === 0) console.log(c.green("  ✓ nothing to flag from deterministic checks"));
else groupedDet.forEach(line);

console.log("\n" + c.bold("JUDGED — goal-alignment, only if grounded in a cited element"));
if (j.stub) {
  console.log(
    c.dim(
      "  (LLM layer is stubbed — no ANTHROPIC_API_KEY set. It returned nothing rather than\n" +
        "   inventing findings. Set the key and wire callModel() in src/judge.js to enable.)"
    )
  );
} else if (j.error) {
  console.log(c.red(`  ⚠ judge call failed (abstained, invented nothing): ${j.error}`));
} else if (j.kept.length === 0) {
  console.log(c.green("  ✓ nothing grounded to flag"));
} else j.kept.forEach(line);

if (j.dropped && j.dropped.length) {
  console.log(c.dim(`\n  ${j.dropped.length} ungrounded LLM finding(s) suppressed before display:`));
  for (const d of j.dropped) console.log(c.dim(`    · ${d.reason}`));
}

// --- Honest abstentions ---
const abstained = HEURISTICS.filter((h) => h.layer === "abstain");
console.log("\n" + c.bold("NOT EVALUATED — honestly out of reach for a static pass"));
for (const h of abstained) {
  console.log(`  ○ ${c.bold("H" + h.id)} ${h.name}`);
  console.log(c.dim(`      ${h.note}`));
}

console.log(
  c.dim(
    `\nSummary: ${groupedDet.length} measured issue(s) from ${deterministic.length} elements, ` +
      `${j.kept.length} judged, ${abstained.length} abstained. ` +
      `This tool flags less on purpose — sparse + true beats dense + guessed.\n`
  )
);

// Additive: save the same findings to a portable Markdown report. Terminal
// output above is unchanged — this just lets a run be saved, shared, or diffed.
const reportsDir = fileURLToPath(new URL("../reports", import.meta.url));
await mkdir(reportsDir, { recursive: true });
const reportPath = await writeReport(
  { url, goal, persona, snap, groupedDet, j, HEURISTICS },
  reportsDir
);
console.log(c.dim(`Report saved → ${reportPath}\n`));
