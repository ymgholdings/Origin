"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRun = createRun;
exports.updateRunStatus = updateRunStatus;
exports.enqueueTask = enqueueTask;
exports.getRunTree = getRunTree;
const crypto_1 = require("crypto");
const db_1 = require("../db");
function now() {
    return Date.now();
}
function createRun(args) {
    const db = (0, db_1.getDb)();
    const id = (0, crypto_1.randomUUID)();
    const root_id = args.rootId ?? id;
    const created_at = now();
    const rec = {
        id,
        parent_id: args.parentId ?? null,
        root_id,
        kind: args.kind,
        status: args.status ?? "queued",
        task_name: args.taskName,
        provider: args.provider ?? null,
        model: args.model ?? null,
        prompt_json: JSON.stringify(args.prompt ?? {}),
        result_json: null,
        error_json: null,
        attempt: 0,
        max_attempts: args.maxAttempts ?? 2,
        created_at,
        updated_at: created_at,
        started_at: null,
        finished_at: null
    };
    db.prepare("INSERT INTO runs (" +
        "id, parent_id, root_id, kind, status, task_name, " +
        "provider, model, prompt_json, result_json, error_json, " +
        "attempt, max_attempts, created_at, updated_at, started_at, finished_at" +
        ") VALUES (" +
        "@id, @parent_id, @root_id, @kind, @status, @task_name, " +
        "@provider, @model, @prompt_json, @result_json, @error_json, " +
        "@attempt, @max_attempts, @created_at, @updated_at, @started_at, @finished_at" +
        ")").run(rec);
    return rec;
}
function updateRunStatus(runId, status, extras) {
    const db = (0, db_1.getDb)();
    const updated_at = now();
    const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);
    if (!row)
        throw new Error("Run not found: " + runId);
    const sets = ["status = ?", "updated_at = ?"];
    const params = [status, updated_at];
    if (extras?.result !== undefined) {
        sets.push("result_json = ?");
        params.push(JSON.stringify(extras.result));
    }
    if (extras?.error !== undefined) {
        sets.push("error_json = ?");
        params.push(JSON.stringify(extras.error));
    }
    sets.push("started_at = ?");
    params.push(extras?.startedAt !== undefined ? extras.startedAt : row.started_at);
    sets.push("finished_at = ?");
    params.push(extras?.finishedAt !== undefined ? extras.finishedAt : row.finished_at);
    params.push(runId);
    const sql = "UPDATE runs SET " + sets.join(", ") + " WHERE id = ?";
    db.prepare(sql).run(...params);
}
function enqueueTask(args) {
    const db = (0, db_1.getDb)();
    const id = (0, crypto_1.randomUUID)();
    const created_at = now();
    const rec = {
        id,
        run_id: args.runId,
        status: args.status ?? "queued",
        queue: args.queue,
        payload_json: JSON.stringify(args.payload ?? {}),
        locked_by: null,
        locked_at: null,
        available_at: args.availableAt ?? created_at,
        attempt: 0,
        max_attempts: args.maxAttempts ?? 2,
        created_at,
        updated_at: created_at
    };
    db.prepare("INSERT INTO tasks (" +
        "id, run_id, status, queue, payload_json, " +
        "locked_by, locked_at, available_at, attempt, max_attempts, created_at, updated_at" +
        ") VALUES (" +
        "@id, @run_id, @status, @queue, @payload_json, " +
        "@locked_by, @locked_at, @available_at, @attempt, @max_attempts, @created_at, @updated_at" +
        ")").run(rec);
    return rec;
}
function getRunTree(rootId) {
    const db = (0, db_1.getDb)();
    const runs = db
        .prepare("SELECT * FROM runs WHERE root_id = ? ORDER BY created_at ASC")
        .all(rootId);
    const events = db
        .prepare("SELECT e.* FROM events e " +
        "JOIN runs r ON r.id = e.run_id " +
        "WHERE r.root_id = ? " +
        "ORDER BY e.created_at ASC")
        .all(rootId);
    return { runs, events };
}
//# sourceMappingURL=service.js.map