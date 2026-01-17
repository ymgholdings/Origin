import { ulid } from "ulid";

export interface EventRecord {
  id: string;
  run_id: string;
  task_id?: string | null;
  name: string;
  at: string;
  payload?: any;
}

export class EventsRepo {
  constructor(private db: any) {}

  /**
   * Insert a new event
   */
  insert(event: EventRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, run_id, task_id, name, at, payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const params = [
      event.id,
      event.run_id,
      event.task_id ?? null,
      event.name,
      event.at,
      event.payload ? JSON.stringify(event.payload) : null,
    ];

    // Dual-API support
    if (typeof stmt.bind === "function") {
      // sql.js
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      // better-sqlite3
      stmt.run(...params);
    }
  }

  /**
   * Emit an event with automatic ULID and timestamp
   */
  emit(runId: string, name: string, payload?: any, taskId?: string) {
    this.insert({
      id: ulid(),
      run_id: runId,
      task_id: taskId ?? null,
      name,
      at: new Date().toISOString(),
      payload,
    });
  }

  /**
   * List all events for a run
   */
  listByRun(runId: string): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, run_id, task_id, name, at, payload
      FROM events
      WHERE run_id = ?
      ORDER BY at ASC
    `);

    const events: EventRecord[] = [];

    if (typeof stmt.bind === "function") {
      // sql.js
      stmt.bind([runId]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        events.push({
          id: row.id as string,
          run_id: row.run_id as string,
          task_id: row.task_id as string | null,
          name: row.name as string,
          at: row.at as string,
          payload: row.payload ? JSON.parse(row.payload as string) : undefined,
        });
      }
      stmt.free();
    } else {
      // better-sqlite3
      const rows = stmt.all(runId) as any[];
      for (const row of rows) {
        events.push({
          id: row.id,
          run_id: row.run_id,
          task_id: row.task_id,
          name: row.name,
          at: row.at,
          payload: row.payload ? JSON.parse(row.payload) : undefined,
        });
      }
    }

    return events;
  }

  /**
   * List all events for a specific task
   */
  listByTask(taskId: string): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, run_id, task_id, name, at, payload
      FROM events
      WHERE task_id = ?
      ORDER BY at ASC
    `);

    const events: EventRecord[] = [];

    if (typeof stmt.bind === "function") {
      // sql.js
      stmt.bind([taskId]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        events.push({
          id: row.id as string,
          run_id: row.run_id as string,
          task_id: row.task_id as string | null,
          name: row.name as string,
          at: row.at as string,
          payload: row.payload ? JSON.parse(row.payload as string) : undefined,
        });
      }
      stmt.free();
    } else {
      // better-sqlite3
      const rows = stmt.all(taskId) as any[];
      for (const row of rows) {
        events.push({
          id: row.id,
          run_id: row.run_id,
          task_id: row.task_id,
          name: row.name,
          at: row.at,
          payload: row.payload ? JSON.parse(row.payload) : undefined,
        });
      }
    }

    return events;
  }

  /**
   * Get events by name (e.g., all "task.state_changed" events)
   */
  listByName(runId: string, name: string): EventRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, run_id, task_id, name, at, payload
      FROM events
      WHERE run_id = ? AND name = ?
      ORDER BY at ASC
    `);

    const events: EventRecord[] = [];

    if (typeof stmt.bind === "function") {
      // sql.js
      stmt.bind([runId, name]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        events.push({
          id: row.id as string,
          run_id: row.run_id as string,
          task_id: row.task_id as string | null,
          name: row.name as string,
          at: row.at as string,
          payload: row.payload ? JSON.parse(row.payload as string) : undefined,
        });
      }
      stmt.free();
    } else {
      // better-sqlite3
      const rows = stmt.all(runId, name) as any[];
      for (const row of rows) {
        events.push({
          id: row.id,
          run_id: row.run_id,
          task_id: row.task_id,
          name: row.name,
          at: row.at,
          payload: row.payload ? JSON.parse(row.payload) : undefined,
        });
      }
    }

    return events;
  }
}
