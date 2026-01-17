import { describe, it, expect } from "vitest";
import {
  validateULID,
  validateISODate,
  isValidTaskStateTransition,
  isValidRunStateTransition,
  validateTaskRecord,
  validateRunRecord,
} from "./validation";
import { ulid } from "ulid";

describe("Validation", () => {
  describe("validateULID", () => {
    it("validates valid ULIDs", () => {
      const validULID = ulid();
      expect(validateULID(validULID)).toBe(true);
    });

    it("rejects invalid ULIDs", () => {
      expect(validateULID("invalid")).toBe(false);
      expect(validateULID("12345")).toBe(false);
      expect(validateULID("")).toBe(false);
    });
  });

  describe("validateISODate", () => {
    it("validates valid ISO dates", () => {
      const validDate = new Date().toISOString();
      expect(validateISODate(validDate)).toBe(true);
    });

    it("rejects invalid ISO dates", () => {
      expect(validateISODate("invalid")).toBe(false);
      expect(validateISODate("2024-01-01")).toBe(false);
      expect(validateISODate("")).toBe(false);
    });
  });

  describe("isValidTaskStateTransition", () => {
    it("allows valid transitions", () => {
      expect(isValidTaskStateTransition("PENDING", "RUNNING")).toBe(true);
      expect(isValidTaskStateTransition("RUNNING", "SUCCEEDED")).toBe(true);
      expect(isValidTaskStateTransition("RUNNING", "FAILED")).toBe(true);
      expect(isValidTaskStateTransition("FAILED", "RUNNING")).toBe(true); // Retry
    });

    it("rejects invalid transitions", () => {
      expect(isValidTaskStateTransition("PENDING", "SUCCEEDED")).toBe(false);
      expect(isValidTaskStateTransition("SUCCEEDED", "RUNNING")).toBe(false);
      expect(isValidTaskStateTransition("CANCELLED", "RUNNING")).toBe(false);
    });
  });

  describe("isValidRunStateTransition", () => {
    it("allows valid transitions", () => {
      expect(isValidRunStateTransition("PENDING", "RUNNING")).toBe(true);
      expect(isValidRunStateTransition("RUNNING", "SUCCEEDED")).toBe(true);
      expect(isValidRunStateTransition("RUNNING", "FAILED")).toBe(true);
      expect(isValidRunStateTransition("FAILED", "RUNNING")).toBe(true); // Retry
    });

    it("rejects invalid transitions", () => {
      expect(isValidRunStateTransition("PENDING", "SUCCEEDED")).toBe(false);
      expect(isValidRunStateTransition("SUCCEEDED", "RUNNING")).toBe(false);
      expect(isValidRunStateTransition("CANCELLED", "RUNNING")).toBe(false);
    });
  });

  describe("validateTaskRecord", () => {
    it("validates valid task records", () => {
      const validTask = {
        id: ulid(),
        run_id: ulid(),
        parent_task_id: null,
        name: "TEST_TASK",
        state: "PENDING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      expect(validateTaskRecord(validTask)).toBe(true);
    });

    it("rejects invalid task records", () => {
      expect(validateTaskRecord({})).toBe(false);
      expect(validateTaskRecord({ id: "invalid" })).toBe(false);
      expect(
        validateTaskRecord({
          id: ulid(),
          run_id: ulid(),
          name: "",
          state: "INVALID_STATE",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      ).toBe(false);
    });
  });

  describe("validateRunRecord", () => {
    it("validates valid run records", () => {
      const validRun = {
        id: ulid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        state: "RUNNING",
        meta: {},
      };
      expect(validateRunRecord(validRun)).toBe(true);
    });

    it("rejects invalid run records", () => {
      expect(validateRunRecord({})).toBe(false);
      expect(validateRunRecord({ id: "invalid" })).toBe(false);
      expect(
        validateRunRecord({
          id: ulid(),
          created_at: "invalid",
          updated_at: new Date().toISOString(),
          state: "RUNNING",
        })
      ).toBe(false);
    });
  });
});
