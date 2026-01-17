import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ulid } from "ulid";
import { makeTempDb } from "../../test/utils/tempDb";
import { migrate } from "../migrate";
import { TasksRepo } from "./tasksRepo";

describe("TasksRepo", () => {
  let ctx: any;
  const now = () => new Date().toISOString();

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db);
  });

  afterEach(() => {
    ctx?.cleanup();
  });

  it("inserts and retrieves a task", () => {
    const repo = new TasksRepo(ctx.db);
    const runId = ulid();
    const taskId = ulid();

    repo.insert({
      id: taskId,
      run_id: runId,
      name: "test-task",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
    });

    const tasks = repo.listByRun(runId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(taskId);
    expect(tasks[0].run_id).toBe(runId);
  });

  it("updates task state and output", () => {
    const repo = new TasksRepo(ctx.db);
    const runId = ulid();
    const taskId = ulid();

    repo.insert({
      id: taskId,
      run_id: runId,
      name: "update-test",
      state: "PENDING",
      created_at: now(),
      updated_at: now(),
    });

    repo.updateStatus(taskId, "SUCCEEDED", { ok: true });

    const tasks = repo.listByRun(runId);
    expect(tasks[0].state).toBe("SUCCEEDED");
  });
});
