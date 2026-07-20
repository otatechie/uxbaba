# UX Guide report — https://www.apple.com/shop/buy-iphone

**Goal:** goal
**Persona:** persona
**Page:** Buy iPhone - Apple

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H1 Visibility of system status** _(measured, medium)_
  There's an action that likely triggers async work, but no live region (aria-live/role=status) to announce progress or result. Users won't know the system heard them.
  - `div.rf-navbar-content-wrapper > div.rf-navbar-content > div.paddlenav > button.paddlenav-arrow`
  - _6 action button(s), 0 aria-live/status regions_

- **H8 Aesthetic and minimalist design** _(measured, medium)_
  Multiple identically-styled primary actions on one screen. Krug's rule: there should be one obvious next step. When everything shouts, nothing does.
  - `div.rf-hcard-content > div.rf-hcard-content-info > div.rf-hcard-scrim > a.rf-hcard-cta`
  - _5 buttons share the same prominent fill color (competing primary CTAs)_

- **H5 Error prevention** _(measured, medium)_
  "See all iPhone values" is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.
  - `div.rc-ribbon-gallery-item > div.rc-ribbon-content-item-base > div > a.icon`
  - _button 341×20px (min side 20px < 24, WCAG 2.2 SC 2.5.8)_

- **H5 Error prevention** _(measured, medium)_
  "Connect with a Specialist
(Opens in a new window)" is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.
  - `div.rf-shop-chat-section > div.rf-shop-chat-container > div.rf-shop-chat-content > a.as-chat-button`
  - _button 174×20px (min side 20px < 24, WCAG 2.2 SC 2.5.8)_

- **H4 Consistency and standards** _(measured, medium)_
  Text "Next…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - `div.rf-navbar-content-wrapper > div.rf-navbar-content > div.paddlenav > button.paddlenav-arrow`
  - _contrast 3.33:1 (WCAG AA needs 4.5:1 for normal text)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _74 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Judge call failed (abstained, invented nothing): 402 This request requires more credits, or fewer max_tokens. You requested up to 32000 tokens, but can only afford 22134. To increase, visit https://openrouter.ai/settings/credits and add more credits_

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
