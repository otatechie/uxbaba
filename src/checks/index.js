// Deterministic checks. Pure functions of a captured DOM snapshot (see capture.js).
// These CANNOT hallucinate: every finding names a real element and a real number.
// A check returns an array of findings, or [] if nothing to flag.
//
// Finding shape (enforced everywhere):
//   { heuristicId, selector, measured, message, severity }
//     selector  — a real element in the page
//     measured  — the concrete fact behind the claim (a number, a count, a string)
//     message   — plain-language, points at the element
//
// The snapshot (`snap`) is produced by capture.js and is plain JSON:
//   snap.url, snap.title, snap.elements[] where each element has
//   { selector, tag, role, text, ariaLabel, styles:{...}, rect:{w,h}, attrs:{...} }

// WCAG 2.2 SC 1.4.3 Contrast (Minimum), Level AA:
//   - Normal text: 4.5:1
//   - Large text:  3:1, where "large" = >=18pt (24px) OR >=14pt (18.66px) bold.
// We previously used 4.5 for everything, which OVER-FLAGS big headings that the
// spec only holds to 3:1 (e.g. Stripe's large grey hero subtext). Now we pick
// the threshold per element by its font size + weight.
const AA_CONTRAST_NORMAL = 4.5;
const AA_CONTRAST_LARGE = 3.0;
const LARGE_PX = 24; // 18pt
const LARGE_BOLD_PX = 18.66; // 14pt

// WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA: 24x24 CSS px.
// SC 2.5.5 Target Size (Enhanced), AAA: 44x44 (Apple HIG 44pt / Material 48dp).
// IMPORTANT EXCEPTION in 2.5.8 — "Inline": a target in a sentence or block of
// text is EXEMPT. So we must NOT flag inline text links for size; the spec says
// they don't have to meet 24px. We only size-check discrete controls (buttons).
const MIN_TAP_BUTTON = 24; // SC 2.5.8 minimum for discrete controls

function findings() {
  return [];
}

// --- H1: Visibility of system status ---
export function systemStatus(snap) {
  const out = findings();
  const hasLiveRegion = snap.elements.some(
    (e) => e.role === "status" || e.attrs["aria-live"] || e.role === "alert"
  );
  const submitters = snap.elements.filter(
    (e) =>
      (e.tag === "button" || e.attrs.type === "submit") &&
      /submit|save|send|pay|continue|next|buy|order/i.test(e.text || "")
  );
  if (submitters.length > 0 && !hasLiveRegion) {
    out.push({
      heuristicId: 1,
      selector: submitters[0].selector,
      measured: `${submitters.length} action button(s), 0 aria-live/status regions`,
      message:
        "There's an action that likely triggers async work, but no live region (aria-live/role=status) to announce progress or result. Users won't know the system heard them.",
      severity: "medium",
    });
  }
  return out;
}

// --- H3: User control and freedom ---
export function userControl(snap) {
  const out = findings();
  const escapes = snap.elements.filter((e) =>
    /cancel|back|undo|close|dismiss|previous/i.test(e.text || e.ariaLabel || "")
  );
  // A COMMITTED multi-step flow needs an escape hatch — NOT a bare <form>.
  // Earlier attempts keyed on "page has a <form>" (tripped on search boxes) then
  // "page has >=3 inputs" (tripped on GRA's single-dropdown service picker,
  // because it counted inputs PAGE-WIDE, not within one form). Our flat snapshot
  // doesn't preserve form nesting well, so per-form counting is unreliable.
  // Instead fire ONLY on the unambiguous signal of a committed flow: an explicit
  // step/progress indicator ("step 2 of 5", "step 2/5", a "Next"/"Continue"
  // pairing with step text). A homepage picker has none; a real checkout /
  // registration wizard does. Fewer false positives, and honest about the limit.
  const stepIndicator = snap.elements.some((e) =>
    /\bstep\s*\d+\s*(of|\/)\s*\d+\b/i.test(e.text || e.ariaLabel || "")
  );
  const inFlow = stepIndicator;
  if (inFlow && escapes.length === 0) {
    out.push({
      heuristicId: 3,
      selector: "form",
      measured: "in a form/multi-step flow, 0 cancel/back/undo affordances found",
      message:
        "This looks like a flow the user is committed into, with no visible escape hatch (cancel / back / undo). Users need a clearly marked exit.",
      severity: "medium",
    });
  }
  return out;
}

