import fs from "node:fs";
import path from "node:path";

export function migrate(db: { exec: (sql: string) => unknown }) {
  const dir = path.resolve("migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec(sql);
  }
}
