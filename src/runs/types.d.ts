export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type RunKind = "parent" | "child" | "single";
export type RunRecord = {
    id: string;
    parent_id: string | null;
    root_id: string;
    kind: RunKind;
    status: RunStatus;
    task_name: string;
    provider: string | null;
    model: string | null;
    prompt_json: string;
    result_json: string | null;
    error_json: string | null;
    attempt: number;
    max_attempts: number;
    created_at: number;
    updated_at: number;
    started_at: number | null;
    finished_at: number | null;
};
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type TaskRecord = {
    id: string;
    run_id: string;
    status: TaskStatus;
    queue: string;
    payload_json: string;
    locked_by: string | null;
    locked_at: number | null;
    available_at: number;
    attempt: number;
    max_attempts: number;
    created_at: number;
    updated_at: number;
};
//# sourceMappingURL=types.d.ts.map