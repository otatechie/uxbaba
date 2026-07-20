// JSON CLI entry point — a thin wrapper over runAudit() in audit.js. Runs the
// exact same grounded pipeline, but emits a single JSON object on stdout instead
// of a pretty terminal report. The bridge for a host process (e.g. a Laravel
// queue worker) that shells out to this Node engine and parses the result.
//
// Usage:
//   node src/run-json.js <url> "<goal>" ["persona"]
// Output (stdout): { ok, url, title, goal, persona, truncated, measured[],
//   judged[], notEvaluated[], summary }
// On failure (stdout): { ok:false, error } with a non-zero exit code.

import { runAudit } from "./audit.js";

const [url, goal, persona] = process.argv.slice(2);

const result = await runAudit(url, goal, persona);
process.stdout.write(JSON.stringify(result) + "\n");
process.exit(result.ok ? 0 : 1);
