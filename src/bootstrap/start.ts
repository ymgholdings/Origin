import { runMigrations } from "../db/migrations";
import { startWorker } from "../queue/worker";

async function main() {
  runMigrations();

  const role = process.env.ORIGIN_ROLE;

  if (role === "fanout-worker") {
    await startWorker({
      workerId: `fanout-${process.pid}`,
      queue: "fanout"
    });
    return;
  }

  if (role === "aggregate-worker") {
    await startWorker({
      workerId: `aggregate-${process.pid}`,
      queue: "aggregate"
    });
    return;
  }

  throw new Error(
    "ORIGIN_ROLE must be set to fanout-worker or aggregate-worker"
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