// --- H4: Consistency and standards ---
export function consistency(snap) {
  const out = findings();
  // Same action, different visual styling → inconsistency.
  //
  // Naive version compared any two buttons sharing a text label. That produced
  // false positives on sites where the same word appears in structurally
  // DIFFERENT controls that SHOULD look different — e.g. a "Men" nav toggle vs.
  // a "Men" breadcrumb vs. a "Men" filter. Those aren't "the same action styled
  // inconsistently"; they're different actions that happen to share a word.
  //
  // Fix: only compare buttons that live in the SAME parent container (same
  // immediate parent path). Genuinely-repeated actions (a row of identical CTAs,
  // a list of "Add to cart" buttons) share a parent; a nav tab and a filter
  // don't. This scopes the check to real repetition.
  const buttons = snap.elements.filter((e) => e.tag === "button" || e.role === "button");
  const byLabelAndParent = {};
  for (const b of buttons) {
    const label = (b.text || "").trim().toLowerCase();
    if (!label) continue;
    // parent context = the selector minus the final segment
    const parent = (b.selector || "").split(" > ").slice(0, -1).join(" > ");
    const key = `${parent}::${label}`;
    (byLabelAndParent[key] ||= { label, items: [] }).items.push(b);
  }
  for (const { label, items } of Object.values(byLabelAndParent)) {
    if (items.length < 2) continue;
    const signatures = new Set(
      items.map((b) => `${b.styles.backgroundColor}|${b.styles.color}|${b.styles.borderRadius}`)
    );
    if (signatures.size > 1) {
      out.push({
        heuristicId: 4,
        selector: items[0].selector,
        measured: `"${label}" rendered ${signatures.size} different ways across ${items.length} instances in one group`,
        message: `The same action "${label}" is styled inconsistently within one group. Users read visual difference as functional difference.`,
        severity: "low",
      });
    }
  }
  return out;
}

// --- H5: Error prevention ---
export function errorPrevention(snap) {
  const out = findings();
  // A destructive action is a CONTROL that deletes something, not any text that
  // happens to contain a keyword. The old version matched "remove" anywhere,
  // including a demo kanban card titled "Remove UI inconsistencies" — a <span>
  // of prose, not a button. Require an actionable element (button, button-role,
  // or a link with an href) AND a short label that reads as a command, not a
  // sentence that merely mentions the word.
  const isActionable = (e) =>
    e.tag === "button" ||
    e.role === "button" ||
    (e.tag === "a" && e.attrs.href) ||
    e.attrs.type === "submit";
  const destructive = snap.elements.filter((e) => {
    if (!isActionable(e)) return false;
    const label = (e.text || e.ariaLabel || "").trim();
    // short label (a real button label, not a paragraph) that is a command
    if (label.length > 40) return false;
    return /\b(delete|remove|cancel subscription|deactivate|erase|wipe|delete account|remove account)\b/i.test(
      label
    );
  });
  for (const d of destructive) {
    const guarded = d.attrs["aria-haspopup"] || d.attrs["data-confirm"];
    if (!guarded) {
      const label = (d.text || d.ariaLabel || "").trim();
      out.push({
        heuristicId: 5,
        selector: d.selector,
        measured: `destructive control "${label}" with no visible confirmation affordance`,
        message: `"${label}" appears destructive but shows no confirmation guard. One misclick and it's gone.`,
        severity: "medium",
      });
    }
  }
  return out;
}

// A filled, saturated, non-neutral button/link — a candidate "primary" control.
// Detected by computed style (universal), not a `class="primary"` convention
// (absent on obfuscated React/Vue builds). Returns the fill color so we can group
// by it — the real competition signal isn't "is colored" but "shares the SAME
// prominent fill as other buttons", which is what actually makes them compete.
function primaryFill(e) {
  if (!(e.tag === "button" || e.role === "button" || e.tag === "a")) return null;
  const m = (e.styles && e.styles.backgroundColor || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(",").map((n) => parseFloat(n));
  if (a < 0.5) return null; // transparent/ghost buttons aren't primary fills
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max - min < 25) return null; // neutral (white/black/grey) — not a CTA color
  if (min > 235) return null; // near-white fill — not prominent
  // quantize so near-identical colors group together
  return `${Math.round(r / 16)}-${Math.round(g / 16)}-${Math.round(b / 16)}`;
}

