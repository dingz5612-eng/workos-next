import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../apiClient.js", () => ({
  attachEvidence: vi.fn(),
  confirmOperationWorkItem: vi.fn(),
  createEvidenceDraft: vi.fn(),
  fetchAccommodationLens: vi.fn(),
  fetchOperationWorkItems: vi.fn(),
  fetchSearchResults: vi.fn(),
  prepareOperationWorkItem: vi.fn(),
  recordMobileClientEvent: vi.fn(),
  startOperationsWorkspace: vi.fn(),
  waitForProjectionEvents: vi.fn()
}));

import {
  attachEvidence,
  confirmOperationWorkItem,
  createEvidenceDraft,
  fetchAccommodationLens,
  fetchOperationWorkItems,
  fetchSearchResults,
  prepareOperationWorkItem,
  recordMobileClientEvent,
  startOperationsWorkspace,
  waitForProjectionEvents
} from "../apiClient.js";
import {
  materializeEvidenceObjects,
  submitWorkItemOperation
} from "../operationRuntime.js";
import { validateRequiredFields } from "../operationValidation.js";
import { evaluateSurfaceAccess } from "../surfaceGuard.js";
import {
  arrayPayload,
  normalizeOperationWorkItemsPayload,
  operationCaseContextPayloads,
  selectedOperationWorkItem,
  workItemCardId,
  workItemIdOf,
  workItemWorkspaceId
} from "../operationCaseContext.js";
import {
  createFeedbackMessage,
  feedbackContextFromState,
  feedbackRecipientLabelKey,
  feedbackStorageKey,
  feedbackTopicLabelKey,
  loadFeedbackMessages,
  saveFeedbackMessage,
  updateFeedbackMessage
} from "../feedbackMessages.js";
import {
  countBadge,
  countDomain,
  queueTasks,
  todayFocusCounts,
  todayFocusItems
} from "../selectors/queueSelectors.js";
import { simpleView } from "../views/simpleView.js";
import { openReadonlyWorkspaceRecord, openWorkspace, runSearch, setView, startOperationsWorkspaceCommand } from "../navigationController.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  installStorage();
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
});

describe("Mobile Branch Risk Kernel operation runtime matrix", () => {
  it("blocks confirm when no persisted WorkItem exists", async () => {
    const result = await submitWorkItemOperation({
      workspace: { id: "W-STAY-RESOURCE" },
      card: { id: "roomSetup" },
      actor: { token: "operator-token" },
      fieldValues: {},
      evidenceIds: []
    });

    expect(result).toMatchObject({
      confirmed: false,
      status: "business_blocked_422",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      reason: "persisted_work_item_required"
    });
    expect(prepareOperationWorkItem).not.toHaveBeenCalled();
    expect(confirmOperationWorkItem).not.toHaveBeenCalled();
  });

  it("keeps committed projection pending separate from read-side sync failures", async () => {
    vi.useFakeTimers();
    prepareOperationWorkItem.mockResolvedValue({});
    confirmOperationWorkItem.mockResolvedValue({
      confirmed: true,
      commitStatus: "committed",
      projectionStatus: "pending",
      commandSubmissionId: "cmd-1",
      resultEventIds: ["evt-1"]
    });
    waitForProjectionEvents.mockRejectedValue(new Error("projection lag"));
    fetchAccommodationLens.mockRejectedValue(new Error("lens lag"));
    fetchOperationWorkItems.mockRejectedValue(new Error("queue lag"));
    const synced = vi.fn();

    const result = await submitWorkItemOperation({
      workspace: { id: "W-STAY-RESOURCE", runtimeWorkItemId: "wi-room-1" },
      card: { id: "roomSetup" },
      actor: { token: "operator-token" },
      fieldValues: { roomId: "R-1" },
      evidenceIds: ["evd-1"],
      submissionProtocol: {
        idempotencyKey: "idem-1",
        submissionId: "sub-1",
        cardInstanceId: "ci-1",
        aggregateRef: "roomId:R-1"
      },
      onReadSideSynced: synced
    });

    expect(result.readSideSyncStatus).toBe("scheduled");
    await vi.runAllTimersAsync();
    expect(synced).toHaveBeenCalledWith({
      commandSubmissionId: "cmd-1",
      projectionStatus: "pending",
      lensStatus: "failed",
      workItemsStatus: "failed"
    });
    vi.useRealTimers();
  });

  it("materializes only evidence drafts with runtime requirements", async () => {
    createEvidenceDraft.mockResolvedValue({ evidenceId: "evd-created" });
    attachEvidence.mockResolvedValue({ evidenceId: "evd-attached" });

    const result = await materializeEvidenceObjects({
      workspace: { id: "W-STAY-RESOURCE" },
      card: { id: "roomSetup" },
      actor: { token: "operator-token" },
      submissionProtocol: { submissionId: "sub-1", cardInstanceId: "ci-1" },
      evidenceDrafts: [
        { requirementId: "room-photo", evidenceId: "local-1", sizeBytes: 12 },
        { status: "draft-without-requirement" }
      ]
    });

    expect(result).toEqual(["evd-attached"]);
    expect(createEvidenceDraft).toHaveBeenCalledTimes(1);
    expect(attachEvidence).toHaveBeenCalledTimes(1);
  });
});

