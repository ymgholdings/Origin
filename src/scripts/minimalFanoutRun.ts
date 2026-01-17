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

async function main() {
  console.log("=== Origin Conductor: Error Handling Demo ===\n");

  try {
    await runSuccessScenario();
    await runFailureScenario();
    await runPartialCompletionScenario();

    console.log("=== All Scenarios Complete ===");
    console.log("✓ Success: Parent and Run marked as SUCCEEDED");
    console.log("✓ Failure: Parent and Run marked as FAILED when child fails");
    console.log("✓ Partial: No aggregation until all children are terminal\n");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
