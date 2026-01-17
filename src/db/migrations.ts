import fs from "fs";
import path from "path";
import { getDb } from "./index";

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT id FROM _migrations").all().map((r: any) => r.id)
  );

  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const now = Date.now();

    const tx = db.transaction(() => {
      db.exec(sql);
      db
        .prepare(
          "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)"
        )
        .run(file, now);
    });

    tx();
  }
}
