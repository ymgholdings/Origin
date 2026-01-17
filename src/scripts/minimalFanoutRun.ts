#!/usr/bin/env ts-node

/**
 * Minimal end-to-end script demonstrating fan-out and aggregate workers.
 *
 * Flow:
 * 1. Create a new run
 * 2. Create one fanout parent task with input: { fanout: 3 }
 * 3. Call fanout worker to create 3 child tasks
 * 4. Simulate completing all children
 * 5. Call aggregate worker to mark parent and run as SUCCEEDED
 * 6. Print final run state
 */

import initSqlJs from "sql.js";
import { migrate } from "../persistence/migrate";
import { RunsRepo } from "../persistence/repo/runsRepo";
import { TasksRepo } from "../persistence/repo/tasksRepo";
import { runFanoutOnce } from "../workers/fanoutWorker";
import { runAggregateOnce } from "../workers/aggregateWorker";
import { ulid } from "ulid";
import { runRetryOnce } from "../workers/retryWorker";
import { Monitor } from "../monitoring/monitor";

async function runSuccessScenario() {
  console.log("=== Scenario 1: All Tasks Succeed ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "success-scenario" },
  });

  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "SUCCESS_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 3 },
  });

  runFanoutOnce({ db, runId });
  const children = tasksRepo.listByRun(runId).filter((t) => t.parent_task_id === parentTaskId);

  console.log("1. Fan-out created 3 children");
  for (const child of children) {
    tasksRepo.updateStatus(child.id, "SUCCEEDED");
  }
  console.log("2. All children succeeded");

  runAggregateOnce({ db, runId });
  const finalRun = runsRepo.get(runId);
  const parent = tasksRepo.listByRun(runId).find((t) => t.id === parentTaskId);

  console.log(`3. Parent state: ${parent?.state}`);
  console.log(`4. Run state: ${finalRun?.state}`);
  console.log(`   ✓ Success scenario complete\n`);

  db.close();
}

async function runFailureScenario() {
  console.log("=== Scenario 2: One Task Fails ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "failure-scenario" },
  });

  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "FAILURE_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 3 },
  });

  runFanoutOnce({ db, runId });
  const children = tasksRepo.listByRun(runId).filter((t) => t.parent_task_id === parentTaskId);

  console.log("1. Fan-out created 3 children");

  // First two succeed, third fails
  tasksRepo.updateStatus(children[0].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[1].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[2].id, "FAILED", { error: "Simulated failure" });

  console.log(`2. Child states: ${children[0].name}=SUCCEEDED, ${children[1].name}=SUCCEEDED, ${children[2].name}=FAILED`);

  runAggregateOnce({ db, runId });
  const finalRun = runsRepo.get(runId);
  const parent = tasksRepo.listByRun(runId).find((t) => t.id === parentTaskId);

  console.log(`3. Parent state: ${parent?.state} (propagated from failed child)`);
  console.log(`4. Run state: ${finalRun?.state} (propagated from failed parent)`);
  console.log(`   ✓ Failure scenario complete\n`);

  db.close();
}

async function runPartialCompletionScenario() {
  console.log("=== Scenario 3: Partial Completion (No Aggregation) ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "partial-completion" },
  });

  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "PARTIAL_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 3 },
  });

  runFanoutOnce({ db, runId });
  const children = tasksRepo.listByRun(runId).filter((t) => t.parent_task_id === parentTaskId);

  console.log("1. Fan-out created 3 children");

  // Only two complete, one still running
  tasksRepo.updateStatus(children[0].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[1].id, "SUCCEEDED");
  // children[2] stays PENDING

  console.log(`2. Child states: ${children[0].name}=SUCCEEDED, ${children[1].name}=SUCCEEDED, ${children[2].name}=PENDING`);

  runAggregateOnce({ db, runId });
  const finalRun = runsRepo.get(runId);
  const parent = tasksRepo.listByRun(runId).find((t) => t.id === parentTaskId);

  console.log(`3. Parent state: ${parent?.state} (no change, waiting for all children)`);
  console.log(`4. Run state: ${finalRun?.state} (no change, waiting for completion)`);
  console.log(`   ✓ Partial completion scenario complete\n`);

  db.close();
}

