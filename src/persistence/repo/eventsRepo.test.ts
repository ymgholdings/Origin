import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventsRepo } from "./eventsRepo";
import { makeTempDb } from "../../test/utils/tempDb";
import { migrate } from "../migrate";
import { ulid } from "ulid";

describe("EventsRepo", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;
  let eventsRepo: EventsRepo;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
    eventsRepo = new EventsRepo(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("should insert and retrieve events", () => {
    const runId = ulid();
    const taskId = ulid();

    eventsRepo.insert({
      id: ulid(),
      run_id: runId,
      task_id: taskId,
      name: "task.state_changed",
      at: new Date().toISOString(),
      payload: { from: "PENDING", to: "RUNNING" },
    });

    const events = eventsRepo.listByRun(runId);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("task.state_changed");
    expect(events[0].payload).toEqual({ from: "PENDING", to: "RUNNING" });
  });

  it("should emit events with automatic ID and timestamp", () => {
    const runId = ulid();
    const taskId = ulid();

    eventsRepo.emit(runId, "task.created", { taskName: "TEST" }, taskId);

    const events = eventsRepo.listByRun(runId);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("task.created");
    expect(events[0].task_id).toBe(taskId);
    expect(events[0].payload).toEqual({ taskName: "TEST" });
  });

  it("should list events by task", () => {
    const runId = ulid();
    const task1 = ulid();
    const task2 = ulid();

    eventsRepo.emit(runId, "task.created", {}, task1);
    eventsRepo.emit(runId, "task.created", {}, task2);
    eventsRepo.emit(runId, "task.state_changed", { to: "RUNNING" }, task1);

    const task1Events = eventsRepo.listByTask(task1);
    expect(task1Events).toHaveLength(2);
    expect(task1Events.every((e) => e.task_id === task1)).toBe(true);
  });

  it("should list events by name", () => {
    const runId = ulid();

    eventsRepo.emit(runId, "task.created", {});
    eventsRepo.emit(runId, "task.state_changed", {});
    eventsRepo.emit(runId, "task.created", {});

    const createdEvents = eventsRepo.listByName(runId, "task.created");
    expect(createdEvents).toHaveLength(2);
    expect(createdEvents.every((e) => e.name === "task.created")).toBe(true);
  });

  it("should handle events without payloads", () => {
    const runId = ulid();

    eventsRepo.emit(runId, "worker.started");

    const events = eventsRepo.listByRun(runId);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toBeUndefined();
  });

  it("should maintain event order by timestamp", () => {
    const runId = ulid();

    // Wait a bit between events to ensure different timestamps
    eventsRepo.emit(runId, "event.first");
    eventsRepo.emit(runId, "event.second");
    eventsRepo.emit(runId, "event.third");

    const events = eventsRepo.listByRun(runId);
    expect(events).toHaveLength(3);
    expect(events[0].name).toBe("event.first");
    expect(events[1].name).toBe("event.second");
    expect(events[2].name).toBe("event.third");
  });
});
