import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/domain/auth/password";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("secret123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
