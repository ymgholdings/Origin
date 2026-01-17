import { randomUUID } from "crypto";
import { getDb } from "../db";

export function emitEvent(args: {
  runId: string;
  level: "debug" | "info" | "warn" | "error";
  type: string;
  message?: string;
  data?: any;
}): void {
  const db = getDb();
  const id = randomUUID();
  const created_at = Date.now();

  db.prepare(
    `
    INSERT INTO events (id, run_id, level, type, message, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    args.runId,
    args.level,
    args.type,
    args.message ?? null,
    args.data ? JSON.stringify(args.data) : null,
    created_at
  );
}
