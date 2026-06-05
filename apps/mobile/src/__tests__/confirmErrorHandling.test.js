import { describe, expect, it, vi } from "vitest";
import { applyConfirmError, confirmErrorMessage, confirmSuccessMessage } from "../operationController.js";

function ctx() {
  return {
    state: {
      currentActor: { token: "tok", displayName: "Operator" },
      loginMessage: "",
      operationMessage: "",
      view: "workspace"
    },
    tr: (key) => key,
    render: vi.fn()
  };
}

describe("confirm HTTP error handling", () => {
  it("clears session only for 401 authentication failures", () => {
    const context = ctx();
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    localStorage.setItem("workosnext.actorSession", JSON.stringify(context.state.currentActor));

    expect(applyConfirmError({ status: 401 }, context)).toBe(true);

    expect(context.state.currentActor).toBeNull();
    expect(context.state.view).toBe("login");
    expect(localStorage.getItem("workosnext.actorSession")).toBeNull();
    vi.unstubAllGlobals();
  });

  it.each([
    [400, "operations.error.safe.400"],
    [409, "operations.error.safe.409"],
    [422, "operations.error.safe.422"]
  ])("keeps session for %s confirm blockers", (status, messageKey) => {
    const context = ctx();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    });
    const handled = applyConfirmError({ status, reason: "stable_reason" }, context);

    expect(handled).toBe(false);
    expect(context.state.currentActor).not.toBeNull();
    expect(context.state.view).toBe("workspace");
    expect(context.state.operationMessage).toBe(messageKey);
    vi.unstubAllGlobals();
  });

  it("clears persisted session for 403 while keeping permission diagnostic context", () => {
    const context = ctx();
    const storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    });
    localStorage.setItem("workosnext.actorSession", JSON.stringify(context.state.currentActor));

    const handled = applyConfirmError({ status: 403, reason: "capability_missing" }, context);

    expect(handled).toBe(false);
    expect(context.state.currentActor).not.toBeNull();
    expect(context.state.permissionDiagnostic.reason).toBe("capability_missing");
    expect(localStorage.getItem("workosnext.actorSession")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("maps frontend copy keys by confirm status", () => {
    const context = ctx();

    expect(confirmErrorMessage({ status: 403 }, context)).toBe("operations.error.safe.403");
    expect(confirmErrorMessage({ status: 409 }, context)).toBe("operations.error.safe.409");
    expect(confirmErrorMessage({ status: 422 }, context)).toBe("operations.error.safe.422");
  });

  it("uses committed projection pending copy instead of submit failed", () => {
    const context = ctx();

    expect(confirmSuccessMessage({
      confirmed: true,
      commitStatus: "committed",
      projectionStatus: "pending"
    }, context)).toBe("submitProjectionPending");
  });

  it("does not treat uncommitted business blockers as submit success", () => {
    const context = ctx();

    expect(confirmSuccessMessage({
      confirmed: false,
      commitStatus: "blocked",
      projectionStatus: "not_started",
      reason: "persisted_work_item_required",
      message: "需要先生成真实办理任务"
    }, context)).toBe("operations.error.safe.422");
  });
});
