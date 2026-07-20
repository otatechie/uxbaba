# UX Guide report — https://www.duolingo.com/

**Goal:** start learning a language for free
**Persona:** new learner on their phone
**Page:** Duolingo - The world’s most popular way to learn

This tool flags less on purpose — every finding below names a real element and a real number. It does not guess. Sections it can't evaluate from a static pass are listed honestly at the end.

## Measured — grounded in real elements, cannot hallucinate

- **H4 Consistency and standards** _(measured, medium)_ — **9 elements share this** (e.g. div._15kfC > div._28m3G > div._1-0oK > button._2V6ug, div._28m3G > div._1-0oK > button._2V6ug > span._2NRlK, div._2Yq-n > p.KsAV5 > span > a._1F7oE)
  Text "I ALREADY HAVE AN ACCOUNT…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - _contrast 2.44:1 (WCAG AA needs 4.5:1 for normal text)_

- **H4 Consistency and standards** _(measured, medium)_ — **10 elements share this** (e.g. section.uU0-M > section._3k9io > div._2Yq-n > h2._3X-2C, section.uU0-M > section._36L7f > div._2Yq-n > h2._3X-2C, section.uU0-M > section._3k9io > div._2Yq-n > h2._3X-2C)
  Text "free. fun. effective.…" fails WCAG 2.2 SC 1.4.3 contrast (large-text threshold). Computed, not guessed.
  - _contrast 2.09:1 (WCAG AA needs 3:1 for large text)_

- **H4 Consistency and standards** _(measured, medium)_ — **8 elements share this** (e.g. section.uU0-M > section._3k9io > div._2Yq-n > p.KsAV5, section._3k9io > div._2Yq-n > p.KsAV5 > span, section.uU0-M > section._36L7f > div._2Yq-n > p.KsAV5)
  Text "Learning with Duolingo is fun,…" fails WCAG 2.2 SC 1.4.3 contrast (normal-text threshold). Computed, not guessed.
  - _contrast 4.48:1 (WCAG AA needs 4.5:1 for normal text)_

- **H8 Aesthetic and minimalist design** _(measured, low)_
  Very high interactive-element density. Not automatically wrong, but worth asking which of these serve the stated goal and which are noise.
  - `body`
  - _77 interactive elements on one screen_

## Judged — goal-alignment, only if grounded in a cited element

_Judge call failed (abstained, invented nothing): 402 This request requires more credits, or fewer max_tokens. You requested up to 32000 tokens, but can only afford 22134. To increase, visit https://openrouter.ai/settings/credits and add more credits_

## Not evaluated — honestly out of reach for a static pass

- **H2 Match between system and the real world** — Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.
- **H6 Recognition rather than recall** — Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.
- **H7 Flexibility and efficiency of use** — Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.
- **H9 Help users recognize, diagnose, and recover from errors** — Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.
