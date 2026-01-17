export declare function leaseNextTask(opts: {
    workerId: string;
    queue: string;
    leaseMs: number;
}): any;
export declare function completeTask(taskId: string, status: "succeeded" | "failed", extras?: {
    availableAt?: number;
    attemptInc?: boolean;
}): void;
//# sourceMappingURL=leasing.d.ts.map