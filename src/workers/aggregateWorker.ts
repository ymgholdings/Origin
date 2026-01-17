import { TasksRepo } from "../persistence/repo/tasksRepo";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { EventsRepo } from "../persistence/repo/eventsRepo";

export interface AggregateWorkerOptions {
  db: any;
  runId?: string;
}

/**
 * Aggregates child task states to parent tasks and run states.
 * - When all children are in terminal states (SUCCEEDED/FAILED/CANCELLED):
 *   - If any child is FAILED, the parent becomes FAILED
 *   - If all children are SUCCEEDED, the parent becomes SUCCEEDED
 * - When all tasks for a run are in terminal states:
 *   - If any task is FAILED, the run becomes FAILED
 *   - If all tasks are SUCCEEDED, the run becomes SUCCEEDED
 */
export function runAggregateOnce(options: AggregateWorkerOptions): void {
  const { db, runId } = options;
  const tasksRepo = new TasksRepo(db);
  const runsRepo = new RunsRepo(db);
  const eventsRepo = new EventsRepo(db);

  // Emit worker start event
  if (runId) {
    eventsRepo.emit(runId, "worker.aggregate.started");
  }

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

  // Check each parent task to see if all its children are in terminal states
  let parentsAggregated = 0;

  for (const [parentId, children] of tasksByParent) {
    const parent = tasks.find((t) => t.id === parentId);
    if (!parent || isTerminalState(parent.state)) {
      // Skip if parent already in terminal state
      continue;
    }

    const allChildrenTerminal = children.every((child) => isTerminalState(child.state));

    if (allChildrenTerminal && children.length > 0) {
      const anyChildFailed = children.some((child) => child.state === "FAILED");
      const allChildrenSucceeded = children.every((child) => child.state === "SUCCEEDED");

      if (anyChildFailed) {
        // If any child failed, parent fails
        tasksRepo.updateStatus(parentId, "FAILED", {
          reason: "One or more child tasks failed",
        });

        // Emit aggregation event
        eventsRepo.emit(
          parent.run_id,
          "task.aggregated",
          {
            taskId: parentId,
            taskName: parent.name,
            newState: "FAILED",
            reason: "One or more child tasks failed",
            childrenCount: children.length,
            failedCount: children.filter((c) => c.state === "FAILED").length,
          },
          parentId
        );

        parentsAggregated++;
      } else if (allChildrenSucceeded) {
        // If all children succeeded, parent succeeds
        tasksRepo.updateStatus(parentId, "SUCCEEDED");

        // Emit aggregation event
        eventsRepo.emit(
          parent.run_id,
          "task.aggregated",
          {
            taskId: parentId,
            taskName: parent.name,
            newState: "SUCCEEDED",
            childrenCount: children.length,
          },
          parentId
        );

        parentsAggregated++;
      }
    }
  }

  // If we're processing a specific run, check if all tasks are in terminal states
  let runAggregated = false;

  if (runId) {
    // Refresh tasks after updates
    const updatedTasks = tasksRepo.listByRun(runId);
    const allTasksTerminal = updatedTasks.every((task) => isTerminalState(task.state));

    if (allTasksTerminal && updatedTasks.length > 0) {
      const run = runsRepo.get(runId);
      if (run && !isTerminalState(run.state)) {
        const anyTaskFailed = updatedTasks.some((task) => task.state === "FAILED");
        const allTasksSucceeded = updatedTasks.every((task) => task.state === "SUCCEEDED");

        if (anyTaskFailed) {
          // If any task failed, run fails
          updateRunStatus(db, runId, "FAILED");

          // Emit run aggregation event
          eventsRepo.emit(runId, "run.aggregated", {
            runId,
            newState: "FAILED",
            tasksCount: updatedTasks.length,
            failedCount: updatedTasks.filter((t) => t.state === "FAILED").length,
          });

          runAggregated = true;
        } else if (allTasksSucceeded) {
          // If all tasks succeeded, run succeeds
          updateRunStatus(db, runId, "SUCCEEDED");

          // Emit run aggregation event
          eventsRepo.emit(runId, "run.aggregated", {
            runId,
            newState: "SUCCEEDED",
            tasksCount: updatedTasks.length,
          });

          runAggregated = true;
        }
      }
    }

    // Emit worker finished event
    eventsRepo.emit(runId, "worker.aggregate.finished", {
      parentsAggregated,
      runAggregated,
    });
  }
}

/**
 * Check if a state is terminal (cannot transition further)
 */
function isTerminalState(state: string): boolean {
  return state === "SUCCEEDED" || state === "FAILED" || state === "CANCELLED";
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
