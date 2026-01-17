import { ULID, ISODate } from "./ids";
import { z } from "zod";

/**
 * Validates a ULID string
 */
export function validateULID(value: string): boolean {
  return ULID.safeParse(value).success;
}

/**
 * Validates an ISO timestamp string
 */
export function validateISODate(value: string): boolean {
  return ISODate.safeParse(value).success;
}

/**
 * Task state machine
 */
export const TaskState = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export type TaskState = z.infer<typeof TaskState>;

/**
 * Run state machine
 */
export const RunState = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export type RunState = z.infer<typeof RunState>;

/**
 * Valid task state transitions
 */
const TASK_STATE_TRANSITIONS: Record<TaskState, TaskState[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: [], // Terminal state
  FAILED: ["RUNNING"], // Allow retry
  CANCELLED: [], // Terminal state
};

/**
 * Valid run state transitions
 */
const RUN_STATE_TRANSITIONS: Record<RunState, RunState[]> = {
  PENDING: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  SUCCEEDED: [], // Terminal state
  FAILED: ["RUNNING"], // Allow retry
  CANCELLED: [], // Terminal state
};

/**
 * Validates if a task state transition is allowed
 */
export function isValidTaskStateTransition(
  from: TaskState,
  to: TaskState
): boolean {
  const allowedTransitions = TASK_STATE_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

/**
 * Validates if a run state transition is allowed
 */
export function isValidRunStateTransition(
  from: RunState,
  to: RunState
): boolean {
  const allowedTransitions = RUN_STATE_TRANSITIONS[from];
  return allowedTransitions.includes(to);
}

/**
 * Validates a task record structure
 */
export const TaskRecordSchema = z.object({
  id: ULID,
  run_id: ULID,
  parent_task_id: z.union([ULID, z.null()]).optional(),
  name: z.string().min(1),
  state: TaskState,
  created_at: ISODate,
  updated_at: ISODate,
  input: z.any().optional(),
  output: z.any().optional(),
});

/**
 * Validates a run record structure
 */
export const RunRecordSchema = z.object({
  id: ULID,
  created_at: ISODate,
  updated_at: ISODate,
  state: RunState,
  meta: z.any().optional(),
});

/**
 * Validates a task record
 */
export function validateTaskRecord(record: unknown): boolean {
  return TaskRecordSchema.safeParse(record).success;
}

/**
 * Validates a run record
 */
export function validateRunRecord(record: unknown): boolean {
  return RunRecordSchema.safeParse(record).success;
}
