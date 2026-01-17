import { createRun, enqueueTask, updateRunStatus } from "../runs/service";

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

export function startFanout(args: {
  taskName: string;
  prompt: any;
  plan: FanoutPlan;
}): { rootRunId: string; parentRunId: string } {
  const parent = createRun({
    kind: "parent",
    taskName: args.taskName,
    prompt: { input: args.prompt, plan: args.plan }
  });

  updateRunStatus(parent.id, "running", { startedAt: Date.now() });

  for (const child of args.plan.children) {
    const childRun = createRun({
      kind: "child",
      parentId: parent.id,
      rootId: parent.root_id,
      taskName: args.taskName,
      provider: child.provider,
      model: child.model,
      prompt: { role: child.role, input: args.prompt, prompt: child.prompt }
    });

    enqueueTask({
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

  enqueueTask({
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
