interface DatabaseUrlIdentity {
  host: string;
  port: string;
  database: string;
}

export class DatabaseTestConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseTestConfigurationError";
  }
}

export function getIsolatedTestDatabaseUrl(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
  nodeEnvironment: string | undefined,
): string {
  if (nodeEnvironment?.toLowerCase() === "production") {
    throw new DatabaseTestConfigurationError("Database integration tests cannot run in production mode.");
  }
  if (!testDatabaseUrl?.trim()) {
    throw new DatabaseTestConfigurationError("WORKSPHERE_TEST_DATABASE_URL is required for database integration tests.");
  }

  const normalizedTestDatabaseUrl = testDatabaseUrl.trim();
  const testIdentity = parseDatabaseUrl(normalizedTestDatabaseUrl, "WORKSPHERE_TEST_DATABASE_URL");
  if (testIdentity.database === "worksphere") {
    throw new DatabaseTestConfigurationError("Refusing to use the development database for integration tests.");
  }
  if (testIdentity.database !== "worksphere_test") {
    throw new DatabaseTestConfigurationError("WORKSPHERE_TEST_DATABASE_URL must target the worksphere_test database.");
  }
  if (!isLoopbackHost(testIdentity.host)) {
    throw new DatabaseTestConfigurationError("WORKSPHERE_TEST_DATABASE_URL must use a local PostgreSQL host.");
  }

  if (applicationDatabaseUrl?.trim()) {
    const applicationIdentity = parseDatabaseUrl(applicationDatabaseUrl, "DATABASE_URL");
    if (sameDatabase(testIdentity, applicationIdentity)) {
      throw new DatabaseTestConfigurationError("Test and application database targets must be different.");
    }
  }

  return normalizedTestDatabaseUrl;
}

function parseDatabaseUrl(value: string, variableName: string): DatabaseUrlIdentity {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseTestConfigurationError(`${variableName} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseTestConfigurationError(`${variableName} must be a valid PostgreSQL URL.`);
  }

  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  } catch {
    throw new DatabaseTestConfigurationError(`${variableName} must include a valid database name.`);
  }
  if (!url.hostname || !database || database.includes("/")) {
    throw new DatabaseTestConfigurationError(`${variableName} must include a host and database name.`);
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return {
    host: isLoopbackHost(host) ? "loopback" : host,
    port: url.port || "5432",
    database,
  };
}

function isLoopbackHost(host: string): boolean {
  return host === "loopback" || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function sameDatabase(left: DatabaseUrlIdentity, right: DatabaseUrlIdentity): boolean {
  return left.host === right.host && left.port === right.port && left.database === right.database;
}