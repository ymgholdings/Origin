import { describe, it, expect } from "vitest";
import { ULID, ISODate } from "./ids";

describe("contracts/ids", () => {
  it("accepts a valid ULID", () => {
    expect(() =>
      ULID.parse("01ARZ3NDEKTSV4RRFFQ69G5FAV")
    ).not.toThrow();
  });

  it("rejects an invalid ULID", () => {
    expect(() =>
      ULID.parse("not-a-ulid")
    ).toThrow();
  });

  it("accepts an ISO datetime with offset", () => {
    expect(() =>
      ISODate.parse("2026-01-16T10:00:00-05:00")
    ).not.toThrow();
  });
});
