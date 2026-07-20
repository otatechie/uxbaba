# UX Guide report — https://www.bbc.com/news

**Goal:** read top news
**Persona:** reader
**Page:** BBC News - Breaking news, video and the latest top stories from the U.S. and around the world

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H5 Error prevention** _(measured, medium)_
  "control" is below the WCAG 2.2 minimum target size (24×24px). Increases mis-taps.
  - `div.Header-styles__HeaderContentStyled-sc-36071384-1 > div.Header-styles__HeaderButtonsContainerStyled-sc-36071384-6 > div.AccountButtons-styles__AccountButtonsMobileContainerStyled-sc-32916240-9 > button.AccountButtons-styles__AccountMobileToggleButtonStyled-sc-32916240-0`
  - _button 32×20px (min side 20px < 24, WCAG 2.2 SC 2.5.8)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _101 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Judge call failed (abstained, invented nothing): 402 This request requires more credits, or fewer max_tokens. You requested up to 32000 tokens, but can only afford 22134. To increase, visit https://openrouter.ai/settings/credits and add more credits_

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
