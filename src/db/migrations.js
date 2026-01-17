"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("./index");
function runMigrations() {
    const db = (0, index_1.getDb)();
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
    const applied = new Set(db.prepare("SELECT id FROM _migrations").all().map((r) => r.id));
    const migrationsDir = path_1.default.join(process.cwd(), "migrations");
    if (!fs_1.default.existsSync(migrationsDir))
        return;
    const files = fs_1.default
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort();
    for (const file of files) {
        if (applied.has(file))
            continue;
        const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), "utf8");
        const now = Date.now();
        const tx = db.transaction(() => {
            db.exec(sql);
            db
                .prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)")
                .run(file, now);
        });
        tx();
    }
}
//# sourceMappingURL=migrations.js.map