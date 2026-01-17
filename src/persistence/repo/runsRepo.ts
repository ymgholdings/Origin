export type RunState = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface RunRecord {
  id: string;
  created_at: string;
  updated_at: string;
  state: RunState;
  meta?: unknown;
}

export class RunsRepo {
  constructor(private db: any) {}

  insert(run: RunRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO runs (id, created_at, updated_at, state, meta)
      VALUES (?, ?, ?, ?, json(?))
    `);

    const params = [
      run.id,
      run.created_at,
      run.updated_at,
      run.state,
      JSON.stringify(run.meta ?? {})
    ];

    // Handle both better-sqlite3 and sql.js APIs
    // sql.js has bind/step/free, better-sqlite3 has run
    if (typeof stmt.bind === 'function') {
      // sql.js
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      // better-sqlite3
      stmt.run(...params);
    }
  }

  get(id: string): RunRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM runs WHERE id = ?`);

    let row: any = null;
    // Handle both better-sqlite3 and sql.js APIs
    if (typeof stmt.bind === 'function') {
      // sql.js
      stmt.bind([id]);
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
    } else {
      // better-sqlite3
      row = stmt.get(id);
    }

    if (!row) return null;

    return {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      state: row.state,
      meta: row.meta ? JSON.parse(row.meta) : undefined,
    };
  }
}
