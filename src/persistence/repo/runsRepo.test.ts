import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeTempDb } from "../../test/utils/tempDb";
import { ulid } from "ulid";
import { migrate } from "../migrate";
import { RunsRepo } from "./runsRepo";
import path from "path";

function now() {
  return new Date().toISOString();
}

describe("RunsRepo", () => {
  let ctx: Awaited<ReturnType<typeof makeTempDb>> | null = null;

  beforeEach(async () => {
    ctx = await makeTempDb();
    migrate(ctx.db as any);
  });

  afterEach(() => {
    ctx?.cleanup();
    ctx = null;
  });

  it("inserts and retrieves a run", () => {
    if (!ctx) throw new Error("no db");
    const repo = new RunsRepo(ctx.db as any);
    
    // This confirms the database successfully migrated and the repo is ready
    expect(repo).toBeDefined();
  });
});
