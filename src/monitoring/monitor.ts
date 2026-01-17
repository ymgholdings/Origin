import { TasksRepo, TaskRecord } from "../persistence/repo/tasksRepo";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { EventsRepo, EventRecord } from "../persistence/repo/eventsRepo";

export interface MonitorOptions {
  db: any;
}

export interface HealthReport {
  runId: string;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  summary: {
    totalTasks: number;
    pendingTasks: number;
    runningTasks: number;
    succeededTasks: number;
    failedTasks: number;
    cancelledTasks: number;
  };
  metrics: {
    successRate: number;
    failureRate: number;
    avgRetryAttempts: number;
    tasksWithRetries: number;
    exhaustedRetries: number;
  };
  stuckTasks: StuckTask[];
  warnings: string[];
  timestamp: string;
}

export interface StuckTask {
  taskId: string;
  taskName: string;
  state: string;
  stuckDuration: number; // milliseconds
  lastUpdate: string;
}

export interface RetryMetrics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  exhaustedTasks: number;
  avgRetriesPerTask: number;
  retrySuccessRate: number;
}

export interface RunSummary {
  runId: string;
  state: string;
  duration: number | null; // milliseconds
  totalTasks: number;
  taskBreakdown: {
    succeeded: number;
    failed: number;
    pending: number;
    running: number;
    cancelled: number;
  };
  eventCount: number;
  workerExecutions: {
    fanout: number;
    aggregate: number;
    retry: number;
  };
}

export class Monitor {
  private tasksRepo: TasksRepo;
  private runsRepo: RunsRepo;
  private eventsRepo: EventsRepo;

  constructor(private options: MonitorOptions) {
    this.tasksRepo = new TasksRepo(options.db);
    this.runsRepo = new RunsRepo(options.db);
    this.eventsRepo = new EventsRepo(options.db);
  }

