export type FanoutPlan = {
    mode: "fanout";
    task: string;
    children: Array<{
        provider: string;
        model: string;
        role: string;
        weight?: number;
        prompt: any;
    }>;
    aggregate: {
        strategy: "rank_vote" | "judge" | "merge";
        provider?: string;
        model?: string;
        prompt?: any;
    };
    limits?: {
        concurrency?: number;
        timeoutMs?: number;
    };
};
export declare function startFanout(args: {
    taskName: string;
    prompt: any;
    plan: FanoutPlan;
}): {
    rootRunId: string;
    parentRunId: string;
};
//# sourceMappingURL=fanout.d.ts.map