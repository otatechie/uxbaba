# UX Guide report — https://news.ycombinator.com/

**Goal:** read the top tech story right now
**Persona:** casual visitor on their phone
**Page:** Hacker News

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H4 Consistency and standards** _(measured, medium)_ — **310 elements share this** (e.g. tbody > tr.athing > td.title > span.rank, tbody > tr.athing > td.title > span.titleline, tr.athing > td.title > span.titleline > span.sitebit)
  Text "1.…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - _contrast 3.54:1 (WCAG AA needs 4.5:1 for normal text)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _191 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Nothing grounded to flag._

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
