# Origin Conductor

> Resilient task orchestration with fan-out, aggregation, and automatic retry logic

## Overview

Origin Conductor is a TypeScript-based task orchestration system with SQLite persistence. It provides idempotent workers for fan-out task creation, state aggregation with error handling, and automatic retry logic for failed tasks.

## Features

- 🔄 **Fan-out Worker**: Create N parallel child tasks from a parent task
- 📊 **Aggregate Worker**: Propagate success/failure states from children to parents
- 🔁 **Retry Worker**: Automatically retry failed tasks with configurable limits
- 💾 **SQLite Persistence**: Dual-API support for better-sqlite3 and sql.js
- ✅ **Type-Safe**: Full TypeScript with Zod validation
- 🧪 **Well-Tested**: 31 passing tests across 7 test suites

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
pnpm vitest run

# Type check
pnpm tsc --noEmit

# Run E2E demo
npx ts-node src/scripts/minimalFanoutRun.ts
```

## Architecture

### Workers

#### Fan-out Worker
Creates N child tasks from a parent task with `input.fanout` property:

```typescript
import { runFanoutOnce } from './workers/fanoutWorker';

// Create parent task with fanout: 3
tasksRepo.insert({
  id: ulid(),
  name: 'PARENT',
  state: 'PENDING',
  input: { fanout: 3 },
  // ...
});

// Run fan-out worker
runFanoutOnce({ db, runId });
// Creates: PARENT#1, PARENT#2, PARENT#3
```

**Key Features:**
- Idempotent: safe to run multiple times
- Deterministic naming: `parent#1`, `parent#2`, etc.
- Only creates missing children

#### Aggregate Worker
Propagates states from children to parents and runs:

```typescript
import { runAggregateOnce } from './workers/aggregateWorker';

// Mark children as SUCCEEDED
tasksRepo.updateStatus(child1.id, 'SUCCEEDED');
tasksRepo.updateStatus(child2.id, 'SUCCEEDED');
tasksRepo.updateStatus(child3.id, 'SUCCEEDED');

// Run aggregate worker
runAggregateOnce({ db, runId });
// Parent → SUCCEEDED, Run → SUCCEEDED
```

**Key Features:**
- Success propagation: All children SUCCEEDED → Parent SUCCEEDED
- Failure propagation: Any child FAILED → Parent FAILED
- Terminal state handling: SUCCEEDED, FAILED, CANCELLED
- Waits for all children before aggregating

#### Retry Worker
Automatically retries failed tasks:

```typescript
import { runRetryOnce } from './workers/retryWorker';

// Task fails on first attempt
tasksRepo.updateStatus(taskId, 'FAILED', null, 'Network timeout');

// Run retry worker
const retriedCount = runRetryOnce({ db, runId });
// Task reset to PENDING, retry_count incremented
```

**Key Features:**
- Configurable retry limits (default: 3)
- Tracks retry count and last error
- Automatic retry for transient failures
- Permanent failure after exhausting retries

### State Machine

```
Task States:
PENDING → RUNNING → SUCCEEDED ✓
                 → FAILED (retry available) → PENDING
                 → FAILED (retries exhausted) ✗
                 → CANCELLED ✗

Terminal States: SUCCEEDED, FAILED, CANCELLED
```

### Database Schema

```sql
-- Runs
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  state TEXT NOT NULL,
  meta TEXT
);

-- Tasks
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  parent_task_id TEXT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  input TEXT,
  output TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT
);

-- Events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT,
  name TEXT NOT NULL,
  at TEXT NOT NULL,
  payload TEXT
);
```

## Usage Examples

### Basic Fan-out and Aggregate

```typescript
import { ulid } from 'ulid';
import { migrate } from './persistence/migrate';
import { RunsRepo } from './persistence/repo/runsRepo';
import { TasksRepo } from './persistence/repo/tasksRepo';
import { runFanoutOnce } from './workers/fanoutWorker';
import { runAggregateOnce } from './workers/aggregateWorker';

// Setup database
const db = /* your database instance */;
migrate(db);

const runs = new RunsRepo(db);
const tasks = new TasksRepo(db);

// Create run
const runId = ulid();
runs.insert({
  id: runId,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  state: 'RUNNING',
  meta: {},
});

// Create parent task
const parentId = ulid();
tasks.insert({
  id: parentId,
  run_id: runId,
  parent_task_id: null,
  name: 'PARENT',
  state: 'PENDING',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  input: { fanout: 3 },
});

// Fan-out
runFanoutOnce({ db, runId });

// Complete children
const children = tasks.listByRun(runId).filter(t => t.parent_task_id === parentId);
for (const child of children) {
  tasks.updateStatus(child.id, 'SUCCEEDED');
}

// Aggregate
runAggregateOnce({ db, runId });

// Check final state
const run = runs.get(runId);
console.log(run.state); // 'SUCCEEDED'
```

### Retry on Failure

```typescript
import { runRetryOnce } from './workers/retryWorker';

// Create task with custom retry limit
tasks.insert({
  id: taskId,
  run_id: runId,
  name: 'API_CALL',
  state: 'PENDING',
  max_retries: 5,  // Custom limit
  // ...
});

// Task fails
tasks.updateStatus(taskId, 'FAILED', null, 'Connection timeout');

// Retry worker runs
const retriedCount = runRetryOnce({ db, runId });
// retriedCount = 1

// Check retry status
const task = tasks.listByRun(runId).find(t => t.id === taskId);
console.log(task.state);        // 'PENDING'
console.log(task.retry_count);  // 1
console.log(task.max_retries);  // 5
```

