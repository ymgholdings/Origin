"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
let db = null;
function getDb() {
    if (db)
        return db;
    const dbPath = process.env.ORIGIN_DB_PATH ||
        path_1.default.join(process.cwd(), "data", "origin.db");
    db = new better_sqlite3_1.default(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return db;
}
//# sourceMappingURL=index.js.map