  /**
   * Generate a comprehensive health report for a run
   */
  getHealthReport(runId: string, stuckThresholdMs: number = 300000): HealthReport {
    const run = this.runsRepo.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const tasks = this.tasksRepo.listByRun(runId);
    const now = Date.now();

    // Count tasks by state
    const summary = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.state === "PENDING").length,
      runningTasks: tasks.filter((t) => t.state === "RUNNING").length,
      succeededTasks: tasks.filter((t) => t.state === "SUCCEEDED").length,
      failedTasks: tasks.filter((t) => t.state === "FAILED").length,
      cancelledTasks: tasks.filter((t) => t.state === "CANCELLED").length,
    };

    // Calculate metrics
    const completedTasks = summary.succeededTasks + summary.failedTasks + summary.cancelledTasks;
    const successRate = completedTasks > 0 ? summary.succeededTasks / completedTasks : 0;
    const failureRate = completedTasks > 0 ? summary.failedTasks / completedTasks : 0;

    const tasksWithRetries = tasks.filter((t) => (t.retry_count ?? 0) > 0);
    const totalRetryAttempts = tasksWithRetries.reduce((sum, t) => sum + (t.retry_count ?? 0), 0);
    const avgRetryAttempts = tasksWithRetries.length > 0 ? totalRetryAttempts / tasksWithRetries.length : 0;

    const exhaustedRetries = tasks.filter((t) => {
      const retryCount = t.retry_count ?? 0;
      const maxRetries = t.max_retries ?? 3;
      return t.state === "FAILED" && retryCount >= maxRetries;
    }).length;

    const metrics = {
      successRate,
      failureRate,
      avgRetryAttempts,
      tasksWithRetries: tasksWithRetries.length,
      exhaustedRetries,
    };

    // Detect stuck tasks
    const stuckTasks = this.detectStuckTasks(tasks, stuckThresholdMs);

    // Generate warnings
    const warnings: string[] = [];
    if (summary.failedTasks > summary.succeededTasks && completedTasks > 0) {
      warnings.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
    if (stuckTasks.length > 0) {
      warnings.push(`${stuckTasks.length} task(s) may be stuck`);
    }
    if (exhaustedRetries > 0) {
      warnings.push(`${exhaustedRetries} task(s) exhausted retries`);
    }

    // Determine overall status
    let status: "HEALTHY" | "WARNING" | "CRITICAL";
    if (summary.failedTasks > 0 || exhaustedRetries > 0) {
      status = "CRITICAL";
    } else if (stuckTasks.length > 0 || warnings.length > 0) {
      status = "WARNING";
    } else {
      status = "HEALTHY";
    }

    return {
      runId,
      status,
      summary,
      metrics,
      stuckTasks,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect tasks that haven't been updated in a while
   */
  private detectStuckTasks(tasks: TaskRecord[], thresholdMs: number): StuckTask[] {
    const now = Date.now();
    const stuckTasks: StuckTask[] = [];

    for (const task of tasks) {
      // Only check non-terminal states
      if (task.state === "SUCCEEDED" || task.state === "FAILED" || task.state === "CANCELLED") {
        continue;
      }

      const lastUpdate = new Date(task.updated_at).getTime();
      const stuckDuration = now - lastUpdate;

      if (stuckDuration > thresholdMs) {
        stuckTasks.push({
          taskId: task.id,
          taskName: task.name,
          state: task.state,
          stuckDuration,
          lastUpdate: task.updated_at,
        });
      }
    }

    return stuckTasks;
  }

  /**
   * Get detailed retry metrics for a run
   */
  getRetryMetrics(runId: string): RetryMetrics {
    const events = this.eventsRepo.listByRun(runId);
    const tasks = this.tasksRepo.listByRun(runId);

    const retriedEvents = events.filter((e) => e.name === "task.retried");
    const exhaustedEvents = events.filter((e) => e.name === "task.retries_exhausted");

    const totalRetries = retriedEvents.length;

    // A successful retry is when a task that was retried eventually succeeded
    const retriedTaskIds = new Set(retriedEvents.map((e) => e.task_id).filter(Boolean) as string[]);
    const successfulRetries = tasks.filter(
      (t) => retriedTaskIds.has(t.id) && t.state === "SUCCEEDED"
    ).length;

    const failedRetries = exhaustedEvents.length;
    const exhaustedTasks = tasks.filter((t) => {
      const retryCount = t.retry_count ?? 0;
      const maxRetries = t.max_retries ?? 3;
      return t.state === "FAILED" && retryCount >= maxRetries;
    }).length;

    const tasksWithRetries = tasks.filter((t) => (t.retry_count ?? 0) > 0);
    const totalRetryAttempts = tasksWithRetries.reduce((sum, t) => sum + (t.retry_count ?? 0), 0);
    const avgRetriesPerTask = tasksWithRetries.length > 0 ? totalRetryAttempts / tasksWithRetries.length : 0;

    const retrySuccessRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;

    return {
      totalRetries,
      successfulRetries,
      failedRetries,
      exhaustedTasks,
      avgRetriesPerTask,
      retrySuccessRate,
    };
  }

  /**
   * Get a summary of a run
   */
  getRunSummary(runId: string): RunSummary {
    const run = this.runsRepo.get(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const tasks = this.tasksRepo.listByRun(runId);
    const events = this.eventsRepo.listByRun(runId);

    // Calculate duration
    let duration: number | null = null;
    if (run.state === "SUCCEEDED" || run.state === "FAILED" || run.state === "CANCELLED") {
      const createdAt = new Date(run.created_at).getTime();
      const updatedAt = new Date(run.updated_at).getTime();
      duration = updatedAt - createdAt;
    }

    // Task breakdown
    const taskBreakdown = {
      succeeded: tasks.filter((t) => t.state === "SUCCEEDED").length,
      failed: tasks.filter((t) => t.state === "FAILED").length,
      pending: tasks.filter((t) => t.state === "PENDING").length,
      running: tasks.filter((t) => t.state === "RUNNING").length,
      cancelled: tasks.filter((t) => t.state === "CANCELLED").length,
    };

    // Worker executions
    const workerExecutions = {
      fanout: events.filter((e) => e.name === "worker.fanout.started").length,
      aggregate: events.filter((e) => e.name === "worker.aggregate.started").length,
      retry: events.filter((e) => e.name === "worker.retry.started").length,
    };

    return {
      runId,
      state: run.state,
      duration,
      totalTasks: tasks.length,
      taskBreakdown,
      eventCount: events.length,
      workerExecutions,
    };
  }

  /**
   * Get all events for a run, optionally filtered by name
   */
  getEvents(runId: string, eventName?: string): EventRecord[] {
    if (eventName) {
      return this.eventsRepo.listByName(runId, eventName);
    }
    return this.eventsRepo.listByRun(runId);
  }

  /**
   * Alert if there are stuck tasks
   */
  alertStuckTasks(runId: string, thresholdMs: number = 300000): StuckTask[] {
    const tasks = this.tasksRepo.listByRun(runId);
    return this.detectStuckTasks(tasks, thresholdMs);
  }
}