// --- H8: Aesthetic and minimalist design (element/action counts; Krug overlap) ---
export function minimalism(snap) {
  const out = findings();
  // Group filled controls by fill color. Competition = 2+ buttons sharing the
  // SAME saturated fill (dental's four identical blue btn-3d-primary). Different
  // colored controls (GOV.UK's green start + green Yes/No + blue links) are
  // distinct roles, NOT competing primaries — so grouping by color avoids the
  // "colorful design system = competing CTAs" false positive.
  const byFill = {};
  for (const e of snap.elements) {
    const fill = primaryFill(e);
    if (fill) (byFill[fill] ||= []).push(e);
  }
  // Require 3+ identically-filled buttons with DISTINCT labels.
  //  - 3+ threshold: two matched buttons are usually a legit primary/secondary
  //    pair or binary choice (cookie Accept/Reject) — not competition.
  //  - Distinct labels: N buttons sharing the same fill AND the same label are a
  //    REPEATED list action, not competing primaries — a blog/news listing where
  //    every post card has its own "Continue reading" (Ghana Maritime), or a
  //    product grid's repeated "Add to cart". That's correct design, not "every-
  //    thing shouts". Genuine competition is DIFFERENT actions with equal weight
  //    (Book / Call / Register / Explore — dental). So: same fill + same label =
  //    list repetition (skip); same fill + different labels = competing (flag).
  const competing = Object.values(byFill).find((g) => {
    if (g.length < 3) return false;
    const labels = new Set(g.map((e) => (e.text || e.ariaLabel || "").trim().toLowerCase()));
    return labels.size >= 3; // at least 3 distinct actions, not one repeated
  });
  if (competing) {
    out.push({
      heuristicId: 8,
      selector: competing[0].selector,
      measured: `${competing.length} buttons share the same prominent fill color (competing primary CTAs)`,
      message:
        "Multiple identically-styled primary actions on one screen. Krug's rule: there should be one obvious next step. When everything shouts, nothing does.",
      severity: "medium",
    });
  }
  const interactive = snap.elements.filter((e) =>
    ["button", "a", "input", "select", "textarea"].includes(e.tag)
  );
  if (interactive.length > 30) {
    out.push({
      heuristicId: 8,
      selector: "body",
      measured: `${interactive.length} interactive elements on one screen`,
      message:
        "Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.",
      severity: "low",
    });
  }
  return out;
}

// --- H10: Help and documentation ---
export function help(snap) {
  const out = findings();
  // "0 help affordances found" is only trustworthy if we saw the WHOLE page.
  // On a tall page truncated at the element cap, the footer help link (DoorDash,
  // Reddit) sits below the cap and never gets captured — so a "no help" verdict
  // would be an artifact of truncation, not a real absence. Abstain when partial.
  if (snap.truncated) return out;
  const hasHelp = snap.elements.some((e) =>
    /help|support|docs|faq|\?/i.test(e.text || e.ariaLabel || "")
  );
  if (!hasHelp) {
    out.push({
      heuristicId: 10,
      selector: "body",
      measured: "0 help/support/docs affordances found on screen",
      message:
        "No reachable help or documentation affordance on this screen. Fine for a trivial screen; a gap if users can get stuck here.",
      severity: "low",
    });
  }
  return out;
}

