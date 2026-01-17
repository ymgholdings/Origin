import { ulid } from "ulid";
import { TasksRepo, TaskRecord } from "../persistence/repo/tasksRepo";

export interface FanoutWorkerOptions {
  db: any;
  runId?: string;
}

/**
 * Finds PENDING parent tasks with fanout input and creates child tasks.
 * Idempotent: running multiple times will not create duplicate children.
 */
export function runFanoutOnce(options: FanoutWorkerOptions): void {
  const { db, runId } = options;
  const tasksRepo = new TasksRepo(db);

  // Get all tasks for the run (or all tasks if no runId specified)
  const tasks = runId ? tasksRepo.listByRun(runId) : getAllTasks(tasksRepo, db);

  // Find PENDING parent tasks that have fanout input
  const parentTasks = tasks.filter(
    (task) =>
      task.state === "PENDING" &&
      task.parent_task_id === null &&
      task.input &&
      typeof task.input.fanout === "number" &&
      task.input.fanout > 0
  );

  for (const parent of parentTasks) {
    const targetChildCount = parent.input.fanout;

    // Check existing children for idempotency
    const existingChildren = tasks.filter(
      (t) => t.parent_task_id === parent.id
    );

    // Calculate how many children we still need to create
    const childrenToCreate = targetChildCount - existingChildren.length;

    if (childrenToCreate <= 0) {
      // Already have enough children
      continue;
    }

    // Create the missing children
    const startIndex = existingChildren.length;
    for (let i = 0; i < childrenToCreate; i++) {
      const childIndex = startIndex + i + 1; // 1-indexed
      const childTask: TaskRecord = {
        id: ulid(),
        run_id: parent.run_id,
        parent_task_id: parent.id,
        name: `${parent.name}#${childIndex}`,
        state: "PENDING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        input: parent.input,
      };

      tasksRepo.insert(childTask);
    }
  }
}

/**
 * Helper to get all tasks (when no runId is specified).
 * This is a simple implementation that might not scale well.
 */
function getAllTasks(tasksRepo: TasksRepo, db: any): TaskRecord[] {
  const stmt = db.prepare(`SELECT * FROM tasks`);

  let rows: any[] = [];
  if (typeof stmt.bind === "function") {
    // sql.js
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
  } else {
    // better-sqlite3
    rows = stmt.all();
  }

  return rows.map((row: any) => ({
    ...row,
    input: row.input ? JSON.parse(row.input) : undefined,
    output: row.output ? JSON.parse(row.output) : undefined,
  }));
}
