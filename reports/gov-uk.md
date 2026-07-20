# UX Guide report — https://www.gov.uk/

**Goal:** find a service
**Persona:** citizen
**Page:** Welcome to GOV.UK

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H4 Consistency and standards** _(measured, medium)_
  Text "Search
Search GOV.UK…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - `div.govuk-width-container > div.govuk-grid-row > div.homepage-header__search > form`
  - _contrast 4.06:1 (WCAG AA needs 4.5:1 for normal text)_

- **H4 Consistency and standards** _(measured, medium)_
  Text "Search GOV.UK…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - `div.gem-c-search > div.gem-c-search__item-wrapper > div.gem-c-search__item > button.gem-c-search__submit`
  - _contrast 3.91:1 (WCAG AA needs 4.5:1 for normal text)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _88 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Judge call failed (abstained, invented nothing): 402 This request requires more credits, or fewer max_tokens. You requested up to 32000 tokens, but can only afford 22134. To increase, visit https://openrouter.ai/settings/credits and add more credits_

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
