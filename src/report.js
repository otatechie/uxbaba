// Markdown report writer. Takes the SAME data the terminal already prints
// (grouped deterministic findings, judged findings, abstentions) and writes a
// portable .md file. No new analysis happens here — it's a second rendering of
// findings that are already grounded. Terminal output is unchanged; this is
// purely additive so a designer can save/share/diff a run.

import { writeFile } from "node:fs/promises";

// A filesystem-safe slug from a URL: "https://www.mlar.org/" -> "mlar-org".
function slug(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

function findingMd(f, HEURISTICS) {
  // Placeholder name if the heuristicId isn't in the table — don't crash the
  // whole report over one malformed finding.
  const h = HEURISTICS.find((x) => x.id === f.heuristicId) || { name: "(unknown heuristic)" };
  const tag = f.source === "measured" ? "measured" : "judged";
  // "×4" alone reads as "4 broken elements"; say what the count means.
  const count =
    f.count > 1 ? ` — **${f.count} elements share this** (e.g. ${f.examples.join(", ")})` : "";
  const where = f.count > 1 ? "" : `\n  - \`${f.selector}\``;
  return (
    `- **H${f.heuristicId} ${h.name}** _(${tag}, ${f.severity})_${count}\n` +
    `  ${f.message}${where}\n` +
    `  - _${f.measured}_`
  );
}

// findings: grouped deterministic array (already sorted). j: judge result.
export async function writeReport({ url, goal, persona, snap, groupedDet, j, HEURISTICS }, dir) {
  const abstained = HEURISTICS.filter((h) => h.layer === "abstain");
  const lines = [];
  lines.push(`# UX Guide report — ${url}`);
  lines.push("");
  lines.push(`**Goal:** ${goal}`);
  if (persona) lines.push(`**Persona:** ${persona}`);
  lines.push(`**Page:** ${snap.title}`);
  lines.push("");
  lines.push(
    `This tool flags less on purpose — every finding below names a real element and a real number. ` +
      `It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.`
  );
  lines.push("");

  lines.push(`## Measured — grounded in real elements, cannot hallucinate`);
  if (groupedDet.length === 0) lines.push(`\n_Nothing to flag from deterministic checks._`);
  else lines.push("\n" + groupedDet.map((f) => findingMd(f, HEURISTICS)).join("\n\n"));
  lines.push("");

  lines.push(`## Judged — goal-alignment, only if grounded in a cited element`);
  if (j.stub) lines.push(`\n_LLM layer not enabled (no key). It returned nothing rather than inventing._`);
  else if (j.error) lines.push(`\n_Judge call failed (abstained, invented nothing): ${j.error}_`);
  else if (!j.kept || j.kept.length === 0) lines.push(`\n_Nothing grounded to flag._`);
  else lines.push("\n" + j.kept.map((f) => findingMd(f, HEURISTICS)).join("\n\n"));
  lines.push("");

  lines.push(`## Not evaluated — honestly out of reach for a static pass`);
  lines.push("");
  for (const h of abstained) {
    lines.push(`- **H${h.id} ${h.name}** — ${h.note}`);
  }
  lines.push("");

  // Limitations — the scope of THIS capture, stated plainly. Same ethos as the
  // abstentions above: say what the pass could and couldn't see, so a reader
  // never mistakes a partial capture for a full audit.
  lines.push(`## Limitations of this pass`);
  lines.push("");
  const captured = snap.elements ? snap.elements.length : 0;
  if (snap.truncated) {
    lines.push(
      `- **Partial capture.** Only the first ${captured} of ${snap.totalVisible}+ visible ` +
        `elements were scanned. Whole-page checks (help, interactive density) saw the top of the ` +
        `page only and may be incomplete. Findings on captured elements remain valid.`
    );
  } else {
    lines.push(`- **Full capture.** All ${captured} visible elements on the page were scanned.`);
  }
  lines.push(
    `- **Single static screen.** This is one rendered view at a mobile viewport — no clicks, ` +
      `scrolling into lazy content, or multi-step flows. Flow-dependent issues aren't visible here.`
  );
  lines.push(
    `- **DOM, not perception.** Findings come from computed styles and real geometry, not a ` +
      `screenshot. Contrast on gradient/image backgrounds is skipped rather than guessed.`
  );
  lines.push(
    `- **Live sites can block automated browsers.** If a page serves a bot-block or error shell, ` +
      `the tool abstains instead of reporting — so a report exists only when the real page was captured.`
  );
  lines.push("");

  const path = `${dir}/${slug(url)}.md`;
  await writeFile(path, lines.join("\n"), "utf8");
  return path;
}
