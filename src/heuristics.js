// Nielsen's 10 usability heuristics as a LAYERED rule table.
//
// This table is the whole engine. The point of the project is that not all 10
// heuristics are the same *kind* of thing. A scanner treats all 10 as "ask the
// AI" — which is why it hallucinates. Here each heuristic declares its layer:
//
//   'deterministic' — checkable from the DOM in code. Cannot hallucinate.
//                     Has a `check` implemented in src/checks/.
//   'judgment'      — needs interpretation given the user's stated intent.
//                     Handed to the fenced LLM layer, which MUST cite a real
//                     element or it is dropped.
//   'abstain'       — genuinely not evaluable from a static artifact. The tool
//                     says so out loud instead of faking a verdict. This honest
//                     silence is a feature, not a gap.
//
// `checkId` maps a deterministic heuristic to a function in src/checks/index.js.

export const HEURISTICS = [
  {
    id: 1,
    name: "Visibility of system status",
    layer: "deterministic",
    checkId: "systemStatus",
    note: "Async actions should have a visible feedback affordance (aria-live, role=status, spinner).",
  },
  {
    id: 2,
    name: "Match between system and the real world",
    layer: "abstain",
    note:
      "Whether wording matches the user's language (jargon vs plain speech) is a judgment call a static pass can't make reliably — a deterministic 'jargon' check would misfire on legitimate domain terms. Evaluate with a real user reading the copy, or a card-sort of the terminology.",
    // Judge-layer prompt kept for when Layer 3 is fed enough to run this well:
    prompt:
      "Does any user-facing text use system/developer jargon instead of the user's own language? Only flag if you can quote the exact text.",
  },
  {
    id: 3,
    name: "User control and freedom",
    layer: "deterministic",
    checkId: "userControl",
    note: "Multi-step or destructive flows should offer an escape hatch (cancel / back / undo).",
  },
  {
    id: 4,
    name: "Consistency and standards",
    layer: "deterministic",
    checkId: "consistency",
    note: "The same semantic action should not be styled multiple different ways.",
  },
  {
    id: 5,
    name: "Error prevention",
    layer: "deterministic",
    checkId: "errorPrevention",
    note: "Destructive actions should confirm; required inputs should be constrained.",
  },
  {
    id: 6,
    name: "Recognition rather than recall",
    layer: "abstain",
    note:
      "Whether the UI forces users to remember information across steps depends on the actual task flow, which a single-page static pass can't trace. Evaluate by walking the real multi-step flow and noting where prior context disappears.",
    prompt:
      "Given the stated goal, does the flow force the user to remember information across steps that the UI could instead show them? Cite the specific element.",
  },
  {
    id: 7,
    name: "Flexibility and efficiency of use",
    layer: "abstain",
    note:
      "Whether experts have accelerators (shortcuts, saved states, bulk actions) is about the interaction over time, not the static markup. Evaluate by testing the flow as an experienced user, or checking for documented keyboard shortcuts.",
    prompt:
      "Given the persona, are there accelerators for experienced users, or is everyone forced down the beginner path? Only flag if grounded in a real element.",
  },
  {
    id: 8,
    name: "Aesthetic and minimalist design",
    layer: "deterministic", // element-count part is deterministic; nuance is judged in the LLM pass too
    checkId: "minimalism",
    note: "Count competing primary actions and visible interactive elements (Krug overlap: one obvious next step).",
  },
  {
    id: 9,
    name: "Help users recognize, diagnose, and recover from errors",
    layer: "abstain",
    note:
      "Cannot be judged statically — the error must be TRIGGERED to see its message. A static tool that claims a verdict here is guessing. Drive the flow to test this.",
  },
  {
    id: 10,
    name: "Help and documentation",
    layer: "deterministic",
    checkId: "help",
    note: "Help/documentation should exist and be reachable from the screen.",
  },
];
