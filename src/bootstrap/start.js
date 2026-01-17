"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const migrations_1 = require("../db/migrations");
const worker_1 = require("../queue/worker");
async function main() {
    (0, migrations_1.runMigrations)();
    const role = process.env.ORIGIN_ROLE;
    if (role === "fanout-worker") {
        await (0, worker_1.startWorker)({
            workerId: `fanout-${process.pid}`,
            queue: "fanout"
        });
        return;
    }
    if (role === "aggregate-worker") {
        await (0, worker_1.startWorker)({
            workerId: `aggregate-${process.pid}`,
            queue: "aggregate"
        });
        return;
    }
    throw new Error("ORIGIN_ROLE must be set to fanout-worker or aggregate-worker");
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=start.js.map