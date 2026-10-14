import { describe, expect, it } from "vitest";
import {
  DatabaseTestConfigurationError,
  getIsolatedTestDatabaseUrl,
} from "./database-test-config.js";

const isolatedUrl = "postgresql://test_user:placeholder@localhost:5432/worksphere_test?schema=public";

describe("isolated database test configuration", () => {
  it("accepts only the dedicated local test database", () => {
    expect(getIsolatedTestDatabaseUrl(isolatedUrl, undefined, "test")).toBe(isolatedUrl);
  });

  it("rejects missing and malformed test URLs without revealing credentials", () => {
    expect(() => getIsolatedTestDatabaseUrl(undefined, undefined, "test"))
      .toThrow(DatabaseTestConfigurationError);

    const secretMarker = "credential-marker";
    let errorMessage = "";
    try {
      getIsolatedTestDatabaseUrl(
        `postgresql://user:${secretMarker}@localhost:5432`,
        undefined,
        "test",
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).toContain("WORKSPHERE_TEST_DATABASE_URL");
    expect(errorMessage).not.toContain(secretMarker);
  });

  it("rejects the known development database and other database names", () => {
    expect(() => getIsolatedTestDatabaseUrl(
      "postgresql://user:secret@localhost:5432/worksphere?schema=public",
      undefined,
      "test",
    )).toThrow(DatabaseTestConfigurationError);
    expect(() => getIsolatedTestDatabaseUrl(
      "postgresql://user:secret@localhost:5432/production?schema=public",
      undefined,
      "test",
    )).toThrow(DatabaseTestConfigurationError);
  });

  it("rejects remote hosts, production mode, and a target matching DATABASE_URL", () => {
    expect(() => getIsolatedTestDatabaseUrl(
      "postgresql://user:secret@db.example.com:5432/worksphere_test",
      undefined,
      "test",
    )).toThrow(DatabaseTestConfigurationError);
    expect(() => getIsolatedTestDatabaseUrl(isolatedUrl, undefined, "production"))
      .toThrow(DatabaseTestConfigurationError);
    expect(() => getIsolatedTestDatabaseUrl(
      isolatedUrl,
      "postgresql://app_user:other-secret@127.0.0.1:5432/worksphere_test?schema=public",
      "test",
    )).toThrow(DatabaseTestConfigurationError);
  });

  it("trims the test URL and rejects an invalid encoded database name", () => {
    expect(getIsolatedTestDatabaseUrl(` ${isolatedUrl} `, undefined, "test")).toBe(isolatedUrl);
    expect(() => getIsolatedTestDatabaseUrl(
      "postgresql://user:secret@localhost:5432/worksphere%ZZtest",
      undefined,
      "test",
    )).toThrow(DatabaseTestConfigurationError);
  });
});