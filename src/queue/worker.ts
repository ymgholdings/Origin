import { leaseNextTask, completeTask } from "./leasing";
import { backoffMs } from "./backoff";
import { updateRunStatus } from "../runs/service";
import { aggregateIfReady } from "../orchestration/aggregate";
import { dispatchToProvider } from "../providers/dispatch";

type WorkerOpts = {
  workerId: string;
  queue: "fanout" | "aggregate";
  leaseMs?: number;
  tickMs?: number;
};

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export async function startWorker(opts: WorkerOpts): Promise<void> {
  const leaseMs = opts.leaseMs ?? 60_000;
  const tickMs = opts.tickMs ?? 200;

  for (;;) {
    const leased = leaseNextTask({
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
      completeTask(leased.taskId, "succeeded");
    } catch (err) {
      const attempt = leased.attempt + 1;
      const canRetry = attempt < leased.maxAttempts;

      if (canRetry) {
        completeTask(leased.taskId, "failed", {
          attemptInc: true,
          availableAt: Date.now() + backoffMs(attempt)
        });
      } else {
        completeTask(leased.taskId, "failed", { attemptInc: true });
      }
    }
  }
}

async function handleTask(queue: string, leased: any): Promise<void> {
  const payload = leased.payload;

  if (queue === "fanout") {
    updateRunStatus(payload.childRunId, "running", {
      startedAt: Date.now()
    });

    const out = await dispatchToProvider({
      provider: payload.provider,
      model: payload.model,
      taskName: payload.taskName,
      input: payload.input,
      prompt: payload.prompt,
      role: payload.role,
      runId: payload.childRunId,
      rootRunId: payload.rootRunId
    });

    updateRunStatus(payload.childRunId, "succeeded", {
      result: out,
      finishedAt: Date.now()
    });

    return;
  }

  if (queue === "aggregate") {
    const res = aggregateIfReady({
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
