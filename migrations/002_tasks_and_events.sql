CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  parent_task_id TEXT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  input TEXT,
  output TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks(run_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  task_id TEXT,
  name TEXT NOT NULL,
  at TEXT NOT NULL,
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id);
