export interface TaskRecord {
  id: string;
  run_id: string;
  parent_task_id?: string | null;
  name: string;
  state: string;
  created_at: string;
  updated_at: string;
  input?: any;
  output?: any;
}

export class TasksRepo {
  constructor(private db: any) {}

  insert(task: TaskRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, run_id, parent_task_id, name, state, created_at, updated_at, input, output
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const params = [
      task.id,
      task.run_id,
      task.parent_task_id ?? null,
      task.name,
      task.state,
      task.created_at,
      task.updated_at,
      task.input ? JSON.stringify(task.input) : null,
      task.output ? JSON.stringify(task.output ?? {}) : null
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
      stmt.run(params);
    }
  }

  updateStatus(id: string, state: string, output?: any) {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET state = ?, updated_at = ?, output = ?
      WHERE id = ?
    `);

    const params = [
      state,
      new Date().toISOString(),
      output ? JSON.stringify(output) : null,
      id
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
      stmt.run(params);
    }
  }

  listByRun(runId: string): TaskRecord[] {
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE run_id = ?`);

    let rows: any[] = [];
    if (typeof stmt.bind === 'function') {
      // sql.js
      stmt.bind([runId]);
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
    } else {
      // better-sqlite3
      rows = stmt.all(runId);
    }

    return rows.map((row: any) => ({
      ...row,
      input: row.input ? JSON.parse(row.input) : undefined,
      output: row.output ? JSON.parse(row.output) : undefined,
    }));
  }
}
