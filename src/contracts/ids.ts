import { z } from "zod";

export const ULID = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, "Invalid ULID");

export const ISODate = z.string().datetime({ offset: true });

export type ULID = z.infer<typeof ULID>;

