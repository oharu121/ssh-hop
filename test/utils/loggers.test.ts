import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { noOpLogger } from "../../src/utils/NoOpLogger";
import { consoleLogger } from "../../src/utils/ConsoleLogger";

describe("NoOpLogger", () => {
  it("should have all required logger methods", () => {
    expect(noOpLogger).toHaveProperty("info");
    expect(noOpLogger).toHaveProperty("error");
    expect(noOpLogger).toHaveProperty("warning");
    expect(noOpLogger).toHaveProperty("success");
    expect(noOpLogger).toHaveProperty("task");
  });

  it("should not throw errors when calling methods", () => {
    expect(() => noOpLogger.info("test")).not.toThrow();
    expect(() => noOpLogger.error("test")).not.toThrow();
    expect(() => noOpLogger.warning("test")).not.toThrow();
    expect(() => noOpLogger.success("test")).not.toThrow();
    expect(() => noOpLogger.task("test")).not.toThrow();
  });

  it("should be a silent logger (no-op)", () => {
    // Verify methods are no-ops by checking they don't modify anything
    const result1 = noOpLogger.info("test");
    const result2 = noOpLogger.error("test");
    const result3 = noOpLogger.warning("test");
    const result4 = noOpLogger.success("test");
    const result5 = noOpLogger.task("test");

    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
    expect(result3).toBeUndefined();
    expect(result4).toBeUndefined();
    expect(result5).toBeUndefined();
  });
});

describe("ConsoleLogger", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("should have all required logger methods", () => {
    expect(consoleLogger).toHaveProperty("info");
    expect(consoleLogger).toHaveProperty("error");
    expect(consoleLogger).toHaveProperty("warning");
    expect(consoleLogger).toHaveProperty("success");
    expect(consoleLogger).toHaveProperty("task");
  });

  it("should call console.log for info messages", () => {
    consoleLogger.info("test message");
    expect(consoleLogSpy).toHaveBeenCalledWith("ℹ test message");
  });

  it("should call console.error for error messages", () => {
    consoleLogger.error("error message");
    expect(consoleErrorSpy).toHaveBeenCalledWith("✗ error message");
  });

  it("should call console.warn for warning messages", () => {
    consoleLogger.warning("warning message");
    expect(consoleWarnSpy).toHaveBeenCalledWith("⚠ warning message");
  });

  it("should call console.log for success messages", () => {
    consoleLogger.success("success message");
    expect(consoleLogSpy).toHaveBeenCalledWith("✓ success message");
  });

  it("should call console.log for task messages", () => {
    consoleLogger.task("task message");
    expect(consoleLogSpy).toHaveBeenCalledWith("→ task message");
  });

  it("should format messages with appropriate symbols", () => {
    consoleLogger.info("info");
    consoleLogger.error("error");
    consoleLogger.warning("warn");
    consoleLogger.success("success");
    consoleLogger.task("task");

    expect(consoleLogSpy).toHaveBeenCalledTimes(3); // info, success, task
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });
});
