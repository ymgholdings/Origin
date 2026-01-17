import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Monitor } from "./monitor";
import { makeTempDb } from "../test/utils/tempDb";
import { migrate } from "../persistence/migrate";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { TasksRepo } from "../persistence/repo/tasksRepo";
import { EventsRepo } from "../persistence/repo/eventsRepo";
import { ulid } from "ulid";

describe("Monitor", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;
  let monitor: Monitor;
  let runsRepo: RunsRepo;
  let tasksRepo: TasksRepo;
  let eventsRepo: EventsRepo;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
    monitor = new Monitor({ db: ctx.db });
    runsRepo = new RunsRepo(ctx.db as any);
    tasksRepo = new TasksRepo(ctx.db as any);
    eventsRepo = new EventsRepo(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  describe("getHealthReport", () => {
    it("should generate health report for successful run", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "SUCCEEDED",
        meta: {},
      });

      // Create 3 succeeded tasks
      for (let i = 0; i < 3; i++) {
        tasksRepo.insert({
          id: ulid(),
          run_id: runId,
          name: `TASK_${i}`,
          state: "SUCCEEDED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const report = monitor.getHealthReport(runId);

      expect(report.status).toBe("HEALTHY");
      expect(report.summary.totalTasks).toBe(3);
      expect(report.summary.succeededTasks).toBe(3);
      expect(report.metrics.successRate).toBe(1);
      expect(report.warnings).toHaveLength(0);
    });

    it("should detect high failure rate", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "FAILED",
        meta: {},
      });

      // 1 succeeded, 3 failed
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "SUCCESS",
        state: "SUCCEEDED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      for (let i = 0; i < 3; i++) {
        tasksRepo.insert({
          id: ulid(),
          run_id: runId,
          name: `FAIL_${i}`,
          state: "FAILED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const report = monitor.getHealthReport(runId);

      expect(report.status).toBe("CRITICAL");
      expect(report.summary.failedTasks).toBe(3);
      expect(report.metrics.failureRate).toBe(0.75);
      expect(report.warnings.some((w) => w.includes("High failure rate"))).toBe(true);
    });

    it("should detect stuck tasks", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      });

      // Create a task with old timestamp (stuck)
      const oldDate = new Date(Date.now() - 400000).toISOString(); // 400 seconds ago
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "STUCK_TASK",
        state: "RUNNING",
        created_at: oldDate,
        updated_at: oldDate,
      });

      const report = monitor.getHealthReport(runId, 300000); // 5 minute threshold

      expect(report.status).toBe("WARNING");
      expect(report.stuckTasks).toHaveLength(1);
      expect(report.stuckTasks[0].taskName).toBe("STUCK_TASK");
      expect(report.warnings.some((w) => w.includes("stuck"))).toBe(true);
    });

    it("should calculate retry metrics", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "SUCCEEDED",
        meta: {},
      });

      // Task with retries that succeeded
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "RETRY_SUCCESS",
        state: "SUCCEEDED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 2,
        max_retries: 3,
      });

      // Task with exhausted retries
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "RETRY_EXHAUSTED",
        state: "FAILED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 3,
        max_retries: 3,
      });

      const report = monitor.getHealthReport(runId);

      expect(report.metrics.tasksWithRetries).toBe(2);
      expect(report.metrics.avgRetryAttempts).toBe(2.5);
      expect(report.metrics.exhaustedRetries).toBe(1);
      expect(report.status).toBe("CRITICAL"); // Due to exhausted retries
    });
  });

  describe("getRetryMetrics", () => {
    it("should calculate retry statistics", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      });

      const task1 = ulid();
      const task2 = ulid();

      // Task 1: retried twice, succeeded
      tasksRepo.insert({
        id: task1,
        run_id: runId,
        name: "TASK1",
        state: "SUCCEEDED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 2,
      });

      eventsRepo.emit(runId, "task.retried", { taskId: task1 }, task1);
      eventsRepo.emit(runId, "task.retried", { taskId: task1 }, task1);

      // Task 2: retried once, exhausted
      tasksRepo.insert({
        id: task2,
        run_id: runId,
        name: "TASK2",
        state: "FAILED",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 3,
        max_retries: 3,
      });

      eventsRepo.emit(runId, "task.retried", { taskId: task2 }, task2);
      eventsRepo.emit(runId, "task.retries_exhausted", { taskId: task2 }, task2);

      const metrics = monitor.getRetryMetrics(runId);

      expect(metrics.totalRetries).toBe(3);
      expect(metrics.successfulRetries).toBe(1); // task1 succeeded
      expect(metrics.exhaustedTasks).toBe(1);
      expect(metrics.avgRetriesPerTask).toBe(2.5);
    });
  });

  describe("getRunSummary", () => {
    it("should provide comprehensive run summary", () => {
      const runId = ulid();
      const startTime = new Date();
      runsRepo.insert({
        id: runId,
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
        state: "RUNNING",
        meta: {},
      });

      // Create various tasks
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "SUCCESS",
        state: "SUCCEEDED",
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      });

      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "FAILED",
        state: "FAILED",
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      });

      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "PENDING",
        state: "PENDING",
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      });

      // Add worker events
      eventsRepo.emit(runId, "worker.fanout.started");
      eventsRepo.emit(runId, "worker.aggregate.started");
      eventsRepo.emit(runId, "worker.retry.started");

      const summary = monitor.getRunSummary(runId);

      expect(summary.runId).toBe(runId);
      expect(summary.totalTasks).toBe(3);
      expect(summary.taskBreakdown.succeeded).toBe(1);
      expect(summary.taskBreakdown.failed).toBe(1);
      expect(summary.taskBreakdown.pending).toBe(1);
      expect(summary.workerExecutions.fanout).toBe(1);
      expect(summary.workerExecutions.aggregate).toBe(1);
      expect(summary.workerExecutions.retry).toBe(1);
      expect(summary.eventCount).toBe(3);
    });

    it("should calculate run duration for completed runs", () => {
      const runId = ulid();
      const startTime = new Date(Date.now() - 5000); // 5 seconds ago
      const endTime = new Date();

      runsRepo.insert({
        id: runId,
        created_at: startTime.toISOString(),
        updated_at: endTime.toISOString(),
        state: "SUCCEEDED",
        meta: {},
      });

      const summary = monitor.getRunSummary(runId);

      expect(summary.duration).toBeGreaterThan(4000);
      expect(summary.duration).toBeLessThan(6000);
    });
  });

  describe("alertStuckTasks", () => {
    it("should detect and alert on stuck tasks", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      });

      // Recent task (not stuck)
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "RECENT",
        state: "RUNNING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Old task (stuck)
      const oldDate = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "OLD",
        state: "RUNNING",
        created_at: oldDate,
        updated_at: oldDate,
      });

      const stuckTasks = monitor.alertStuckTasks(runId, 300000); // 5 minute threshold

      expect(stuckTasks).toHaveLength(1);
      expect(stuckTasks[0].taskName).toBe("OLD");
      expect(stuckTasks[0].stuckDuration).toBeGreaterThan(300000);
    });

    it("should not alert on terminal state tasks", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "SUCCEEDED",
        meta: {},
      });

      // Old but succeeded task
      const oldDate = new Date(Date.now() - 600000).toISOString();
      tasksRepo.insert({
        id: ulid(),
        run_id: runId,
        name: "OLD_SUCCEEDED",
        state: "SUCCEEDED",
        created_at: oldDate,
        updated_at: oldDate,
      });

      const stuckTasks = monitor.alertStuckTasks(runId, 300000);

      expect(stuckTasks).toHaveLength(0);
    });
  });

  describe("getEvents", () => {
    it("should retrieve all events for a run", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      });

      eventsRepo.emit(runId, "worker.fanout.started");
      eventsRepo.emit(runId, "task.created");
      eventsRepo.emit(runId, "worker.fanout.finished");

      const events = monitor.getEvents(runId);

      expect(events).toHaveLength(3);
    });

    it("should filter events by name", () => {
      const runId = ulid();
      runsRepo.insert({
        id: runId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      });

      eventsRepo.emit(runId, "worker.fanout.started");
      eventsRepo.emit(runId, "task.created");
      eventsRepo.emit(runId, "task.created");
      eventsRepo.emit(runId, "worker.fanout.finished");

      const taskEvents = monitor.getEvents(runId, "task.created");

      expect(taskEvents).toHaveLength(2);
      expect(taskEvents.every((e) => e.name === "task.created")).toBe(true);
    });
  });
});
