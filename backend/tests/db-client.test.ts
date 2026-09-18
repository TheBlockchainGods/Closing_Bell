import { describe, expect, it } from "vitest";

import { buildPoolConfig } from "../src/db/client.js";

describe("buildPoolConfig", () => {
  it("skips TLS for localhost even when sslmode=require is in the URL", () => {
    const opts = buildPoolConfig(
      "postgres://bell:bell@localhost:5432/closing_bell?sslmode=require",
    );
    expect(opts.host).toBe("localhost");
    expect(opts.database).toBe("closing_bell");
    expect(opts.ssl).toBeUndefined();
    expect(opts.connectionString).toBeUndefined();
  });

  it("skips TLS for docker compose service names", () => {
    const opts = buildPoolConfig("postgres://bell:bell@db:5432/closing_bell");
    expect(opts.host).toBe("db");
    expect(opts.ssl).toBeUndefined();
  });

  it("always uses rejectUnauthorized:false TLS for Lightsail/RDS hosts", () => {
    const opts = buildPoolConfig(
      "postgres://belladmin:secret@ls-example.c90o6smsk7b5.us-west-2.rds.amazonaws.com:5432/closing_bell?sslmode=require",
    );
    expect(opts.host).toBe(
      "ls-example.c90o6smsk7b5.us-west-2.rds.amazonaws.com",
    );
    expect(opts.ssl).toEqual({ rejectUnauthorized: false });
    expect(opts.connectionString).toBeUndefined();
  });
});
