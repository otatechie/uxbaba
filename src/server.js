// Thin HTTP API around the audit engine — the piece a host app (Laravel, or any
// front-end) calls over HTTP instead of shelling out to the CLI. Node stays warm
// between requests, so there's no per-call process startup, and the engine can
// run as its own service/container separate from the app.
//
// Zero dependencies — built-in http only. One real endpoint:
//
//   POST /audit   body: { url, goal, persona? }
//                 → 200 { ok:true, ... the runAudit() JSON ... }
//                 → 422 { ok:false, error } for bad input / bot-block / capture fail
//   GET  /health  → 200 { ok:true, service:"ux-guide", version }
//
// Run: node src/server.js   (PORT env, default 8787)
// Concurrency note: each audit launches headless Chromium (~5–8s, memory-heavy).
// This server runs them inline; a production host should put a queue in front and
// bound concurrency. Kept simple here on purpose — see README/plan.

import { createServer } from "node:http";
import { runAudit } from "./audit.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 8787;
const VERSION = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)))
).version;

// Cap request bodies — an audit request is tiny (a URL + a sentence).
const MAX_BODY = 4 * 1024;

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "ux-guide", version: VERSION });
  }

  if (req.method === "POST" && req.url === "/audit") {
    let payload;
    try {
      const raw = await readBody(req);
      payload = raw ? JSON.parse(raw) : {};
    } catch (err) {
      return send(res, 400, { ok: false, error: `invalid request body: ${err.message}` });
    }

    const { url, goal, persona } = payload;
    if (!url || !goal) {
      return send(res, 422, { ok: false, error: "url and goal are required." });
    }

    // runAudit never throws for expected failures — it returns { ok:false, error }.
    // A 5xx here means an unexpected engine crash, which we still return as JSON.
    let result;
    try {
      result = await runAudit(url, goal, persona);
    } catch (err) {
      return send(res, 500, { ok: false, error: `engine error: ${err.message}` });
    }
    // Bad input / bot-block / capture failure → 422 (client-actionable), else 200.
    return send(res, result.ok ? 200 : 422, result);
  }

  send(res, 404, { ok: false, error: "not found — try GET /health or POST /audit" });
});

server.listen(PORT, () => {
  console.log(`ux-guide API v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`  GET  /health`);
  console.log(`  POST /audit   { "url": "...", "goal": "...", "persona": "..." }`);
});
