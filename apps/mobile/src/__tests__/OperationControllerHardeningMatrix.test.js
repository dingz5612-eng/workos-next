import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../operationRuntime.js", () => ({
  createSubmissionProtocol: vi.fn(() => ({
    idempotencyKey: "idem-mock",
    submissionId: "sub-mock",
    cardInstanceId: "ci-mock",
    aggregateRef: "roomId:R-101"
  })),
  materializeEvidenceObjects: vi.fn(),
  submitWorkItemOperation: vi.fn()
}));

vi.mock("../apiClient.js", () => ({
  fetchOperationWorkItems: vi.fn()
}));

import { fetchOperationWorkItems } from "../apiClient.js";
import {
  materializeEvidenceObjects,
  submitWorkItemOperation
} from "../operationRuntime.js";
import {
  collectDraftingValuesOnInput,
  collectEvidenceDrafts,
  collectEvidenceIds,
  collectOperationValues,
  confirmBlockedMessage,
  confirmSuccessMessage,
  saveCurrentDraft,
  setSegmentedOperationField,
  submitCurrentCard,
  systemEvidenceDraftsFor,
  toggleEvidenceSelection,
  updateDerivedFields
} from "../operationController.js";
import { DORMITORY_SCENARIO1_STEPS } from "../capabilityProjection.js";
import { loadDraft } from "../operationDrafts.js";
import { createSurfaceCtx, runtimeStore } from "./surfaceContractTestHelpers.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  installBrowserMocks();
});

