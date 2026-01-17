import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

export async function makeTempDb() {
  const SQL = await initSqlJs();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "origin-conductor-"));
  const dbPath = path.join(dir, "test.sqlite");
  const db = new SQL.Database();

  return {
    db,
    dbPath,
    cleanup: () => {
      try { db.close(); } catch {}
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}