async function runRetryScenario() {
  console.log("=== Scenario 4: Automatic Retry on Failure ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "retry-scenario" },
  });

  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "RETRY_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 3 },
  });

  runFanoutOnce({ db, runId });
  const children = tasksRepo.listByRun(runId).filter((t) => t.parent_task_id === parentTaskId);

  console.log("1. Fan-out created 3 children");

  // First attempt: one child fails
  tasksRepo.updateStatus(children[0].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[1].id, "FAILED", { error: "Network timeout" }, "Network timeout");
  tasksRepo.updateStatus(children[2].id, "SUCCEEDED");

  let allTasks = tasksRepo.listByRun(runId);
  const failedChild = allTasks.find((t) => t.id === children[1].id);
  console.log(`2. First attempt: ${failedChild?.name}=FAILED (retry_count=${failedChild?.retry_count}/${failedChild?.max_retries})`);

  // Run retry worker
  const retriedCount = runRetryOnce({ db, runId });
  console.log(`3. Retry worker: ${retriedCount} task(s) retried`);

  allTasks = tasksRepo.listByRun(runId);
  const retriedChild = allTasks.find((t) => t.id === children[1].id);
  console.log(`4. After retry: ${retriedChild?.name}=PENDING (retry_count=${retriedChild?.retry_count}/${retriedChild?.max_retries})`);

  // Second attempt: task succeeds
  tasksRepo.updateStatus(children[1].id, "SUCCEEDED");
  console.log(`5. Second attempt: ${retriedChild?.name}=SUCCEEDED`);

  runAggregateOnce({ db, runId });
  const finalRun = runsRepo.get(runId);
  const parent = tasksRepo.listByRun(runId).find((t) => t.id === parentTaskId);

  console.log(`6. Parent state: ${parent?.state}`);
  console.log(`7. Run state: ${finalRun?.state}`);
  console.log(`   ✓ Retry scenario complete\n`);

  db.close();
}

async function runExhaustedRetryScenario() {
  console.log("=== Scenario 5: Exhausted Retries ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "exhausted-retry" },
  });

  const taskId = ulid();
  tasksRepo.insert({
    id: taskId,
    run_id: runId,
    parent_task_id: null,
    name: "PERSISTENT_FAILURE",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retry_count: 0,
    max_retries: 2,
  });

  console.log("1. Created task with max_retries=2");

  // Attempt 1
  tasksRepo.updateStatus(taskId, "FAILED", null, "Error 1");
  console.log(`2. Attempt 1 failed (retry_count=0)`);

  // Retry 1
  runRetryOnce({ db, runId });
  let task = tasksRepo.listByRun(runId).find((t) => t.id === taskId);
  console.log(`3. Retry worker triggered (retry_count=${task?.retry_count}, state=${task?.state})`);

  // Attempt 2
  tasksRepo.updateStatus(taskId, "FAILED", null, "Error 2");
  console.log(`4. Attempt 2 failed (retry_count=1)`);

  // Retry 2
  runRetryOnce({ db, runId });
  task = tasksRepo.listByRun(runId).find((t) => t.id === taskId);
  console.log(`5. Retry worker triggered (retry_count=${task?.retry_count}, state=${task?.state})`);

  // Attempt 3 (final)
  tasksRepo.updateStatus(taskId, "FAILED", null, "Error 3");
  console.log(`6. Attempt 3 failed (retry_count=2)`);

  // Attempt to retry again (should not retry)
  const retriedCount = runRetryOnce({ db, runId });
  task = tasksRepo.listByRun(runId).find((t) => t.id === taskId);
  console.log(`7. Retry worker: ${retriedCount} task(s) retried (max retries exhausted)`);
  console.log(`8. Final state: ${task?.state} (retry_count=${task?.retry_count}/${task?.max_retries})`);

  runAggregateOnce({ db, runId });
  const finalRun = runsRepo.get(runId);
  console.log(`9. Run state: ${finalRun?.state} (propagated permanent failure)`);
  console.log(`   ✓ Exhausted retry scenario complete\n`);

  db.close();
}

