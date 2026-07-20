# UX Guide report — https://stripe.com/

**Goal:** understand what Stripe does and sign up
**Persona:** founder evaluating on their phone
**Page:** Stripe | Financial Infrastructure to Grow Your Revenue

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H1 Visibility of system status** _(measured, medium)_
  There's an action that likely triggers async work, but no live region (aria-live/role=status) to announce progress or result. Users won't know the system heard them.
  - `div.modular-solutions-bento > div.modular-solutions-bento__content > div.modular-solutions-bento__layout > button.modular-solutions-bento-card`
  - _4 action button(s), 0 aria-live/status regions_

- **H8 Aesthetic and minimalist design** _(measured, medium)_
  Multiple identically-styled primary actions on one screen. Krug's rule: there should be one obvious next step. When everything shouts, nothing does.
  - `div.section-container > div.hero-section__layout-grid > div.hds-button-group > a.hds-button`
  - _6 buttons share the same prominent fill color (competing primary CTAs)_

- **H4 Consistency and standards** _(measured, medium)_
  Text "Financial infrastructure to gr…" fails WCAG 2.2 SC 1.4.3 contrast (large-text threshold). Computed, not guessed.
  - `section.hds-color-mode > div.section-container > div.hero-section__layout-grid > h1.hds-heading`
  - _contrast 2.39:1 (WCAG AA needs 3:1 for large text)_

- **H5 Error prevention** _(measured, medium)_
  "Hertz unifies commerce with Stripe." is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.
  - `div.customer-stories > div.customer-stories__customer > div.customer-stories__customer-summary > button.customer-stories__customer-button`
  - _button 318×23px (min side 23px < 24, WCAG 2.2 SC 2.5.8)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _163 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Judge call failed (abstained, invented nothing): 402 This request requires more credits, or fewer max_tokens. You requested up to 32000 tokens, but can only afford 22134. To increase, visit https://openrouter.ai/settings/credits and add more credits_

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
