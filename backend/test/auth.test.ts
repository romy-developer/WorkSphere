import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, makeUser, TEST_PASSWORD } from "./helpers.js";

describe("authentication API", () => {
  it("logs in with valid credentials and exposes only the public user", async () => {
    const { app } = createTestApp([makeUser()]);
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf");

    const response = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", csrf.body.csrfToken)
      .send({ email: " ADMIN@example.test ", password: TEST_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "admin@example.test",
      name: "Test Administrator",
      roles: ["SUPER_ADMIN"],
    });
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers["set-cookie"].join(";")).toContain("HttpOnly");
    expect(response.headers["set-cookie"].join(";")).toContain("SameSite=Strict");
  });

  it("returns the same generic login error for an unknown email and a bad password", async () => {
    const { app } = createTestApp([makeUser()]);
    const unknownAgent = request.agent(app);
    const unknownCsrf = await unknownAgent.get("/api/auth/csrf");
    const unknown = await unknownAgent
      .post("/api/auth/login")
      .set("x-csrf-token", unknownCsrf.body.csrfToken)
      .send({ email: "missing@example.test", password: TEST_PASSWORD });

    const invalidAgent = request.agent(app);
    const invalidCsrf = await invalidAgent.get("/api/auth/csrf");
    const invalid = await invalidAgent
      .post("/api/auth/login")
      .set("x-csrf-token", invalidCsrf.body.csrfToken)
      .send({ email: "admin@example.test", password: "Incorrect!Password123" });

    expect(unknown.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(unknown.body).toEqual(invalid.body);
    expect(unknown.body.error).toBe("Invalid email or password.");
  });

  it("rejects missing, malformed, and CSRF-invalid requests", async () => {
    const { app } = createTestApp([makeUser()]);
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf");

    const missing = await agent.post("/api/auth/login").set("x-csrf-token", csrf.body.csrfToken).send({});
    const malformed = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", csrf.body.csrfToken)
      .send({ email: "invalid-email", password: "" });
    const csrfRejected = await request(app).post("/api/auth/login").send({
      email: "admin@example.test",
      password: TEST_PASSWORD,
    });

    expect(missing.status).toBe(400);
    expect(malformed.status).toBe(400);
    expect(csrfRejected.status).toBe(403);
  });

  it("rate limits repeated login attempts", async () => {
    const { app } = createTestApp([makeUser()]);
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await agent
        .post("/api/auth/login")
        .set("x-csrf-token", csrf.body.csrfToken)
        .send({ email: "admin@example.test", password: "Incorrect!Password123" });
      expect(response.status).toBe(401);
    }

    const limited = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", csrf.body.csrfToken)
      .send({ email: "admin@example.test", password: "Incorrect!Password123" });
    expect(limited.status).toBe(429);
  });

  it("returns the current user, then invalidates the session on logout", async () => {
    const { app } = createTestApp([makeUser()]);
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf");
    const login = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", csrf.body.csrfToken)
      .send({ email: "admin@example.test", password: TEST_PASSWORD });
    const oldSessionCookie = (login.headers["set-cookie"] as string[])
      .find((cookie) => cookie.startsWith("worksphere_session="))
      ?.split(";")[0];

    expect((await agent.get("/api/auth/me")).body.user.id).toBe("user-1");

    const logout = await agent
      .post("/api/auth/logout")
      .set("x-csrf-token", csrf.body.csrfToken);

    expect(logout.status).toBe(204);
    expect(oldSessionCookie).toBeDefined();
    const replay = await request(app).get("/api/auth/me").set("Cookie", oldSessionCookie ?? "");
    expect(replay.status).toBe(401);
  });

  it("rejects protected endpoints without authentication", async () => {
    const { app } = createTestApp();
    const response = await request(app).get("/api/dashboard");

    expect(response.status).toBe(401);
  });

  it("grants and denies access according to returned permissions", async () => {
    const admin = makeUser();
    const employee = makeUser({
      id: "user-2",
      email: "employee@example.test",
      name: "Test Employee",
      roles: ["EMPLOYEE"],
      permissions: ["dashboard.view"],
    });
    const { app } = createTestApp([admin, employee]);
    const adminAgent = request.agent(app);
    const adminCsrf = await adminAgent.get("/api/auth/csrf");
    await adminAgent
      .post("/api/auth/login")
      .set("x-csrf-token", adminCsrf.body.csrfToken)
      .send({ email: admin.email, password: TEST_PASSWORD });

    const employeeAgent = request.agent(app);
    const employeeCsrf = await employeeAgent.get("/api/auth/csrf");
    await employeeAgent
      .post("/api/auth/login")
      .set("x-csrf-token", employeeCsrf.body.csrfToken)
      .send({ email: employee.email, password: TEST_PASSWORD });

    expect((await adminAgent.get("/api/access-control")).status).toBe(200);
    expect((await employeeAgent.get("/api/access-control")).status).toBe(403);
    expect((await employeeAgent.get("/api/dashboard")).status).toBe(200);
  });

  it("rejects inactive users with the generic login error", async () => {
    const { app } = createTestApp([makeUser({ status: "INACTIVE" })]);
    const agent = request.agent(app);
    const csrf = await agent.get("/api/auth/csrf");
    const response = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", csrf.body.csrfToken)
      .send({ email: "admin@example.test", password: TEST_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid email or password.");
  });
});