async function runMonitoringScenario() {
  console.log("=== Scenario 6: Monitoring & Health Reports ===\n");

  const SQL = await initSqlJs();
  const db = new SQL.Database();
  migrate(db as any);

  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);
  const monitor = new Monitor({ db: db as any });

  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "monitoring-demo" },
  });

  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "MONITOR_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 5 },
  });

  console.log("1. Running fan-out worker...");
  runFanoutOnce({ db, runId });

  const children = tasksRepo.listByRun(runId).filter((t) => t.parent_task_id === parentTaskId);
  console.log(`   Created ${children.length} child tasks`);

  // Simulate different outcomes
  console.log("2. Simulating task execution...");
  tasksRepo.updateStatus(children[0].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[1].id, "SUCCEEDED");
  tasksRepo.updateStatus(children[2].id, "FAILED", null, "Connection timeout");
  tasksRepo.updateStatus(children[3].id, "SUCCEEDED");
  // Leave children[4] as PENDING

  console.log("   - 3 tasks SUCCEEDED");
  console.log("   - 1 task FAILED");
  console.log("   - 1 task still PENDING\n");

  // Generate health report
  console.log("3. Health Report:");
  const healthReport = monitor.getHealthReport(runId);
  console.log(`   Status: ${healthReport.status}`);
  console.log(`   Total Tasks: ${healthReport.summary.totalTasks}`);
  console.log(`   Succeeded: ${healthReport.summary.succeededTasks}`);
  console.log(`   Failed: ${healthReport.summary.failedTasks}`);
  console.log(`   Pending: ${healthReport.summary.pendingTasks}`);
  console.log(`   Success Rate: ${(healthReport.metrics.successRate * 100).toFixed(1)}%`);
  console.log(`   Warnings: ${healthReport.warnings.length > 0 ? healthReport.warnings.join(", ") : "None"}\n`);

  // Demonstrate retry with monitoring
  console.log("4. Running retry worker...");
  runRetryOnce({ db, runId });

  // Get retry metrics
  const retryMetrics = monitor.getRetryMetrics(runId);
  console.log("   Retry Metrics:");
  console.log(`   - Total Retries: ${retryMetrics.totalRetries}`);
  console.log(`   - Exhausted Tasks: ${retryMetrics.exhaustedTasks}\n`);

  // Complete the retried task
  const retriedTask = tasksRepo.listByRun(runId).find((t) => t.name === children[2].name);
  if (retriedTask) {
    tasksRepo.updateStatus(retriedTask.id, "SUCCEEDED");
    console.log("5. Retried task now SUCCEEDED\n");
  }

  // Complete the pending task
  tasksRepo.updateStatus(children[4].id, "SUCCEEDED");
  console.log("6. Remaining task completed\n");

  // Run aggregation
  console.log("7. Running aggregate worker...");
  runAggregateOnce({ db, runId });

  // Get final run summary
  const runSummary = monitor.getRunSummary(runId);
  console.log("8. Run Summary:");
  console.log(`   State: ${runSummary.state}`);
  console.log(`   Total Tasks: ${runSummary.totalTasks}`);
  console.log(`   Task Breakdown:`);
  console.log(`     - Succeeded: ${runSummary.taskBreakdown.succeeded}`);
  console.log(`     - Failed: ${runSummary.taskBreakdown.failed}`);
  console.log(`     - Pending: ${runSummary.taskBreakdown.pending}`);
  console.log(`   Worker Executions:`);
  console.log(`     - Fanout: ${runSummary.workerExecutions.fanout}`);
  console.log(`     - Aggregate: ${runSummary.workerExecutions.aggregate}`);
  console.log(`     - Retry: ${runSummary.workerExecutions.retry}`);
  console.log(`   Total Events: ${runSummary.eventCount}\n`);

  // Show sample events
  const events = monitor.getEvents(runId);
  console.log("9. Event Log (sample):");
  const sampleEvents = events.slice(0, 5);
  for (const event of sampleEvents) {
    console.log(`   - ${event.name} at ${event.at}`);
  }
  console.log(`   ... and ${events.length - 5} more events\n`);

  console.log("   ✓ Monitoring scenario complete\n");

  db.close();
}

async function main() {
  console.log("=== Origin Conductor: Monitoring & Orchestration Demo ===\n");

  try {
    await runSuccessScenario();
    await runFailureScenario();
    await runPartialCompletionScenario();
    await runRetryScenario();
    await runExhaustedRetryScenario();
    await runMonitoringScenario();

    console.log("=== All Scenarios Complete ===");
    console.log("✓ Success: Parent and Run marked as SUCCEEDED");
    console.log("✓ Failure: Parent and Run marked as FAILED when child fails");
    console.log("✓ Partial: No aggregation until all children are terminal");
    console.log("✓ Retry: Failed tasks automatically retry up to max_retries");
    console.log("✓ Exhausted: Permanently FAILED after exhausting retries");
    console.log("✓ Monitoring: Health reports, metrics, and event tracking\n");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
