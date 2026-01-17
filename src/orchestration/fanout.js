"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFanout = startFanout;
const service_1 = require("../runs/service");
function startFanout(args) {
    const parent = (0, service_1.createRun)({
        kind: "parent",
        taskName: args.taskName,
        prompt: { input: args.prompt, plan: args.plan }
    });
    (0, service_1.updateRunStatus)(parent.id, "running", { startedAt: Date.now() });
    for (const child of args.plan.children) {
        const childRun = (0, service_1.createRun)({
            kind: "child",
            parentId: parent.id,
            rootId: parent.root_id,
            taskName: args.taskName,
            provider: child.provider,
            model: child.model,
            prompt: { role: child.role, input: args.prompt, prompt: child.prompt }
        });
        (0, service_1.enqueueTask)({
            runId: childRun.id,
            queue: "fanout",
            payload: {
                type: "invoke_model",
                provider: child.provider,
                model: child.model,
                role: child.role,
                taskName: args.taskName,
                input: args.prompt,
                prompt: child.prompt,
                rootRunId: parent.root_id,
                parentRunId: parent.id,
                childRunId: childRun.id
            },
            maxAttempts: 2
        });
    }
    (0, service_1.enqueueTask)({
        runId: parent.id,
        queue: "aggregate",
        payload: {
            type: "aggregate",
            taskName: args.taskName,
            rootRunId: parent.root_id,
            parentRunId: parent.id,
            aggregate: args.plan.aggregate
        },
        maxAttempts: 2,
        availableAt: Date.now() + 250
    });
    return { rootRunId: parent.root_id, parentRunId: parent.id };
}
//# sourceMappingURL=fanout.js.map