describe("Mobile Branch Risk Kernel validation and boundary matrix", () => {
  it("blocks required missing fields and bed label cardinality errors", () => {
    const ctx = { state: { lang: "zh-CN" }, tr: (key) => key };
    const card = {
      id: "bedSetup",
      fields: {
        business: [
          { id: "bedCount", required: true, label: { "zh-CN": "床位数" } },
          { id: "bedLabels", required: true, label: { "zh-CN": "床位标签" } },
          { id: "bedStatus", required: true, label: { "zh-CN": "床位状态" } }
        ]
      }
    };

    const result = validateRequiredFields(card, { bedCount: "2", bedLabels: "A" }, ctx);

    expect(result.displayLabels.join(" ")).toContain("床位标签");
    expect(result.displayLabels.join(" ")).toContain("bedLabelsMustMatchBedCount");
    expect(result.displayLabels.join(" ")).not.toContain("床位状态");
  });

  it("keeps device, role, capability, production, and pilot blockers distinct", () => {
    expect(evaluateSurfaceAccess("workspace", {
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "untrusted" }
    }).reason).toBe("device_not_trusted");

    expect(evaluateSurfaceAccess("pcGovernance", {
      currentActor: { role: "admin", capabilities: ["admin.audit"] },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" }
    }).reason).toBe("pc_surface_requires_pc_device");

    expect(evaluateSurfaceAccess("releaseControl", {
      currentActor: { role: "operator", capabilities: ["release.flight_deck.view"] },
      currentDevice: { surface: "release", deviceTrustStatus: "trusted" }
    }).reason).toBe("role_surface_not_allowed");

    expect(evaluateSurfaceAccess("workspace", {
      selectedWorkspace: "W-PARTS-REQUEST",
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" },
      businessLineAdmission: { parts: { surfaceMode: "l0.contract.preview", productionAllowed: true } }
    }).reason).toBe("business_line_admission_blocked");

    expect(evaluateSurfaceAccess("workspace", {
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" },
      pilotScope: { status: "blocked" }
    }).reason).toBe("pilot_scope_blocked");
  });
});

