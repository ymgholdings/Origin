import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTempDb } from "../test/utils/tempDb";
import { migrate } from "../persistence/migrate";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { TasksRepo } from "../persistence/repo/tasksRepo";
import { runFanoutOnce } from "./fanoutWorker";
import { ulid } from "ulid";

function now() {
  return new Date().toISOString();
}

describe("FanoutWorker", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("creates exactly N child tasks once for a fanout parent", () => {
    if (!ctx) throw new Error("no db");

    const runs = new RunsRepo(ctx.db as any);
    const tasks = new TasksRepo(ctx.db as any);

    const runId = ulid();
    const parentTaskId = ulid();

    runs.insert({
      id: runId,
      created_at: now(),
      updated_at: now(),
      state: "RUNNING",
      meta: { test: true },
    });

    tasks.insert({
      id: parentTaskId,
      run_id: runId,
      parent_task_id: null,
      name: "FANOUT_TEST",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
      input: { fanout: 3 },
    });

    // Run the fanout worker twice to test idempotency
    runFanoutOnce({ db: ctx.db, runId });
    runFanoutOnce({ db: ctx.db, runId });

    const allTasks = tasks.listByRun(runId);
    const children = allTasks.filter(t => t.parent_task_id === parentTaskId);

    expect(children.length).toBe(3);
  });
});
