"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateIfReady = aggregateIfReady;
const db_1 = require("../db");
const service_1 = require("../runs/service");
function safeJson(s) {
    if (!s)
        return null;
    try {
        return JSON.parse(s);
    }
    catch {
        return s;
    }
}
function aggregateIfReady(args) {
    const db = (0, db_1.getDb)();
    const children = db
        .prepare(`
      SELECT id, status, result_json, error_json, provider, model
      FROM runs
      WHERE root_id = ?
        AND parent_id = ?
      ORDER BY created_at ASC
    `)
        .all(args.rootRunId, args.parentRunId);
    if (children.length === 0)
        return { ready: false };
    const unfinished = children.filter(c => c.status === "queued" || c.status === "running");
    if (unfinished.length > 0)
        return { ready: false };
    const successes = children.filter(c => c.status === "succeeded" && c.result_json);
    const failures = children.filter(c => c.status === "failed");
    const result = {
        summary: {
            total: children.length,
            succeeded: successes.length,
            failed: failures.length
        },
        outputs: successes.map(s => ({
            provider: s.provider,
            model: s.model,
            output: safeJson(s.result_json)
        })),
        errors: failures.map(f => ({
            provider: f.provider,
            model: f.model,
            error: safeJson(f.error_json)
        }))
    };
    const status = successes.length > 0 ? "succeeded" : "failed";
    (0, service_1.updateRunStatus)(args.parentRunId, status, {
        result,
        finishedAt: Date.now()
    });
    return { ready: true };
}
//# sourceMappingURL=aggregate.js.map