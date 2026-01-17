"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaseNextTask = leaseNextTask;
exports.completeTask = completeTask;
const db_1 = require("../db");
function now() {
    return Date.now();
}
function leaseNextTask(opts) {
    const db = (0, db_1.getDb)();
    const t = now();
    const tx = db.transaction(() => {
        const row = db.prepare(`
      SELECT id, run_id, payload_json, attempt, max_attempts
      FROM tasks
      WHERE status = 'queued'
        AND queue = ?
        AND available_at <= ?
        AND (locked_by IS NULL OR locked_at IS NULL OR locked_at < ?)
      ORDER BY created_at ASC
      LIMIT 1
    `).get(opts.queue, t, t - opts.leaseMs);
        if (!row)
            return null;
        const updated = db.prepare(`
      UPDATE tasks
      SET status = 'running',
          locked_by = ?,
          locked_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(opts.workerId, t, t, row.id);
        if (updated.changes !== 1)
            return null;
        return {
            taskId: row.id,
            runId: row.run_id,
            payload: JSON.parse(row.payload_json),
            attempt: row.attempt,
            maxAttempts: row.max_attempts
        };
    });
    return tx();
}
function completeTask(taskId, status, extras) {
    const db = (0, db_1.getDb)();
    const updated_at = now();
    const row = db
        .prepare("SELECT attempt FROM tasks WHERE id = ?")
        .get(taskId);
    if (!row)
        return;
    const nextAttempt = extras?.attemptInc ? row.attempt + 1 : row.attempt;
    db.prepare(`
    UPDATE tasks
    SET status = ?,
        attempt = ?,
        locked_by = NULL,
        locked_at = NULL,
        available_at = COALESCE(?, available_at),
        updated_at = ?
    WHERE id = ?
  `).run(status, nextAttempt, extras?.availableAt ?? null, updated_at, taskId);
}
//# sourceMappingURL=leasing.js.map