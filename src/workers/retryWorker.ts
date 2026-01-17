import { TasksRepo, TaskRecord } from "../persistence/repo/tasksRepo";

export interface RetryWorkerOptions {
  db: any;
  runId?: string;
}

/**
 * Finds FAILED tasks that can be retried and resets them to PENDING.
 * Only retries tasks where retry_count < max_retries.
 */
export function runRetryOnce(options: RetryWorkerOptions): number {
  const { db, runId } = options;
  const tasksRepo = new TasksRepo(db);

  // Get all tasks for the run (or all tasks if no runId specified)
  const tasks = runId ? tasksRepo.listByRun(runId) : getAllTasks(tasksRepo, db);

  // Find FAILED tasks that can be retried
  const retriableTasks = tasks.filter((task) => {
    const retryCount = task.retry_count ?? 0;
    const maxRetries = task.max_retries ?? 3;
    return task.state === "FAILED" && retryCount < maxRetries;
  });

  let retriedCount = 0;

  for (const task of retriableTasks) {
    // Increment retry count
    tasksRepo.incrementRetryCount(task.id);

    // Reset task to PENDING for retry
    tasksRepo.updateStatus(task.id, "PENDING", null);

    retriedCount++;
  }

  return retriedCount;
}

/**
 * Helper to get all tasks (when no runId is specified).
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
