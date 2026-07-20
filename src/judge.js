// The fenced LLM layer. This is the ONLY place a model runs, and it is boxed in
// on every side so it cannot behave like a scanner:
//
//   1. It never sees a screenshot. It sees the captured DOM facts + the user's
//      stated intent. It cannot "perceive" problems into existence.
//   2. Every finding it returns MUST cite `selector` — a real element from the
//      snapshot. Any finding whose selector isn't in the snapshot is DROPPED
//      before the user ever sees it (validate() below). Grounding is enforced
//      mechanically, not requested politely.
//   3. Abstaining is a valid, encouraged answer. Returning [] is success.
//
// This module is written so it runs WITHOUT any API key (returns a clearly
// labelled stub), so the skeleton is runnable today. Wire a real Claude API
// call in callModel() when you're ready — the schema and validation stay the same.

import { HEURISTICS } from "./heuristics.js";
import OpenAI from "openai";
import "dotenv/config";

const JUDGMENT_HEURISTICS = HEURISTICS.filter((h) => h.layer === "judgment");

// OpenRouter is OpenAI-compatible, so we use the OpenAI SDK pointed at it.
// Model is a Claude model routed through OpenRouter (best structured-output
// support). validate() still guards grounding regardless of provider.
const MODEL = "anthropic/claude-opus-4.1";
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_URL || "https://openrouter.ai/api/v1",
    })
  : null;

function buildPrompt(snap, intent) {
  // Only send the LLM what it needs to judge: text-bearing elements + intent.
  // No pixels. No invitation to "find problems" — it judges specific questions.
  const elements = snap.elements
    .filter((e) => (e.text && e.text.trim()) || e.ariaLabel)
    .slice(0, 120)
    .map((e) => ({ selector: e.selector, tag: e.tag, role: e.role, text: e.text, ariaLabel: e.ariaLabel }));

  return {
    system:
      "You are a UX critique assistant operating under strict grounding rules. " +
      "You are given (a) the user's stated goal for a screen and (b) a list of real elements captured from that screen's DOM. " +
      "You may ONLY raise a finding if you can cite the exact `selector` of a real element from the provided list. " +
      "If you cannot ground a concern in a specific listed element, do NOT raise it. " +
      "Returning an empty list is a correct and preferred answer when nothing is clearly wrong. " +
      "You are answering specific heuristic questions about goal-alignment, not hunting for problems.",
    user: {
      statedGoal: intent.goal,
      persona: intent.persona,
      questions: JUDGMENT_HEURISTICS.map((h) => ({ heuristicId: h.id, name: h.name, ask: h.prompt })),
      elements,
      responseFormat:
        "Return JSON: { findings: [ { heuristicId, selector, quote, message, confidence: 'low'|'medium'|'high' } ] }. " +
        "`selector` MUST be copied verbatim from an element above. `quote` MUST be text that appears in that element. " +
        "Omit any finding you are not confident is grounded.",
    },
  };
}

// Real call, contract unchanged: input = { system, user }, output = { findings }.
// No key → honest stub (returns nothing, never invents). With a key, we ask for
// a JSON object; whatever comes back still passes through validate() below, so a
// malformed or ungrounded response is dropped, not shown.
async function callModel(prompt) {
  if (!client) {
    return {
      _stub: true,
      findings: [], // honest: no key, no judgment — we do NOT invent findings
    };
  }
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      // A grounded findings list is small (a handful of JSON objects). Cap output
      // explicitly — without this, OpenRouter reserved the model default (~32000)
      // and 402'd when account credit couldn't cover it. 2000 is ample headroom.
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        {
          role: "user",
          content:
            JSON.stringify(prompt.user) +
            "\n\nRespond with ONLY the JSON object described in responseFormat. No prose.",
        },
      ],
    });
    const text = res.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(text);
    return { findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
  } catch (err) {
    // A failed/garbled call must NOT invent findings — abstain loudly instead.
    return { _error: String(err.message || err), findings: [] };
  }
}

// Mechanical grounding enforcement: drop any finding whose selector or quote
// does not actually exist in the snapshot. This is what makes it not-a-scanner.
function validate(raw, snap) {
  const bySelector = new Map(snap.elements.map((e) => [e.selector, e]));
  const kept = [];
  const dropped = [];
  for (const f of raw.findings || []) {
    const el = bySelector.get(f.selector);
    if (!el) {
      dropped.push({ ...f, reason: "selector not in snapshot (hallucinated element)" });
      continue;
    }
    if (f.quote && !((el.text || "") + (el.ariaLabel || "")).includes(f.quote)) {
      dropped.push({ ...f, reason: "quote not found in cited element" });
      continue;
    }
    if (f.confidence === "low") {
      dropped.push({ ...f, reason: "low confidence — suppressed by default" });
      continue;
    }
    kept.push({
      heuristicId: f.heuristicId,
      selector: f.selector,
      measured: f.quote ? `quoted: "${f.quote}"` : "goal-alignment judgment",
      message: f.message,
      severity: f.confidence === "high" ? "medium" : "low",
      source: "judgment",
    });
  }
  return { kept, dropped, stub: !!raw._stub, error: raw._error || null };
}

export async function judge(snap, intent) {
  const prompt = buildPrompt(snap, intent);
  const raw = await callModel(prompt);
  return validate(raw, snap);
}
