// DOM capture via Playwright. This is the single most important design choice:
// we read the REAL DOM (computed styles, real sizes, real roles), not a
// screenshot. Perception is where hallucination lives; measurement is not.
//
// Produces a plain-JSON snapshot that the deterministic checks and the LLM
// layer both consume. Contrast is COMPUTED here, in the browser, against the
// actual rendered colors — never guessed downstream.

import { chromium } from "playwright";

export async function capture(url) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // mobile-ish, where tap targets bite
  try {
    // "networkidle" never fires on ad/tracker-heavy sites (TechCabal, most news
    // sites) — background requests keep the network busy forever, so it times out
    // and crashes. "domcontentloaded" gets the real page structure without
    // waiting on ads; a short settle pause lets CSS/fonts/first paint apply so
    // computed styles are accurate.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500); // let styles/layout settle
  } catch (err) {
    await browser.close();
    throw new Error(`capture failed for ${url}: ${err.message.split("\n")[0]}`);
  }

  const snap = await page.evaluate(() => {
    // --- contrast helpers, run in-page against real colors ---
    function parseRGB(str) {
      const m = str && str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b] = m[1].split(",").map((n) => parseFloat(n));
      return { r, g, b };
    }
    function lum({ r, g, b }) {
      const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function contrast(fg, bg) {
      const f = parseRGB(fg),
        b = parseRGB(bg);
      if (!f || !b) return null;
      const L1 = lum(f),
        L2 = lum(b);
      const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    }
    // Effective background BEHIND THE TEXT of `el`: the element's own painted
    // background if it has one, otherwise the nearest ancestor that paints one.
    // Returns null when the real background can't be trusted — a gradient or
    // background-image can't be read from `backgroundColor` (it reports the
    // transparent layer under the image), so contrast on those elements would be
    // a lie. Better to abstain than to invent a ratio. This is what fixes the
    // "filled blue button = 1.00:1" false positive.
    function effectiveBg(el) {
      let n = el;
      while (n) {
        const cs = getComputedStyle(n);
        // If this layer paints a gradient/image we can't decompose, abstain.
        if (cs.backgroundImage && cs.backgroundImage !== "none") return null;
        const bg = cs.backgroundColor;
        const p = parseRGB(bg);
        const transparent = !p || (bg.startsWith("rgba") && bg.endsWith(", 0)"));
        if (!transparent) return bg;
        n = n.parentElement;
      }
      return "rgb(255, 255, 255)";
    }
    // Is this element inside an embedded product-demo / scaled mockup rather
    // than the page's own chrome? SaaS landing pages render replicas of their app
    // as marketing assets (Linear's sidebar + kanban demo). Those get flagged as
    // real UI — tiny "buttons", demo card titles read as destructive actions —
    // which is noise. The reliable, class-name-independent signal is a scaled or
    // transformed ancestor: demos are almost always wrapped in transform:scale()
    // or a fixed-size frame the real UI never uses. Also treat aria-hidden
    // subtrees (decorative/inert) as demo-like. No site-specific hashes, so it
    // generalizes.
    function inDemo(el) {
      let n = el,
        depth = 0;
      while (n && n.nodeType === 1 && depth < 20) {
        const cs = getComputedStyle(n);
        if (cs.transform && cs.transform !== "none" && /matrix|scale/.test(cs.transform)) {
          // a scale/transform on a container wrapping interactive content = mockup
          const m = cs.transform.match(/matrix\(([^,]+),/);
          const sx = m ? Math.abs(parseFloat(m[1])) : 1;
          if (sx !== 1) return true; // actually scaled, not just translated
        }
        if (n.getAttribute && n.getAttribute("aria-hidden") === "true") return true;
        n = n.parentElement;
        depth++;
      }
      return false;
    }
    // Is the element actually visible on the page, or present-in-DOM-but-hidden?
    // Mega-nav dropdowns, off-canvas menus, and collapsed accordions live in the
    // DOM but aren't on screen until interaction. Auditing them as "on this
    // screen" is wrong — it counted Stripe's 17 hidden mega-nav CTAs as competing
    // primary actions. Check the element and its ancestors for display:none /
    // visibility:hidden / opacity:0 / zero size.
    // Only the UNAMBIGUOUS hidden cases: display:none and visibility:hidden.
    // These mean "genuinely not rendered" — mega-nav dropdowns and collapsed
    // accordions use them. Deliberately NOT checking opacity:0 or zero-size:
    // those catch lazy-loaded / scroll-fade-in content (Allbirds' product grid
    // fades in at opacity:0, renders zero-size until scrolled to) and wrongly
    // hide the real page. Blunt visibility rules nuke real content — keep it
    // narrow to what's provably off.
    function visible(el) {
      let n = el,
        depth = 0;
      while (n && n.nodeType === 1 && depth < 25) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse")
          return false;
        n = n.parentElement;
        depth++;
      }
      return true;
    }
    function cssPath(el) {
      // short, human-usable selector — not bulletproof, but points a human at it
      if (el.id) return `#${el.id}`;
      const parts = [];
      let n = el;
      while (n && n.nodeType === 1 && parts.length < 4) {
        let seg = n.tagName.toLowerCase();
        if (n.className && typeof n.className === "string") {
          const c = n.className.trim().split(/\s+/)[0];
          if (c) seg += `.${c}`;
        }
        parts.unshift(seg);
        n = n.parentElement;
      }
      return parts.join(" > ");
    }

    const SEL = "button, a, input, select, textarea, form, [role], h1, h2, h3, p, span, label";
    // Filter out provably-hidden elements (display:none / visibility:hidden mega-
    // menus, collapsed accordions) BEFORE the 400 cap. Otherwise on nav-heavy
    // pages the cap is spent on the hidden mega-menu (which sits early in the DOM)
    // and the real content — product grid, article list — gets truncated away and
    // never captured. Spend the budget on visible content.
    const ELEMENT_CAP = 400;
    const all = Array.from(document.querySelectorAll(SEL));
    const visibleAll = all.filter((el) => visible(el));
    const nodes = visibleAll.slice(0, ELEMENT_CAP);
    // Report truncation so whole-page checks (help, density) can tell they saw a
    // PARTIAL page. Asserting "0 help affordances" from the top half of a tall
    // page (DoorDash's footer help link sits below the cap) would be the tool
    // lying by omission — exactly what it must not do.
    const truncated = visibleAll.length > ELEMENT_CAP;
    const totalVisible = visibleAll.length;
    const elements = nodes.map((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const attrs = {};
      for (const a of el.attributes) attrs[a.name] = a.value;
      const text = (el.innerText || el.value || "").slice(0, 120);
      const fg = cs.color;
      const bg = effectiveBg(el);
      return {
        selector: cssPath(el),
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        text,
        ariaLabel: el.getAttribute("aria-label") || "",
        styles: {
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          borderRadius: cs.borderRadius,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight, // for WCAG large-text threshold (bold + size)
        },
        rect: { w: rect.width, h: rect.height },
        attrs,
        contrast: text.trim() ? contrast(fg, bg) : null,
        inDemo: inDemo(el),
        visible: visible(el),
      };
    });

    return { url: location.href, title: document.title, elements, truncated, totalVisible };
  });

  await browser.close();
  return snap;
}
