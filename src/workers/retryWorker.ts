import { TasksRepo, TaskRecord } from "../persistence/repo/tasksRepo";
import { EventsRepo } from "../persistence/repo/eventsRepo";

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
  const eventsRepo = new EventsRepo(db);

  // Emit worker start event
  if (runId) {
    eventsRepo.emit(runId, "worker.retry.started");
  }

  // Get all tasks for the run (or all tasks if no runId specified)
  const tasks = runId ? tasksRepo.listByRun(runId) : getAllTasks(tasksRepo, db);

  // Find FAILED tasks that can be retried
  const retriableTasks = tasks.filter((task) => {
    const retryCount = task.retry_count ?? 0;
    const maxRetries = task.max_retries ?? 3;
    return task.state === "FAILED" && retryCount < maxRetries;
  });

  // Find FAILED tasks that have exhausted retries
  const exhaustedTasks = tasks.filter((task) => {
    const retryCount = task.retry_count ?? 0;
    const maxRetries = task.max_retries ?? 3;
    return task.state === "FAILED" && retryCount >= maxRetries;
  });

  // Emit events for exhausted tasks
  for (const task of exhaustedTasks) {
    eventsRepo.emit(
      task.run_id,
      "task.retries_exhausted",
      {
        taskId: task.id,
        taskName: task.name,
        retryCount: task.retry_count,
        maxRetries: task.max_retries,
        lastError: task.last_error,
      },
      task.id
    );
  }

  let retriedCount = 0;

  for (const task of retriableTasks) {
    const oldRetryCount = task.retry_count ?? 0;

    // Increment retry count
    tasksRepo.incrementRetryCount(task.id);

    // Reset task to PENDING for retry
    tasksRepo.updateStatus(task.id, "PENDING", null);

    // Emit retry event
    eventsRepo.emit(
      task.run_id,
      "task.retried",
      {
        taskId: task.id,
        taskName: task.name,
        retryCount: oldRetryCount + 1,
        maxRetries: task.max_retries ?? 3,
        lastError: task.last_error,
      },
      task.id
    );

    retriedCount++;
  }

  // Emit worker finished event
  if (runId) {
    eventsRepo.emit(runId, "worker.retry.finished", {
      retriedCount,
      exhaustedCount: exhaustedTasks.length,
    });
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