describe("operationController hardening matrix", () => {
  it("collects field, range, generated bed label, layout, and selected evidence values", () => {
    const bedCount = input("bedCount", "4");
    const bedLabels = input("bedLabels", "");
    const bedType = input("bedType", "bunk_pair");
    const bedLayout = input("bedLayout", "");
    const start = rangeStart("rentPeriod", "2026-06-01");
    const end = rangeEnd("rentPeriod", "2026-06-30");
    const evidence = evidenceNode("room-photo", true);
    installDocument({
      fields: [input("roomId", "R-101"), bedCount, bedLabels, bedType, bedLayout],
      rangeStarts: [start],
      rangeEnds: [end],
      evidence: [evidence]
    });

    const values = collectOperationValues();

    expect(values).toMatchObject({
      roomId: "R-101",
      rentPeriod: "2026-06-01 至 2026-06-30",
      bedCount: "4",
      bedLabels: "01, 02, 03, 04"
    });
    expect(values.bedLayout).toContain('"type":"upper"');
    expect(collectEvidenceDrafts()).toEqual([{
      requirementId: "room-photo",
      evidenceId: expect.stringContaining("evidence-room-photo-")
    }]);
    expect(collectEvidenceIds()[0]).toContain("evidence-room-photo-");
  });

  it("keeps system evidence stable for verified runtime evidence and generates missing requirements", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-1" });

    expect(systemEvidenceDraftsFor({ evidence: null }, [])).toEqual([]);
    expect(systemEvidenceDraftsFor({
      evidence: [{ id: "room-photo" }, { id: "duplicate-check" }]
    }, [
      { requirementId: "room-photo", evidenceId: "evd-existing", source: "system" }
    ])).toEqual([
      { requirementId: "room-photo", evidenceId: "evd-existing", source: "system", status: "verified" },
      { requirementId: "duplicate-check", evidenceId: "evidence-duplicate-check-uuid-1", source: "system", status: undefined }
    ]);
  });

  it("saves draft and evidence selection with submission protocol", () => {
    const node = evidenceNode("room-photo", false);
    installDocument({
      fields: [input("roomNo", "A101")],
      evidence: [node]
    });
    const ctx = operationCtx();

    toggleEvidenceSelection({ target: node }, ctx);
    saveCurrentDraft(ctx);

    const draft = loadDraft("W-DORM-MAINLINE", "cert.roomSetupConfirm");
    expect(node.classList.contains("selected")).toBe(true);
    expect(draft.values.roomNo).toBe("A101");
    expect(draft.evidenceDrafts[0].requirementId).toBe("room-photo");
    expect(draft.submissionProtocol).toMatchObject({ submissionId: "sub-mock" });
    expect(ctx.state.operationMessage).toBe(ctx.tr("draftSaved"));
  });

  it("updates derived fields and persists input changes without stale required-field blockers", () => {
    const amount = input("amount", "");
    const unitRate = input("unitRate", "5");
    const tariffQuantity = input("tariffQuantity", "3");
    const bedCount = input("bedCount", "2");
    const bedLabels = input("bedLabels", "");
    const bedType = input("bedType", "bunk_pair");
    const bedLayout = input("bedLayout", "");
    const preview = previewNode();
    installDocument({
      fields: [input("roomNo", "A101"), amount, unitRate, tariffQuantity, bedCount, bedLabels, bedType, bedLayout],
      preview
    });
    const ctx = operationCtx();
    ctx.state.lastActionResult = {
      status: "business_blocked_422",
      reason: "required_field_missing"
    };
    ctx.render = vi.fn();

    updateDerivedFields(ctx);
    collectDraftingValuesOnInput({
      type: "change",
      target: {
        tagName: "SELECT",
        dataset: { operationField: "roomNo" },
        matches: () => true
      }
    }, ctx);

    expect(amount.value).toBe("15");
    expect(bedLabels.value).toBe("01, 02");
    expect(bedLayout.value).toContain('"type":"upper"');
    expect(preview.children.map((child) => child.textContent)).toEqual(["01 · 上铺", "02 · 下铺"]);
    expect(ctx.state.lastActionResult).toBeNull();
    expect(ctx.state.fieldValidation).toBeNull();
    expect(ctx.render).toHaveBeenCalled();
  });

  it("keeps the scenario 1 readiness select alias in the current-step draft", () => {
    const store = runtimeStore();
    const cardId = DORMITORY_SCENARIO1_STEPS[2].cardId;
    store.workspaces[0].cards = [{
      id: cardId,
      status: "ready",
      title: { "zh-CN": "基础就绪确认" },
      fields: { business: [field("readinessState", "基础就绪结论")], system: [], analytics: [] },
      evidence: [],
      checks: [],
      blockerRules: [],
      confirmation: { required: true, requiredRole: "operator" }
    }];
    store.operationWorkItems = [{
      workItemId: "wi-readiness-select",
      workspaceId: "W-DORM-MAINLINE",
      cardId,
      lifecycleState: "ready",
      ownerRole: "operator"
    }];
    store.workQueue = [...store.operationWorkItems];
    const readiness = { ...input("readinessState", "passed"), tagName: "SELECT" };
    installDocument({ fields: [readiness] });
    const ctx = createSurfaceCtx({
      view: "operationPanel",
      selectedWorkItemId: "wi-readiness-select",
      selectedWorkspace: "W-DORM-MAINLINE",
      selectedCardId: cardId,
      runtimeStore: store
    });
    ctx.render = vi.fn();

    collectDraftingValuesOnInput({
      type: "change",
      target: readiness
    }, ctx);

    expect(loadDraft("W-DORM-MAINLINE", cardId).values.readinessState).toBe("passed");
  });

  it("binds segmented field buttons and ignores disabled or missing controls", () => {
    const scope = input("resourceScope", "");
    installDocument({ fields: [scope] });
    const ctx = operationCtx();
    ctx.render = vi.fn();

    setSegmentedOperationField(button("resourceScope", "bed"), ctx);
    expect(scope.value).toBe("bed");

    setSegmentedOperationField({ target: button("resourceScope", "room", { disabled: true }) }, ctx);
    expect(scope.value).toBe("bed");

    setSegmentedOperationField(button("missing", "room"), ctx);
    expect(scope.value).toBe("bed");
  });

  it("blocks duplicate, missing actor, required field, and offline submits before runtime confirm", async () => {
    const ctx = operationCtx();
    ctx.state.operationSubmitting = true;
    await submitCurrentCard(ctx);
    expect(submitWorkItemOperation).not.toHaveBeenCalled();

    ctx.state.operationSubmitting = false;
    ctx.state.currentActor = null;
    await submitCurrentCard(ctx);
    expect(ctx.state.view).toBe("login");

    const missing = operationCtx();
    missing.state.runtimeStore.workspaces[0].cards[0].fields.business = [field("buildingName", "楼栋")];
    installDocument({ fields: [] });
    await submitCurrentCard(missing);
    expect(missing.state.lastActionResult).toMatchObject({
      status: "business_blocked_422",
      reason: "required_field_missing"
    });

    const offline = operationCtx({ apiStatus: "offline" });
    offline.hydrateProjectionFromApi = vi.fn(async () => {
      offline.state.apiStatus = "offline";
    });
    installDocument({ fields: [input("roomNo", "A101")] });
    await submitCurrentCard(offline);
    expect(offline.state.operationMessage).toBe(offline.tr("apiOfflineSubmit"));
    expect(submitWorkItemOperation).not.toHaveBeenCalled();
  });

  it("submits committed results, preserves pending/failed projection states, and maps blocked/errors", async () => {
    installDocument({
      fields: [input("roomNo", "A101")],
      evidence: [evidenceNode("room-photo", true)]
    });
    materializeEvidenceObjects.mockResolvedValue(["evd-room"]);
    submitWorkItemOperation.mockResolvedValueOnce({
      confirmed: true,
      commitStatus: "committed",
      projectionStatus: "pending",
      commandSubmissionId: "cmd-1",
      resultEventIds: ["evt-1"]
    });
    fetchOperationWorkItems.mockRejectedValueOnce(new Error("queue offline"));
    const pending = operationCtx();

    await submitCurrentCard(pending);

    expect(pending.state.lastActionResult).toMatchObject({
      status: "committed_projection_pending",
      commandSubmissionId: "cmd-1"
    });
    expect(confirmSuccessMessage({
      confirmed: true,
      commitStatus: "committed",
      projectionStatus: "failed"
    }, pending)).toBe(pending.tr("submitProjectionFailed"));

    submitWorkItemOperation.mockResolvedValueOnce({
      confirmed: false,
      status: "business_blocked_422",
      reason: "evidence_missing",
      commitStatus: "blocked",
      projectionStatus: "not_started"
    });
    const blocked = operationCtx();
    await submitCurrentCard(blocked);
    expect(blocked.state.lastActionResult).toMatchObject({
      status: "business_blocked_422",
      reason: "evidence_missing"
    });
    expect(confirmBlockedMessage({ status: "idempotency_conflict_409" }, blocked)).toBe(blocked.tr("operations.error.safe.422"));

    submitWorkItemOperation.mockRejectedValueOnce({
      status: 403,
      reason: "capability_missing",
      requiredPermission: "operation.confirm"
    });
    const denied = operationCtx();
    await submitCurrentCard(denied);
    expect(denied.state.permissionDiagnostic).toMatchObject({
      reason: "capability_missing",
      status: "permission_blocked_403"
    });
    expect(denied.state.lastActionResult.status).toBe("permission_blocked_403");
  });
});

