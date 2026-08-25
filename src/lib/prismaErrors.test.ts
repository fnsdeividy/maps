import { describe, expect, it } from "vitest";
import { isPrismaUniqueConflict } from "./prismaErrors";

describe("isPrismaUniqueConflict", () => {
  it("detects Prisma P2002 without depending on the Prisma class", () => {
    expect(isPrismaUniqueConflict({ code: "P2002" })).toBe(true);
    expect(isPrismaUniqueConflict({ code: "P2003" })).toBe(false);
    expect(isPrismaUniqueConflict(new Error("Unique constraint"))).toBe(false);
  });
});
