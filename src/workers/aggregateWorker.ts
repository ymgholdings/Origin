import { TasksRepo } from "../persistence/repo/tasksRepo";
import { RunsRepo } from "../persistence/repo/runsRepo";

export interface AggregateWorkerOptions {
  db: any;
  runId?: string;
}

/**
 * Aggregates child task states to parent tasks and run states.
 * - When all children of a parent task are SUCCEEDED, the parent becomes SUCCEEDED.
 * - When all tasks for a run are SUCCEEDED, the run becomes SUCCEEDED.
 */
export function runAggregateOnce(options: AggregateWorkerOptions): void {
  const { db, runId } = options;
  const tasksRepo = new TasksRepo(db);
  const runsRepo = new RunsRepo(db);

  // Get all tasks for the run (or all tasks if no runId specified)
  const tasks = runId ? tasksRepo.listByRun(runId) : getAllTasks(tasksRepo, db);

  // Group tasks by parent_task_id
  const tasksByParent = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (task.parent_task_id) {
      const siblings = tasksByParent.get(task.parent_task_id) || [];
      siblings.push(task);
      tasksByParent.set(task.parent_task_id, siblings);
    }
  }

  // Check each parent task to see if all its children are SUCCEEDED
  for (const [parentId, children] of tasksByParent) {
    const allChildrenSucceeded = children.every((child) => child.state === "SUCCEEDED");

    if (allChildrenSucceeded && children.length > 0) {
      // Update the parent task to SUCCEEDED
      const parent = tasks.find((t) => t.id === parentId);
      if (parent && parent.state !== "SUCCEEDED") {
        tasksRepo.updateStatus(parentId, "SUCCEEDED");
      }
    }
  }

  // If we're processing a specific run, check if all tasks are SUCCEEDED
  if (runId) {
    // Refresh tasks after updates
    const updatedTasks = tasksRepo.listByRun(runId);
    const allTasksSucceeded = updatedTasks.every((task) => task.state === "SUCCEEDED");

    if (allTasksSucceeded && updatedTasks.length > 0) {
      const run = runsRepo.get(runId);
      if (run && run.state !== "SUCCEEDED") {
        updateRunStatus(db, runId, "SUCCEEDED");
      }
    }
  }
}

/**
 * Helper to update run status
 */
function updateRunStatus(db: any, runId: string, state: string): void {
  const stmt = db.prepare(`
    UPDATE runs
    SET state = ?, updated_at = ?
    WHERE id = ?
  `);

  const params = [state, new Date().toISOString(), runId];

  if (typeof stmt.bind === "function") {
    // sql.js
    stmt.bind(params);
    stmt.step();
    stmt.free();
  } else {
    // better-sqlite3
    stmt.run(params);
  }
}

/**
 * Helper to get all tasks (when no runId is specified).
 */
function getAllTasks(tasksRepo: TasksRepo, db: any): any[] {
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
