"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorker = startWorker;
const leasing_1 = require("./leasing");
const backoff_1 = require("./backoff");
const service_1 = require("../runs/service");
const aggregate_1 = require("../orchestration/aggregate");
const dispatch_1 = require("../providers/dispatch");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function startWorker(opts) {
    const leaseMs = opts.leaseMs ?? 60_000;
    const tickMs = opts.tickMs ?? 200;
    for (;;) {
        const leased = (0, leasing_1.leaseNextTask)({
            workerId: opts.workerId,
            queue: opts.queue,
            leaseMs
        });
        if (!leased) {
            await sleep(tickMs);
            continue;
        }
        try {
            await handleTask(opts.queue, leased);
            (0, leasing_1.completeTask)(leased.taskId, "succeeded");
        }
        catch (err) {
            const attempt = leased.attempt + 1;
            const canRetry = attempt < leased.maxAttempts;
            if (canRetry) {
                (0, leasing_1.completeTask)(leased.taskId, "failed", {
                    attemptInc: true,
                    availableAt: Date.now() + (0, backoff_1.backoffMs)(attempt)
                });
            }
            else {
                (0, leasing_1.completeTask)(leased.taskId, "failed", { attemptInc: true });
            }
        }
    }
}
async function handleTask(queue, leased) {
    const payload = leased.payload;
    if (queue === "fanout") {
        (0, service_1.updateRunStatus)(payload.childRunId, "running", {
            startedAt: Date.now()
        });
        const out = await (0, dispatch_1.dispatchToProvider)({
            provider: payload.provider,
            model: payload.model,
            taskName: payload.taskName,
            input: payload.input,
            prompt: payload.prompt,
            role: payload.role,
            runId: payload.childRunId,
            rootRunId: payload.rootRunId
        });
        (0, service_1.updateRunStatus)(payload.childRunId, "succeeded", {
            result: out,
            finishedAt: Date.now()
        });
        return;
    }
    if (queue === "aggregate") {
        const res = (0, aggregate_1.aggregateIfReady)({
            rootRunId: payload.rootRunId,
            parentRunId: payload.parentRunId
        });
        if (!res.ready) {
            throw new Error("AGGREGATE_NOT_READY");
        }
        return;
    }
    throw new Error(`Unknown queue: ${queue}`);
}
//# sourceMappingURL=worker.js.map