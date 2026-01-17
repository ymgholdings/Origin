import type { RunRecord, RunStatus, TaskRecord, TaskStatus } from "./types";
export declare function createRun(args: {
    parentId?: string | null;
    rootId?: string;
    kind: RunRecord["kind"];
    status?: RunStatus;
    taskName: string;
    provider?: string | null;
    model?: string | null;
    prompt: any;
    maxAttempts?: number;
}): RunRecord;
export declare function updateRunStatus(runId: string, status: RunStatus, extras?: {
    result?: any;
    error?: any;
    startedAt?: number | null;
    finishedAt?: number | null;
}): void;
export declare function enqueueTask(args: {
    runId: string;
    queue: string;
    payload: any;
    status?: TaskStatus;
    availableAt?: number;
    maxAttempts?: number;
}): TaskRecord;
export declare function getRunTree(rootId: string): {
    runs: any;
    events: any;
};
//# sourceMappingURL=service.d.ts.map