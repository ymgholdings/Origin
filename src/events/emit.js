"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitEvent = emitEvent;
const crypto_1 = require("crypto");
const db_1 = require("../db");
function emitEvent(args) {
    const db = (0, db_1.getDb)();
    const id = (0, crypto_1.randomUUID)();
    const created_at = Date.now();
    db.prepare(`
    INSERT INTO events (id, run_id, level, type, message, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, args.runId, args.level, args.type, args.message ?? null, args.data ? JSON.stringify(args.data) : null, created_at);
}
//# sourceMappingURL=emit.js.map