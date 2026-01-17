import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTempDb } from "../test/utils/tempDb";
import { migrate } from "../persistence/migrate";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { TasksRepo } from "../persistence/repo/tasksRepo";
import { runAggregateOnce } from "./aggregateWorker";
import { ulid } from "ulid";

function now() {
  return new Date().toISOString();
}

describe("AggregateWorker", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("marks parent as SUCCEEDED when all children are SUCCEEDED", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const parentTaskId = ulid();
    const child1Id = ulid();
    const child2Id = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    tasks.insert({
      id: parentTaskId,
      run_id: runId,
      parent_task_id: null,
      name: "PARENT",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
    });

    tasks.insert({
      id: child1Id,
      run_id: runId,
      parent_task_id: parentTaskId,
      name: "CHILD1",
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    tasks.insert({
      id: child2Id,
      run_id: runId,
      parent_task_id: parentTaskId,
      name: "CHILD2",
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    runAggregateOnce({ db: ctx.db, runId });

    const allTasks = tasks.listByRun(runId);
    const parent = allTasks.find((t) => t.id === parentTaskId);

    expect(parent?.state).toBe("SUCCEEDED");
  });

  it("marks run as SUCCEEDED when all tasks are SUCCEEDED", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const task1Id = ulid();
    const task2Id = ulid();

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
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    tasks.insert({
      id: task2Id,
      run_id: runId,
      parent_task_id: null,
      name: "TASK2",
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    runAggregateOnce({ db: ctx.db, runId });

    const run = runs.get(runId);
    expect(run?.state).toBe("SUCCEEDED");
  });

  it("does not mark parent as SUCCEEDED if any child is still PENDING", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const parentTaskId = ulid();
    const child1Id = ulid();
    const child2Id = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: {},
    });

    tasks.insert({
      id: parentTaskId,
      run_id: runId,
      parent_task_id: null,
      name: "PARENT",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
    });

    tasks.insert({
      id: child1Id,
      run_id: runId,
      parent_task_id: parentTaskId,
      name: "CHILD1",
      state: "SUCCEEDED",
      created_at: now(),
      updated_at: now(),
    });

    tasks.insert({
      id: child2Id,
      run_id: runId,
      parent_task_id: parentTaskId,
      name: "CHILD2",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
    });

    runAggregateOnce({ db: ctx.db, runId });

    const allTasks = tasks.listByRun(runId);
    const parent = allTasks.find((t) => t.id === parentTaskId);

    expect(parent?.state).toBe("PENDING");
  });
});
