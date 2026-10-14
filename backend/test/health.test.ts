import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("GET /health", () => {
  it("returns the API health status", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});