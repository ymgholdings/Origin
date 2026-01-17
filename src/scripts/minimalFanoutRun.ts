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

async function main() {
  console.log("=== Origin Conductor: Minimal Fan-out Run ===\n");

  // Initialize in-memory database
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Apply migrations
  console.log("1. Applying migrations...");
  migrate(db as any);
  console.log("   ✓ Migrations applied\n");

  // Create repositories
  const runsRepo = new RunsRepo(db as any);
  const tasksRepo = new TasksRepo(db as any);

  // Step 1: Create a new run
  console.log("2. Creating a new run...");
  const runId = ulid();
  runsRepo.insert({
    id: runId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    state: "RUNNING",
    meta: { purpose: "minimal-fanout-demo" },
  });
  console.log(`   ✓ Run created: ${runId}\n`);

  // Step 2: Create one fanout parent task
  console.log("3. Creating parent task with fanout: 3...");
  const parentTaskId = ulid();
  tasksRepo.insert({
    id: parentTaskId,
    run_id: runId,
    parent_task_id: null,
    name: "DEMO_FANOUT_PARENT",
    state: "PENDING",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: { fanout: 3 },
  });
  console.log(`   ✓ Parent task created: ${parentTaskId}\n`);

  // Step 3: Call fanout worker
  console.log("4. Running fanout worker...");
  runFanoutOnce({ db, runId });
  const tasksAfterFanout = tasksRepo.listByRun(runId);
  const children = tasksAfterFanout.filter((t) => t.parent_task_id === parentTaskId);
  console.log(`   ✓ Created ${children.length} child tasks:`);
  children.forEach((child) => {
    console.log(`     - ${child.name} (${child.id}) [${child.state}]`);
  });
  console.log();

  // Step 4: Simulate completing all children
  console.log("5. Simulating completion of all child tasks...");
  for (const child of children) {
    tasksRepo.updateStatus(child.id, "SUCCEEDED", { completed: true });
    console.log(`   ✓ Completed: ${child.name}`);
  }
  console.log();

  // Step 5: Call aggregate worker
  console.log("6. Running aggregate worker...");
  runAggregateOnce({ db, runId });
  const tasksAfterAggregate = tasksRepo.listByRun(runId);
  const parent = tasksAfterAggregate.find((t) => t.id === parentTaskId);
  console.log(`   ✓ Parent task state: ${parent?.state}`);
  const finalRun = runsRepo.get(runId);
  console.log(`   ✓ Run state: ${finalRun?.state}\n`);

  // Step 6: Print final state
  console.log("=== Final State ===");
  console.log(`Run ID: ${runId}`);
  console.log(`Run State: ${finalRun?.state}`);
  console.log(`Total Tasks: ${tasksAfterAggregate.length}`);
  console.log(`Parent Task: ${parent?.name} [${parent?.state}]`);
  console.log(`Child Tasks:`);
  tasksAfterAggregate
    .filter((t) => t.parent_task_id === parentTaskId)
    .forEach((child) => {
      console.log(`  - ${child.name} [${child.state}]`);
    });

  console.log("\n✓ Demo completed successfully!");

  // Cleanup
  db.close();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
