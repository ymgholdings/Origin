type WorkerOpts = {
    workerId: string;
    queue: "fanout" | "aggregate";
    leaseMs?: number;
    tickMs?: number;
};
export declare function startWorker(opts: WorkerOpts): Promise<void>;
export {};
//# sourceMappingURL=worker.d.ts.map