## Testing

```bash
# Run all tests
pnpm vitest run

# Run specific test suites
pnpm vitest run src/workers/fanoutWorker.test.ts
pnpm vitest run src/workers/aggregateWorker.test.ts
pnpm vitest run src/workers/retryWorker.test.ts

# Watch mode
pnpm vitest watch

# Coverage
pnpm vitest run --coverage
```

### Test Coverage

- **31 tests** across 7 test suites
- Fan-out worker: 1 test (idempotency)
- Aggregate worker: 7 tests (success, failure, partial completion)
- Retry worker: 5 tests (retry logic, exhausted retries)
- Validation: 12 tests (ULID, timestamps, state transitions)
- Repositories: 3 tests (basic CRUD operations)
- IDs: 3 tests (ULID and ISO date validation)

## E2E Demo

Run the comprehensive demo showcasing all features:

```bash
npx ts-node src/scripts/minimalFanoutRun.ts
```

**Demo Scenarios:**
1. ✅ All tasks succeed (SUCCEEDED propagation)
2. ❌ One task fails (FAILED propagation)
3. ⏸️ Partial completion (no premature aggregation)
4. 🔁 Automatic retry → success on second attempt
5. 💀 Exhausted retries → permanent failure

## API Reference

### Fan-out Worker

```typescript
function runFanoutOnce(options: { db: any; runId?: string }): void
```

Finds PENDING parent tasks with `input.fanout` and creates N child tasks.

**Parameters:**
- `db`: Database instance (better-sqlite3 or sql.js)
- `runId` (optional): Limit fan-out to specific run

**Behavior:**
- Idempotent: running multiple times creates exactly N children
- Child naming: `${parent.name}#${index}`
- Only creates missing children

### Aggregate Worker

```typescript
function runAggregateOnce(options: { db: any; runId?: string }): void
```

Aggregates child states to parent tasks and task states to runs.

**Parameters:**
- `db`: Database instance
- `runId` (optional): Limit aggregation to specific run

**Behavior:**
- Marks parent SUCCEEDED when all children SUCCEEDED
- Marks parent FAILED when any child FAILED
- Marks run based on all task states
- Only aggregates when all children/tasks are terminal

### Retry Worker

```typescript
function runRetryOnce(options: { db: any; runId?: string }): number
```

Finds FAILED tasks with retries remaining and resets them to PENDING.

**Parameters:**
- `db`: Database instance
- `runId` (optional): Limit retry to specific run

**Returns:**
- Number of tasks retried

**Behavior:**
- Only retries if `retry_count < max_retries`
- Increments `retry_count` on each attempt
- Resets task to PENDING for retry
- Permanently FAILED after exhausting retries

## Configuration

### Retry Configuration

Set custom retry limits per task:

```typescript
tasks.insert({
  id: ulid(),
  name: 'CRITICAL_TASK',
  max_retries: 10,  // Retry up to 10 times
  // ...
});
```

### Database Configuration

The system supports both better-sqlite3 and sql.js:

```typescript
// Using better-sqlite3 (Node.js)
import Database from 'better-sqlite3';
const db = new Database('conductor.db');

// Using sql.js (browser/tests)
import initSqlJs from 'sql.js';
const SQL = await initSqlJs();
const db = new SQL.Database();
```

## Project Structure

```
src/
├── contracts/          # Validation schemas and contracts
│   ├── ids.ts         # ULID and ISO date validation
│   └── validation.ts  # State machine and record validation
├── persistence/       # Database layer
│   ├── migrate.ts     # Migration runner
│   └── repo/
│       ├── runsRepo.ts   # Runs repository
│       └── tasksRepo.ts  # Tasks repository
├── workers/           # Worker implementations
│   ├── fanoutWorker.ts      # Fan-out worker
│   ├── aggregateWorker.ts   # Aggregate worker
│   └── retryWorker.ts       # Retry worker
├── scripts/           # Demo and utility scripts
│   └── minimalFanoutRun.ts  # E2E demo
└── test/
    └── utils/
        └── tempDb.ts  # Test database utility

migrations/
├── 001_initial_schema.sql      # Runs table
├── 002_tasks_and_events.sql    # Tasks and events tables
└── 003_add_retry_fields.sql    # Retry fields
```

## Contributing

### Development Setup

```bash
# Install dependencies
pnpm install

# Run tests in watch mode
pnpm vitest watch

# Type check
pnpm tsc --noEmit

# Run E2E demo
npx ts-node src/scripts/minimalFanoutRun.ts
```

### Running Tests

Before submitting changes:

1. Run all tests: `pnpm vitest run`
2. Type check: `pnpm tsc --noEmit`
3. Run E2E demo: `npx ts-node src/scripts/minimalFanoutRun.ts`

## License

[Add your license here]

## Documentation

- [HANDOFF_COMPLETE.md](./HANDOFF_COMPLETE.md) - Complete implementation documentation
- [Test files](./src/) - Usage examples in test files
- [E2E Demo](./src/scripts/minimalFanoutRun.ts) - Comprehensive demo script

---

**Built with [Claude Code](https://claude.com/claude-code)**
