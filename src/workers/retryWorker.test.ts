import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTempDb } from "../test/utils/tempDb";
import { migrate } from "../persistence/migrate";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { TasksRepo } from "../persistence/repo/tasksRepo";
import { runRetryOnce } from "./retryWorker";
import { ulid } from "ulid";

function now() {
  return new Date().toISOString();
}

describe("RetryWorker", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("retries a FAILED task with retries remaining", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const taskId = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    tasks.insert({
      id: taskId,
      run_id: runId,
      parent_task_id: null,
      name: "RETRIABLE_TASK",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
      retry_count: 0,
      max_retries: 3,
      last_error: "Simulated error",
    });

    const retriedCount = runRetryOnce({ db: ctx.db, runId });

    expect(retriedCount).toBe(1);

    const allTasks = tasks.listByRun(runId);
    const task = allTasks.find((t) => t.id === taskId);

    expect(task?.state).toBe("PENDING");
    expect(task?.retry_count).toBe(1);
  });

  it("does not retry a FAILED task that exceeded max retries", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const taskId = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    tasks.insert({
      id: taskId,
      run_id: runId,
      parent_task_id: null,
      name: "EXHAUSTED_TASK",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
      retry_count: 3,
      max_retries: 3,
      last_error: "Exhausted retries",
    });

    const retriedCount = runRetryOnce({ db: ctx.db, runId });

    expect(retriedCount).toBe(0);

    const allTasks = tasks.listByRun(runId);
    const task = allTasks.find((t) => t.id === taskId);

    // Task should remain FAILED
    expect(task?.state).toBe("FAILED");
    expect(task?.retry_count).toBe(3);
  });

  it("retries multiple FAILED tasks", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const task1Id = ulid();
    const task2Id = ulid();
    const task3Id = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    tasks.insert({
      id: task1Id,
      run_id: runId,
      parent_task_id: null,
      name: "TASK1",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
      retry_count: 0,
      max_retries: 3,
    });

    tasks.insert({
      id: task2Id,
      run_id: runId,
      parent_task_id: null,
      name: "TASK2",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
      retry_count: 1,
      max_retries: 3,
    });

    tasks.insert({
      id: task3Id,
      run_id: runId,
      parent_task_id: null,
      name: "TASK3",
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    const retriedCount = runRetryOnce({ db: ctx.db, runId });

    expect(retriedCount).toBe(2);

    const allTasks = tasks.listByRun(runId);
    const task1 = allTasks.find((t) => t.id === task1Id);
    const task2 = allTasks.find((t) => t.id === task2Id);
    const task3 = allTasks.find((t) => t.id === task3Id);

    expect(task1?.state).toBe("PENDING");
    expect(task1?.retry_count).toBe(1);

    expect(task2?.state).toBe("PENDING");
    expect(task2?.retry_count).toBe(2);

    expect(task3?.state).toBe("SUCCEEDED");
  });

  it("respects custom max_retries value", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const taskId = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    // Task with max_retries = 1
    tasks.insert({
      id: taskId,
      run_id: runId,
      parent_task_id: null,
      name: "LIMITED_RETRY_TASK",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
      retry_count: 1,
      max_retries: 1,
    });

    const retriedCount = runRetryOnce({ db: ctx.db, runId });

    expect(retriedCount).toBe(0);

    const allTasks = tasks.listByRun(runId);
    const task = allTasks.find((t) => t.id === taskId);

    // Should not retry since retry_count (1) >= max_retries (1)
    expect(task?.state).toBe("FAILED");
  });

  it("handles tasks with default retry values", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const taskId = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    // Insert without explicit retry fields (will use defaults)
    tasks.insert({
      id: taskId,
      run_id: runId,
      parent_task_id: null,
      name: "DEFAULT_RETRY_TASK",
      state: "FAILED",
      created_at: now(),
      updated_at: now(),
    });

    const retriedCount = runRetryOnce({ db: ctx.db, runId });

    expect(retriedCount).toBe(1);

    const allTasks = tasks.listByRun(runId);
    const task = allTasks.find((t) => t.id === taskId);

    expect(task?.state).toBe("PENDING");
    expect(task?.retry_count).toBe(1);
    expect(task?.max_retries).toBe(3); // Default value
  });
});
