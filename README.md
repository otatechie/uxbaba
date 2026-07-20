# UX Guide

A UX guide, **not** an AI scanner.

Existing AI heuristic tools feel confusing and untrustworthy because they hand a
screenshot to a model and ask "find problems" — so it invents plausible ones.
This does the opposite.

## The one rule

**The LLM never asserts a fact it can't see.** Everything measurable is computed
in code from the real DOM. The model is used only for goal-alignment judgment,
is fed the user's stated intent, must cite a real element, and is allowed — even
encouraged — to say nothing.

## Three layers = three altitudes

| Layer | Framework | What it does | Can it lie? |
|-------|-----------|--------------|-------------|
| 1 Intent | **Cooper** | Requires the screen's goal + persona as input | — |
| 2 Measured | **Nielsen / Krug** | Deterministic DOM checks (contrast, tap size, consistency, primary-action count…) | No — real element + real number |
| 3 Judged | **Cooper** | LLM asks goal-alignment questions, must cite a real element, may abstain | Grounding enforced mechanically |

Nielsen's 10 are split by layer in `src/heuristics.js`: ~6 deterministic, 3
judgment, and **H9 (error recovery) openly abstains** — you can't judge an error
message without triggering the error. Saying so is a feature.

## Run it

```bash
npm install
npx playwright install chromium
node src/run.js https://example.com "what the user should accomplish here" "optional persona"
```

## Use it as a service

The engine is also an importable function and an HTTP API, so a host app (e.g. a
Laravel backend) can drive it without the terminal.

- **Library:** `import { runAudit } from "./src/audit.js"` → `runAudit(url, goal, persona)`
  resolves to the report JSON (or `{ ok:false, error }` on bad input / bot-block).
- **JSON CLI:** `node src/run-json.js <url> "<goal>" ["persona"]` — one JSON object on stdout.
- **HTTP API:** `npm run serve` (PORT env, default 8787)
  - `GET  /health` → `{ ok, service, version }`
  - `POST /audit`  body `{ url, goal, persona? }` → `200` report JSON, or `422 { ok:false, error }`

`run-json.js`, `server.js`, and the pretty CLI all call the **same** `runAudit()`
pipeline in `src/audit.js` — one grounded pipeline, no duplicated analysis. Each
audit launches headless Chromium (~5–8s, memory-heavy); a production host should
queue requests and bound concurrency rather than run them all inline.

Runs today with **no API key** — the judgment layer returns nothing rather than
inventing findings. The LLM call in `src/judge.js` is already wired: it uses the
OpenAI SDK pointed at **OpenRouter** (`OPENAI_API_KEY` + optional `OPENAI_URL`,
model `anthropic/claude-opus-4.1`). Set those in `.env` to enable Layer 3. The
grounding validator (`validate()`) still drops any finding the model can't tie to
a real element.

> Note: Layer 3 is currently **dormant even with a key** — no heuristic is tagged
> `judgment` in `src/heuristics.js` (H2/H6/H7 sit in `abstain`), so the model is
> asked nothing and returns `[]`. Re-tag those to `judgment` to activate it.

## Why this isn't the scanner

- **DOM, not screenshot** — measurement, not perception.
- **Abstention is success** — sparse + true beats dense + guessed.
- **Every finding is clickable** — points at a real selector + a real number.
- **Intent is required** — no goal, no evaluation. That's the Cooper input no
  scanner has.
