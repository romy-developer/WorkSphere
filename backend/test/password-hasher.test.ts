import argon2 from "argon2";
import { describe, expect, it } from "vitest";

describe("password hashing", () => {
  it("creates an Argon2id hash and verifies it without storing the plaintext", async () => {
    const password = "UnitTest!Password123";
    const passwordHash = await argon2.hash(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    await expect(argon2.verify(passwordHash, password)).resolves.toBe(true);
    await expect(argon2.verify(passwordHash, "wrong password")).resolves.toBe(false);
  });
});