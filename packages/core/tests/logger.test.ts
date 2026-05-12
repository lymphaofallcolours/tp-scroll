import { describe, it, expect, vi } from "vitest";

import { type Logger, NoopLogger } from "../src/logger.js";

describe("Logger", () => {
  it("NoopLogger swallows all calls without throwing", () => {
    const logger: Logger = NoopLogger;
    expect(() => logger.debug("x")).not.toThrow();
    expect(() => logger.info("x", { a: 1 })).not.toThrow();
    expect(() => logger.warn("x")).not.toThrow();
    expect(() => logger.error("x", { err: new Error("boom") })).not.toThrow();
  });

  it("a custom logger receives the message and the context", () => {
    const calls: Array<{ level: string; msg: string; ctx?: object }> = [];
    const logger: Logger = {
      debug: (msg, ctx) => calls.push({ level: "debug", msg, ctx }),
      info: (msg, ctx) => calls.push({ level: "info", msg, ctx }),
      warn: (msg, ctx) => calls.push({ level: "warn", msg, ctx }),
      error: (msg, ctx) => calls.push({ level: "error", msg, ctx }),
    };
    logger.info("hello", { user: "alice" });
    expect(calls).toEqual([{ level: "info", msg: "hello", ctx: { user: "alice" } }]);
  });

  it("NoopLogger.debug can be called with a single string", () => {
    const spy = vi.fn();
    const logger: Logger = { ...NoopLogger, info: spy };
    logger.info("just a message");
    expect(spy).toHaveBeenCalledWith("just a message");
  });
});
