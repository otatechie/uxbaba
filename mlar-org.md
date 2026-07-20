# UX Guide report — https://www.mlar.org/

**Goal:** donate to support the animals
**Persona:** first-time visitor on their phone
**Page:** Main Line Animal Rescue | Leaders in Animal Welfare

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H4 Consistency and standards** _(measured, medium)_ — **4 elements share this** (e.g. #nav_donate, div.col-lg-5 > div.foot-link > p > a, div.col-lg-5 > div.foot-link > p > a)
  Text "DONATE…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - _contrast 2.75:1 (WCAG AA needs 4.5:1 for normal text)_

- **H5 Error prevention** _(measured, medium)_ — **2 elements share this** (e.g. div.mainCommonDiv > div.col-lg-12 > div.carousel > a.left, div.mainCommonDiv > div.col-lg-12 > div.carousel > a.right)
  "Previous" is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.
  - _button 23×237px (min side 23px < 24, WCAG 2.2 SC 2.5.8)_

## Judged — goal-alignment, only if grounded in a cited element

_Nothing grounded to flag._

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