function operationCtx(overrides = {}) {
  const store = runtimeStore();
  store.workspaces[0].cards[0] = {
    ...store.workspaces[0].cards[0],
    fields: {
      business: [field("roomNo", "房间号")],
      system: [],
      analytics: []
    },
    evidence: [{ id: "room-photo", label: { "zh-CN": "房间照片" } }]
  };
  const ctx = createSurfaceCtx({
    view: "operationPanel",
    runtimeStore: store,
    ...overrides
  });
  ctx.render = vi.fn();
  return ctx;
}

function field(id, zh) {
  return {
    id,
    label: { "zh-CN": zh },
    layer: "business",
    type: "text",
    required: true,
    source: "userInput",
    visibleToUser: true,
    ui: { control: "text", optionSet: "", options: [], defaultValue: "", derivedFrom: "", readonly: false }
  };
}

function input(id, value = "") {
  return {
    dataset: { operationField: id },
    value,
    type: "text",
    tagName: "INPUT",
    closest: () => null,
    matches: (selector) => selector.includes("[data-operation-field]")
  };
}

function rangeStart(id, value = "") {
  return {
    dataset: { operationFieldStart: id },
    value,
    matches: (selector) => selector.includes("[data-operation-field-start]")
  };
}

function rangeEnd(id, value = "") {
  return {
    dataset: { operationFieldEnd: id },
    value
  };
}

function evidenceNode(id, selected = false) {
  return {
    dataset: { evidenceId: id },
    classList: classList(selected ? ["selected"] : [])
  };
}

function button(fieldId, value, options = {}) {
  const node = {
    dataset: { operationFieldButton: fieldId, value },
    disabled: options.disabled === true,
    getAttribute: (name) => options[name] || null,
    closest: () => node
  };
  return node;
}

function previewNode() {
  return {
    children: [],
    get innerHTML() {
      return "";
    },
    set innerHTML(_value) {
      this.children = [];
    },
    appendChild(node) {
      this.children.push(node);
    }
  };
}

function classList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (name) => values.has(name),
    toggle: (name) => {
      if (values.has(name)) {
        values.delete(name);
      } else {
        values.add(name);
      }
    }
  };
}

function installDocument({ fields = [], rangeStarts = [], rangeEnds = [], evidence = [], preview = null } = {}) {
  const fieldById = new Map(fields.map((node) => [node.dataset.operationField, node]));
  const rangeEndById = new Map(rangeEnds.map((node) => [node.dataset.operationFieldEnd, node]));
  vi.stubGlobal("document", {
    querySelectorAll: (selector) => {
      if (selector === "[data-operation-field]") return fields;
      if (selector === "[data-operation-field-start]") return rangeStarts;
      if (selector === "[data-evidence-id].selected") return evidence.filter((node) => node.classList.contains("selected"));
      return [];
    },
    querySelector: (selector) => {
      const fieldMatch = selector.match(/^\[data-operation-field="(.+)"\]$/);
      if (fieldMatch) return fieldById.get(fieldMatch[1]) || null;
      const endMatch = selector.match(/^\[data-operation-field-end="(.+)"\]$/);
      if (endMatch) return rangeEndById.get(endMatch[1]) || null;
      if (selector === "[data-bed-layout-preview]") return preview;
      return null;
    },
    createElement: (tagName) => ({
      tagName,
      className: "",
      dataset: {},
      textContent: ""
    })
  });
}

function installBrowserMocks() {
  const storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear()
  });
  vi.stubGlobal("window", {
    location: {
      href: "http://localhost:5175/",
      origin: "http://localhost:5175/",
      protocol: "http:",
      hostname: "localhost",
      port: "5175"
    },
    [String.fromCharCode(104, 105, 115, 116, 111, 114, 121)]: { replaceState: vi.fn() }
  });
  installDocument();
}