describe("Mobile Branch Risk Kernel context, auth, and navigation matrix", () => {
  it("normalizes WorkItem payload aliases and selects the active runtime item", () => {
    const state = {
      selectedWorkItemId: "wi-active",
      runtimeStore: {
        operationWorkItems: [{
          work_item_id: "wi-active",
          workspace_id: "W-STAY-RESOURCE",
          card_id: "roomSetup",
          Payload: { roomId: "R-1" }
        }],
        workQueue: [{ workItemId: "wi-queue", workspaceId: "W-STAY-RESOURCE", cardId: "bedSetup" }]
      },
      lastActionResult: { workspaceId: "W-STAY-RESOURCE", fieldValues: { depositId: "D-1" } }
    };

    expect(normalizeOperationWorkItemsPayload({ operationWorkItems: [1] })).toEqual([1]);
    expect(normalizeOperationWorkItemsPayload({ workItems: [2] })).toEqual([2]);
    expect(normalizeOperationWorkItemsPayload({ items: [3] })).toEqual([3]);
    expect(arrayPayload({})).toEqual([]);
    expect(selectedOperationWorkItem(state, { id: "W-STAY-RESOURCE" }, { id: "roomSetup" })?.work_item_id).toBe("wi-active");
    expect(operationCaseContextPayloads(state, { id: "W-STAY-RESOURCE" }, { id: "roomSetup" })).toEqual(
      expect.arrayContaining([{ roomId: "R-1" }, { depositId: "D-1" }])
    );
    expect(workItemIdOf({ work_item_id: "wi-active" })).toBe("wi-active");
    expect(workItemWorkspaceId({ workspace: { id: "W-1" } })).toBe("W-1");
    expect(workItemCardId({ Payload: { cardId: "c-1" } })).toBe("c-1");
  });

  it("routes missing actor, missing WorkItem, readonly record, and denied PC route safely", () => {
    const noActor = createSurfaceCtx({ currentActor: null });
    setView("workspace", noActor);
    expect(noActor.state.view).toBe("login");

    const missingWorkItem = createSurfaceCtx();
    missingWorkItem.state.runtimeStore.operationWorkItems = [];
    missingWorkItem.state.runtimeStore.workQueue = [];
    const target = openWorkspace("W-STAY-RESOURCE", missingWorkItem, "roomSetup");
    expect(target.canOpen).toBe(false);
    expect(missingWorkItem.state.view).toBe("operationPanel");
    expect(missingWorkItem.state.operationRouteIssue.reason).toBe("missing_persisted_work_item");

    const readonly = createSurfaceCtx();
    readonly.state.runtimeStore.operationWorkItems = [];
    readonly.state.runtimeStore.workspaces[0].cards[0].status = "confirmed";
    openReadonlyWorkspaceRecord("W-STAY-RESOURCE", "roomSetup", readonly);
    expect(readonly.state.view).toBe("workspace");

    const denied = createSurfaceCtx({ currentActor: { role: "operator" } });
    setView("pcGovernance", denied);
    expect(denied.state.view).toBe("permissionDiagnostic");
  });

  it("keeps Search read side and workspace start blockers safe", async () => {
    const searchCtx = createSurfaceCtx({ query: "房间" });
    fetchSearchResults.mockResolvedValue([{
      resultType: "workItem",
      workItemId: "wi-search",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      status: "ready",
      summary: { "zh-CN": "只读搜索命中" }
    }]);
    recordMobileClientEvent.mockRejectedValue(new Error("analytics offline"));

    await runSearch(searchCtx, "房间");

    expect(searchCtx.state.view).toBe("search");
    expect(searchCtx.state.runtimeStore.operationWorkItems.some((item) => item.workItemId === "wi-search")).toBe(true);

    const startCtx = createSurfaceCtx();
    startOperationsWorkspace.mockRejectedValue({ status: 403, reason: "capability_missing" });
    await startOperationsWorkspaceCommand(startCtx, "W-STAY-RESOURCE", "roomSetup");
    expect(startCtx.state.view).toBe("permissionDiagnostic");
    expect(startCtx.state.lastActionResult.status).toBe("permission_blocked_403");

    startOperationsWorkspace.mockRejectedValueOnce({ status: 422, reason: "workspace_start_blocked" });
    await startOperationsWorkspaceCommand(startCtx, "W-STAY-RESOURCE", "roomSetup");
    expect(startCtx.state.lastActionResult.status).toBe("business_blocked_422");
  });
});