// --- Accessibility primitives that back several heuristics (contrast, tap size) ---
// These are the canonical "an LLM should never guess this — compute it" checks.
export function accessibilityPrimitives(snap) {
  const out = findings();
  for (const e of snap.elements) {
    // Skip visually-hidden helpers (skip-links, screen-reader-only labels). They
    // are collapsed off-screen on purpose until focused; flagging them is a false
    // positive. Detect by class-name convention OR by the structural signature —
    // a link that's ~1px in one dimension is an off-screen-hidden element, not a
    // real control a user is meant to tap.
    const cls = e.attrs.class || "";
    const hiddenByClass = /\b(sr-only|visually-?hidden|screen-reader|skip-main|skip-link|skip-to|a11y)\b/i.test(cls);
    const hiddenByShape =
      e.rect && (Math.round(e.rect.w) <= 1 || Math.round(e.rect.h) <= 1);
    const hidden = hiddenByClass || hiddenByShape;
    // Only discrete controls (buttons, button-role, styled-as-button links) get
    // the 24px SC 2.5.8 check. Per the SC 2.5.8 "Inline" exception, links inside
    // text are EXEMPT — the spec explicitly does not require them to meet 24px —
    // so we no longer flag inline/text links at all. This removes the whole "20px
    // footer link fails" false-positive class as spec-correct, not just softened.
    // role="tab" is exempted for the same reason: tabs live in a tablist row where
    // the strip — not each ~18px text label — is the real target (Airbnb's 8
    // "Popular / Beach / Mountains…" tabs read as inline text, not mis-tappable
    // controls). Same spirit as the inline-link exemption above.
    const isTab = e.role === "tab";
    // A real tappable control is an actual <button>/<a>, or role=button. The
    // class-name heuristic (/btn|button/) is a LAST resort and must NOT match
    // non-interactive tags: modern component libraries (GitHub Primer, MUI,
    // Chakra) wrap the label in <span class="Button-label"> / <span
    // class="Button-content"> INSIDE the real <button>. Those spans carry the
    // "button" substring but are just the ~22px text box, not the padded ≥44px
    // control the user taps — measuring them flooded GitHub with ~14 phantom
    // "too small" findings. So the class heuristic only applies to genuinely
    // interactive tags, never a bare <span>/<div>/<p>.
    const interactiveTag = e.tag === "button" || e.tag === "a" || e.tag === "input";
    const isButton =
      e.tag === "button" ||
      e.role === "button" ||
      (interactiveTag && /\bbtn|button\b/i.test(cls));
    if (!hidden && isButton && !isTab && e.rect) {
      // Compare the ROUNDED min against the threshold, and display the same
      // rounded number — otherwise a raw 23.6px rounds to "24" in the message
      // while the raw value trips "< 24", producing the nonsensical "24px < 24"
      // finding seen on GitHub's footer buttons. Round once, use everywhere.
      const w = Math.round(e.rect.w);
      const h = Math.round(e.rect.h);
      const min = Math.min(w, h);
      if (min > 0 && min < MIN_TAP_BUTTON) {
        out.push({
          heuristicId: 5,
          selector: e.selector,
          measured: `button ${w}×${h}px (min side ${min}px < ${MIN_TAP_BUTTON}, WCAG 2.2 SC 2.5.8)`,
          message: `"${(e.text || e.ariaLabel || "control").trim()}" is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.`,
          severity: "medium",
        });
      }
    }
    // A near-degenerate ratio (fg ≈ bg) means the two colors resolved to nearly
    // the same value — in practice a background-resolution failure (a promo/nav
    // bar whose real painted background we couldn't decompose), not a real
    // design where text is genuinely invisible. Truly-invisible text is
    // vanishingly rare; a very low ratio is almost always a resolution bug, so
    // abstain rather than false-flag. Floor raised 1.5 → 2.0 after Booking's
    // readable dark-on-yellow "Search" button reported 1.75:1 and Apple's arrow
    // glyphs 1.51:1 — both resolution failures, not real low-contrast text.
    // Genuine low-contrast-but-readable text (grey-on-white body copy) lands
    // comfortably above 2.0, so this suppresses the bug class without hiding
    // real findings.
    // Same visually-hidden guard as the tap-size check above: screen-reader-only
    // spans (.a11y / .visuallyhidden / clip-hidden 1px helpers) carry real text
    // and real grey-on-white colors, so they leak into the contrast check as
    // impossible ratios (Apple's .a11y / .visuallyhidden "Next" spans read 1.51:1
    // ×10). They aren't visible text — don't contrast-check them.
    const DEGENERATE = 2.0;
    if (!hidden && e.contrast != null && e.contrast > DEGENERATE && e.text && e.text.trim()) {
      // Pick the WCAG 2.2 SC 1.4.3 threshold by text size/weight. Large text
      // (>=24px, or >=18.66px bold) only needs 3:1 — holding it to 4.5:1
      // over-flags big headings (Stripe's grey hero subtext). Normal text: 4.5:1.
      const px = parseFloat(e.styles.fontSize) || 16;
      const weight = parseInt(e.styles.fontWeight, 10) || 400;
      const bold = weight >= 700;
      const isLarge = px >= LARGE_PX || (bold && px >= LARGE_BOLD_PX);
      const threshold = isLarge ? AA_CONTRAST_LARGE : AA_CONTRAST_NORMAL;
      if (e.contrast < threshold) {
        out.push({
          heuristicId: 4,
          selector: e.selector,
          measured: `contrast ${e.contrast.toFixed(2)}:1 (WCAG AA needs ${threshold}:1 for ${isLarge ? "large" : "normal"} text)`,
          message: `Text "${e.text.slice(0, 30).trim()}…" fails WCAG 2.2 SC 1.4.3 contrast (${isLarge ? "large" : "normal"}-text threshold). Computed, not guessed.`,
          severity: "medium",
        });
      }
    }
  }
  return out;
}

export const DETERMINISTIC = {
  systemStatus,
  userControl,
  consistency,
  errorPrevention,
  minimalism,
  help,
};