describe("Mobile Branch Risk Kernel queue, feedback, and simple view matrix", () => {
  it("classifies queue branches for finance wait, syncing, risk, due, and scenario filters", () => {
    const state = {
      currentActor: { role: "manager" },
      todayFilter: "waiting-finance",
      sort: "riskSort",
      queueFilters: { domain: "all", badge: "all", status: "all", ownerRole: "all", evidenceState: "all", transferable: "all", riskLevel: "all", due: "all", scenario: "checkout" },
      runtimeStore: {
        workspaces: [],
        workQueue: [
          { workItemId: "wi-finance", ownerRole: "finance", lifecycleState: "ready", badges: ["finance"], reason: "押金待确认", priority: 1, domain: "finance" },
          { workItemId: "wi-sync", ownerRole: "operator", lifecycleState: "committed_projection_pending", badges: ["just-submitted"], priority: 2, domain: "stay" },
          { workItemId: "wi-risk", ownerRole: "operator", lifecycleState: "blocked", riskLevel: "P0", badges: ["blocked"], priority: 3, domain: "stay" },
          { workItemId: "wi-checkout", ownerRole: "operator", lifecycleState: "ready", workItemType: "Dorm.Checkout", dueAtUtc: "2099-01-01T00:00:00Z", priority: 4, domain: "stay" }
        ]
      }
    };

    expect(todayFocusCounts(state)).toMatchObject({ waitingFinance: 1, syncing: 1, risk: 1 });
    expect(todayFocusItems(state).map((item) => item.workItemId)).toEqual(["wi-finance"]);
    expect(queueTasks(state).map((item) => item.workItemId)).toEqual(["wi-checkout"]);
    expect(countDomain(state, "all")).toBe(4);
    expect(countBadge(state, "blocked")).toBe(1);
  });

  it("keeps feedback storage resilient to corrupt data and caps saved messages", () => {
    localStorage.setItem(feedbackStorageKey({ actorId: "actor-1" }), "{broken");
    expect(loadFeedbackMessages({ actorId: "actor-1" })).toEqual([]);
    expect(feedbackRecipientLabelKey("missing")).toBe("feedbackRecipientProductDesign");
    expect(feedbackTopicLabelKey("missing")).toBe("feedbackTopicExperience");
    expect(feedbackContextFromState({ view: "workspace", currentDevice: null }).deviceSurface).toBe("mobile");

    for (let index = 0; index < 25; index += 1) {
      saveFeedbackMessage({
        messageId: `fb-${index}`,
        body: `message ${index}`,
        createdAt: new Date(index).toISOString()
      }, { actorId: "actor-1" });
    }
    expect(loadFeedbackMessages({ actorId: "actor-1" })).toHaveLength(20);
    expect(updateFeedbackMessage("missing", { status: "sent" }, { actorId: "actor-1" })).toBeNull();

    const created = createFeedbackMessage({ recipientId: "businessOwner", targetAccount: "  ", body: "  需要补充安全文案  " }, { view: "search" });
    expect(created.recipientAccount).toBe("business.owner");
    expect(created.body).toBe("需要补充安全文案");
  });

  it("renders support views for failed sync, device trust, drafts, and evidence library without technical labels", () => {
    const ctx = createSurfaceCtx({
      view: "failedSync",
      lastActionResult: { status: "network_unknown", message: "网络失败，请稍后查看提交记录" }
    });
    expect(visibleText(simpleView("failedSyncItems", "failedSyncBody", ctx))).toContain("网络失败");

    ctx.state.view = "deviceTrust";
    ctx.state.currentDevice = { deviceTrustStatus: "unknown" };
    expect(visibleText(simpleView("deviceTrust", "deviceTrustStatusBody", ctx))).toContain("设备状态待确认");

    localStorage.setItem("workosnext.operationDraft.W-STAY-RESOURCE.roomSetup", JSON.stringify({
      savedAt: "2026-06-07T00:00:00Z",
      evidenceDrafts: [{ fileName: "room-photo.txt", status: "draft" }]
    }));
    ctx.state.view = "drafts";
    expect(visibleText(simpleView("drafts", "draftsBody", ctx))).toContain("本地草稿");
    ctx.state.view = "evidenceLibrary";
    expect(visibleText(simpleView("evidenceLibrary", "evidenceLibraryBody", ctx))).toContain("room-photo.txt");
  });
});

function installStorage() {
  const storage = new Map();
  vi.stubGlobal("localStorage", {
    get length() {
      return storage.size;
    },
    key: (index) => Array.from(storage.keys())[index] || null,
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  });
  return storage;
}
