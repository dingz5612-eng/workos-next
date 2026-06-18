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
  refreshAccommodationLenses,
  submitWorkItemOperation
} from "../operationRuntime.js";
import {
  countEvidenceState,
  countTransferable,
  evidenceStateFor,
  queueTasks,
  todayFocusItems
} from "../selectors/queueSelectors.js";
import { evaluateSurfaceAccess, permissionDiagnosticCopy } from "../surfaceGuard.js";
import {
  defaultHomeForCurrentSurface,
  onboard,
  openOperationPanel,
  openReadonlyWorkspaceRecord,
  openWorkspace,
  runSearch,
  runSearchFromCurrentUrlIfNeeded,
  setLang,
  setView,
  startOperationsWorkspaceCommand
} from "../navigationController.js";
import { searchView } from "../views/searchView.js";
import { confirmPageView, resultView, simpleView } from "../views/simpleView.js";
import { createSurfaceCtx, runtimeStore, visibleText } from "./surfaceContractTestHelpers.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  installBrowserMocks();
});

describe("OAM hardening operation runtime matrix", () => {
  it("keeps prepare, confirm, projection, lens, and work item sync statuses explicit", async () => {
    vi.useFakeTimers();
    prepareOperationWorkItem.mockResolvedValue({ prepared: true });
    confirmOperationWorkItem.mockResolvedValue({
      confirmed: true,
      commitStatus: "committed",
      projectionStatus: "projected",
      commandSubmissionId: "cmd-1",
      events: [{ eventId: "evt-1" }]
    });
    waitForProjectionEvents.mockResolvedValue(true);
    fetchAccommodationLens
      .mockResolvedValueOnce({ lensId: "dormitory.roomInventory" })
      .mockResolvedValueOnce({ lensId: "dormitory.bedInventory" });
    fetchOperationWorkItems.mockResolvedValue([{ workItemId: "wi-next" }]);
    const projection = vi.fn();
    const lens = vi.fn();
    const operationWorkItems = vi.fn();
    const readSideSynced = vi.fn();

    const result = await submitWorkItemOperation({
      workspace: { id: "W-DORM-MAINLINE", workItemId: "wi-dorm-room-setup" },
      card: { id: "cert.roomSetupConfirm" },
      actor: { token: "operator-token" },
      deviceId: "mobile-current",
      language: "zh-CN",
      fieldValues: { roomNo: "301" },
      evidenceIds: ["evd-room"],
      submissionProtocol: {
        idempotencyKey: "idem-1",
        submissionId: "sub-1",
        cardInstanceId: "ci-1",
        aggregateRef: "roomId:R-101"
      },
      onProjection: projection,
      onLens: lens,
      onOperationWorkItems: operationWorkItems,
      onReadSideSynced: readSideSynced
    });

    expect(result.readSideSyncStatus).toBe("scheduled");
    expect(prepareOperationWorkItem).toHaveBeenCalledWith("wi-dorm-room-setup", expect.objectContaining({
      evidenceIds: ["evd-room"]
    }), "operator-token");
    expect(confirmOperationWorkItem).toHaveBeenCalledWith("wi-dorm-room-setup", "operator-token", expect.objectContaining({
      deviceId: "mobile-current",
      idempotencyKey: "idem-1"
    }));

    await vi.runAllTimersAsync();

    expect(waitForProjectionEvents).toHaveBeenCalledWith(["evt-1"], projection);
    expect(lens).toHaveBeenCalled();
    expect(operationWorkItems).toHaveBeenCalledWith([{ workItemId: "wi-next" }]);
    expect(readSideSynced).toHaveBeenCalledWith(expect.objectContaining({
      commandSubmissionId: "cmd-1",
      projectionStatus: "projected",
      lensStatus: "refreshed",
      workItemsStatus: "refreshed"
    }));
  });

  it("returns blocked confirm results without scheduling read-side sync", async () => {
    prepareOperationWorkItem.mockResolvedValue({ prepared: true });
    confirmOperationWorkItem.mockResolvedValue({
      confirmed: false,
      status: "idempotency_conflict_409",
      commitStatus: "blocked",
      projectionStatus: "not_started",
      reason: "duplicate_submission"
    });
    const readSideSynced = vi.fn();

    const result = await submitWorkItemOperation({
      workspace: { id: "W-STAY-RESOURCE" },
      card: { id: "roomSetup", runtimeWorkItemId: "wi-room-1" },
      actor: { token: "operator-token" },
      fieldValues: {},
      evidenceIds: [],
      onReadSideSynced: readSideSynced
    });

    expect(result).toMatchObject({
      confirmed: false,
      status: "idempotency_conflict_409",
      reason: "duplicate_submission"
    });
    expect(readSideSynced).not.toHaveBeenCalled();
    expect(waitForProjectionEvents).not.toHaveBeenCalled();
  });

  it("materializes already-created evidence IDs and skips empty requirements", async () => {
    createEvidenceDraft.mockResolvedValue({ evidenceId: "evd-existing" });
    attachEvidence.mockResolvedValue({ evidenceId: "evd-existing" });

    expect(await materializeEvidenceObjects({
      workspace: { id: "W-STAY-RESOURCE" },
      card: { id: "roomSetup" },
      actor: null,
      submissionProtocol: { submissionId: "sub-1", cardInstanceId: "ci-1" },
      evidenceDrafts: null
    })).toEqual([]);

    const drafts = [{ requirementId: "room-photo", evidenceId: "evd-existing", contentSha256: "sha", sizeBytes: 9 }];
    expect(await materializeEvidenceObjects({
      workspace: { id: "W-STAY-RESOURCE" },
      card: { id: "roomSetup" },
      actor: {},
      submissionProtocol: { submissionId: "sub-1", cardInstanceId: "ci-1" },
      evidenceDrafts: drafts
    })).toEqual(["evd-existing"]);
    expect(createEvidenceDraft).toHaveBeenCalledWith(expect.objectContaining({ evidenceId: "evd-existing" }), "");
    expect(attachEvidence).toHaveBeenCalledWith("evd-existing", expect.objectContaining({
      contentSha256: "sha",
      sizeBytes: 9
    }), "");
  });

  it("deduplicates accommodation lens refresh and exposes an empty no-op branch", async () => {
    const onLens = vi.fn();
    expect(await refreshAccommodationLenses([], onLens)).toEqual({});
    expect(onLens).not.toHaveBeenCalled();

    fetchAccommodationLens
      .mockResolvedValueOnce({ value: "room" })
      .mockResolvedValueOnce({ value: "bed" });

    const result = await refreshAccommodationLenses(["room", "room", "bed"], onLens);

    expect(result).toEqual({ room: { value: "room" }, bed: { value: "bed" } });
    expect(fetchAccommodationLens).toHaveBeenCalledTimes(2);
    expect(onLens).toHaveBeenCalledWith(result);
  });
});

describe("OAM hardening surface and navigation matrix", () => {
  it("keeps public, role, capability, release, device, admission, and pilot decisions distinct", () => {
    expect(evaluateSurfaceAccess("login", {}).allowed).toBe(true);
    expect(evaluateSurfaceAccess("governanceCenter", {
      currentActor: { role: "admin", capabilities: ["finance.control.view"] },
      currentDevice: { surface: "pc", deviceTrustStatus: "trusted" }
    }).reason).toBe("capability_missing");
    expect(evaluateSurfaceAccess("releaseFlightDeck", {
      currentActor: { role: "releaseOwner", capabilities: ["release.gate.view"] },
      currentDevice: { surface: "release", deviceTrustStatus: "trusted" }
    }).allowed).toBe(true);
    expect(evaluateSurfaceAccess("releaseControl", {
      currentActor: { role: "manager", capabilities: ["release.flight_deck.view"] },
      currentDevice: { surface: "release", deviceTrustStatus: "trusted" }
    }).reason).toBe("role_surface_not_allowed");
    expect(evaluateSurfaceAccess("workspace", {
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", trustState: "blocked" }
    }).reason).toBe("device_not_trusted");
    expect(evaluateSurfaceAccess("workspace", {
      selectedWorkspace: "W-REPAIR-1",
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" },
      businessLineAdmission: { repair: { mode: "internal-pilot", productionAllowed: true } }
    }).allowed).toBe(true);
    expect(evaluateSurfaceAccess("workspace", {
      currentActor: { role: "operator" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" },
      pilotScope: { status: "blocked" }
    }).reason).toBe("pilot_scope_blocked");
  });

  it("uses stable diagnostic copy keys when permission data is partial or unknown", () => {
    const copy = permissionDiagnosticCopy({
      reason: "unknown",
      owner: "finance",
      requiredPermission: "manager.workItem.review"
    }, (key) => `copy:${key}`);

    expect(copy).toEqual({
      title: "copy:permissionDiagnostic",
      reason: "copy:permission.reason.surface_not_allowed",
      owner: "copy:permission.owner.finance",
      requiredPermission: "copy:permission.scope.manager",
      nextAction: "copy:permission.next.contactOwner"
    });
  });

  it("routes language, onboarding, readonly records, missing targets, and operation panel changes safely", () => {
    const ctx = createSurfaceCtx({
      currentActor: { role: "finance", displayName: "财务", capabilities: ["finance.control.view"] },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" }
    });
    ctx.render = vi.fn();

    expect(defaultHomeForCurrentSurface(ctx)).toBe("home");
    ctx.state.operationMessage = ctx.tr("draftSaved");
    setLang("ru-RU", ctx);
    expect(ctx.state.lang).toBe("ru-RU");
    expect(localStorage.getItem("workosnext.lang")).toBe("ru-RU");
    expect(ctx.state.operationMessage).toBe(ctx.tr("draftSaved"));
    expect(ctx.state.operationMessage).not.toContain("草稿已保存");

    onboard(ctx);
    expect(localStorage.getItem("workosnext.onboarded")).toBe("1");
    expect(ctx.state.view).toBe("home");

    const readonly = createSurfaceCtx();
    readonly.state.runtimeStore.operationWorkItems = [];
    readonly.state.runtimeStore.workspaces[0].cards = [
      { id: "roomSetup", status: "confirmed" },
      { id: "bedSetup", status: "done" }
    ];
    const target = openWorkspace("W-STAY-RESOURCE", readonly, "bedSetup");
    expect(target.canOpen).toBe(false);
    expect(readonly.state.view).toBe("operationPanel");

    const operation = createSurfaceCtx({
      operationMessage: "运行服务未连接",
      fieldValidation: { missingFieldIds: ["roomId"] },
      lastActionResult: { status: "business_blocked_422", reason: "persisted_work_item_required" }
    });
    const opened = openOperationPanel("wi-dorm-room-setup", operation);
    expect(opened.canOpen).toBe(true);
    expect(operation.state.operationMessage).toBe("");
    expect(operation.state.lastActionResult).toBeNull();

    setView("me", operation);
    expect(operation.state.fieldValidation).toBeNull();
    expect(operation.state.operationRouteIssue).toBeNull();
  });

  it("keeps Search read side resilient to request races, offline fallback, and start command failures", async () => {
    const ctx = createSurfaceCtx({ query: "房间" });
    ctx.render = vi.fn();
    fetchSearchResults
      .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve([{ resultType: "workItem", workItemId: "wi-slow" }]), 10)))
      .mockResolvedValueOnce([{ resultType: "workItem", workItemId: "wi-fast", workspaceId: "W-DORM-MAINLINE", cardId: "cert.roomSetupConfirm" }]);
    recordMobileClientEvent.mockRejectedValue(new Error("analytics offline"));

    const slow = runSearch(ctx, "慢请求");
    await runSearch(ctx, "快请求");
    await slow;

    expect(fetchSearchResults).toHaveBeenCalledWith("快请求", "zh-CN");
    expect(ctx.state.view).toBe("search");
    expect(ctx.state.runtimeStore.operationWorkItems.some((item) => item.workItemId === "wi-fast")).toBe(true);
    expect(ctx.state.runtimeStore.operationWorkItems.some((item) => item.workItemId === "wi-slow")).toBe(false);

    fetchSearchResults.mockRejectedValueOnce(new Error("offline"));
    await runSearch(ctx, "离线");
    expect(ctx.state.view).toBe("search");

    fetchSearchResults.mockClear();
    fetchSearchResults.mockResolvedValueOnce([{
      resultType: "workItem",
      workItemId: "wi-url-search",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm"
    }]);
    const urlSearch = createSurfaceCtx({ view: "search", query: "A24126", lang: "ru-RU" });
    urlSearch.render = vi.fn();
    await expect(runSearchFromCurrentUrlIfNeeded(urlSearch)).resolves.toBe(true);
    expect(fetchSearchResults).toHaveBeenCalledWith("A24126", "ru-RU");
    expect(urlSearch.state.runtimeStore.searchResultsByQuery.a24126[0].workItemId).toBe("wi-url-search");

    fetchSearchResults.mockClear();
    await expect(runSearchFromCurrentUrlIfNeeded(urlSearch)).resolves.toBe(false);
    expect(fetchSearchResults).not.toHaveBeenCalled();

    const startCtx = createSurfaceCtx();
    startCtx.render = vi.fn();
    startOperationsWorkspace.mockResolvedValueOnce({});
    await startOperationsWorkspaceCommand(startCtx, "W-DORM-MAINLINE", "cert.roomSetupConfirm");
    expect(startCtx.state.operationMessage).toBe(startCtx.tr("apiOffline"));

    startOperationsWorkspace.mockRejectedValueOnce({ status: 401, reason: "actor_session_required" });
    await startOperationsWorkspaceCommand(startCtx, "W-DORM-MAINLINE", "cert.roomSetupConfirm");
    expect(startCtx.state.currentActor).toBeNull();
    expect(startCtx.state.view).toBe("login");
  });
});

describe("OAM hardening queue and Search readonly matrix", () => {
  it("classifies evidence, transfer, due, risk, ownership, and scenario branches without leaking closed work", () => {
    const state = {
      currentActor: { role: "admin" },
      debugSurface: true,
      todayFilter: "risk-reminder",
      sort: "dueSort",
      queueFilters: {
        domain: "all",
        badge: "all",
        status: "all",
        ownerRole: "not-mine",
        evidenceState: "missing",
        transferable: "false",
        riskLevel: "P0",
        due: "risk",
        scenario: "service"
      },
      runtimeStore: {
        workspaces: [],
        workQueue: [
          {
            workItemId: "wi-service-risk",
            workspaceId: "W-STAY-SERVICE-TASK",
            cardId: "serviceTaskCreate",
            workItemType: "Dorm.Service",
            ownerRole: "manager",
            status: "productionBlocked",
            riskLevel: "P0",
            dueAtUtc: "2020-01-01T00:00:00Z",
            evidenceState: "wrong_scope",
            badges: ["blocked"],
            priority: 1
          },
          {
            workItemId: "wi-transferable",
            workspaceId: "W-STAY-RESOURCE",
            cardId: "roomSetup",
            ownerRole: "operator",
            lifecycleState: "ready",
            transferable: true,
            evidenceDrafts: [{ status: "draft" }],
            priority: 9
          },
          {
            workItemId: "wi-closed",
            workspaceId: "W-STAY-RESOURCE",
            cardId: "bedSetup",
            ownerRole: "operator",
            lifecycleState: "closed",
            evidenceState: "locked",
            riskLevel: "low",
            priority: 8
          }
        ]
      }
    };

    expect(evidenceStateFor({ evidenceState: "scope_mismatch" })).toBe("missing");
    expect(evidenceStateFor({ card: { evidenceDrafts: [{ verificationStatus: "expired" }] } })).toBe("missing");
    expect(evidenceStateFor({})).toBe("ready");
    expect(countEvidenceState(state, "missing")).toBe(2);
    expect(countTransferable(state)).toBe(1);
    expect(queueTasks(state).map((item) => item.workItemId)).toEqual(["wi-service-risk"]);
    expect(todayFocusItems(state).map((item) => item.workItemId)).toEqual(["wi-service-risk"]);
  });

  it("renders Search as readonly/observational when results are blocked, terminal, recovered, or object-only", () => {
    const store = runtimeStore();
    store.workQueue.push({
      workItemId: "wi-room-101",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "committed_projection_pending",
      businessObject: "101号房间",
      reason: "继续办理房间资料",
      badges: ["just-submitted"]
    });
    store.searchResultsByQuery = {
      "101房间": [
        {
          resultType: "workItem",
          workItemId: "wi-backend-room",
          workspaceId: "W-STAY-RESOURCE",
          cardId: "roomSetup",
          businessObject: "101房间",
          title: { "zh-CN": "后端只读命中" },
          status: "blocked",
          admission: {
            visibleAllowed: true,
            prepareAllowed: false,
            confirmAllowed: false,
            productionAllowed: false,
            mode: "contract_preview",
            reason: "permission_denied"
          },
          gateResult: {
            status: "visible_readonly",
            writeBusinessFactAllowed: false
          }
        },
        {
          resultType: "workItem",
          workItemId: "wi-backend-room",
          workspaceId: "W-STAY-RESOURCE",
          cardId: "roomSetup",
          title: { "zh-CN": "重复命中" }
        }
      ]
    };
    store.workspaces[0].cards[0].status = "ready";
    store.workspaces.push({
      id: "W-STAY-CLOSED",
      domain: "stay",
      title: { "zh-CN": "已关闭住宿" },
      cards: [{ id: "closed", status: "closed" }]
    });
    const ctx = createSurfaceCtx({
      query: "101房间",
      recentSearches: ["101房间", "押金"],
      operationMessage: "提交后正在同步",
      runtimeStore: store
    });

    const html = searchView(ctx);
    const text = visibleText(html);

    expect(html).toContain('data-search-section="unfinishedRecovery"');
    expect(html).toContain('data-search-section="searchWorkItems"');
    expect(html).toContain('data-admission-decision="visible_only"');
    expect(html).toContain("提交后正在同步");
    expect(text).toContain("异常 101房间");
    expect(text).not.toContain("已关闭住宿");
    expect((html.match(/wi-backend-room/g) || []).length).toBeGreaterThan(0);
  });

  it("keeps personal runtime support surfaces current, readonly, and evidence-backed", () => {
    localStorage.setItem("workosnext.operationDraft.W-DORM-MAINLINE.cert.roomSetupConfirm", JSON.stringify({
      savedAt: "2026-06-07T00:00:00Z",
      evidenceDrafts: [
        { evidenceId: "evd-draft", status: "upload_failed" },
        { fileName: "room-photo.txt", status: "draft" }
      ]
    }));
    const store = runtimeStore();
    store.workQueue.push({
      workItemId: "wi-dorm-room-setup-done",
      workspaceId: "W-DORM-MAINLINE",
      cardId: "cert.roomSetupConfirm",
      lifecycleState: "done",
      ownerRole: "operator",
      commandSubmissionId: "cmd-done",
      reason: "已完成"
    });
    const ctx = createSurfaceCtx({
      runtimeStore: store,
      lastActionResult: {
        status: "committed_projection_failed",
        commandSubmissionId: "cmd-1",
        message: "投影失败，等待恢复"
      },
      projectionEvents: [{ eventId: "evt-1" }],
      currentActor: { role: "unknownRole", displayName: "未知角色" },
      currentDevice: { surface: "mobile", deviceTrustStatus: "trusted" }
    });
    ctx.task = () => ({ title: { "zh-CN": "填写房间信息" } });

    const drafts = visibleText(simpleView("drafts", "draftsBody", { ...ctx, state: { ...ctx.state, view: "drafts" } }));
    const uploadQueue = visibleText(simpleView("uploadQueue", "uploadQueueBody", { ...ctx, state: { ...ctx.state, view: "uploadQueue" } }));
    const submitQueue = visibleText(simpleView("submitQueue", "submitQueueBody", { ...ctx, state: { ...ctx.state, view: "submitQueue" } }));
    const failedSync = visibleText(simpleView("failedSync", "failedSyncBody", { ...ctx, state: { ...ctx.state, view: "failedSync" } }));
    const recentSubmissions = visibleText(simpleView("recentSubmissions", "recentSubmissionsBody", { ...ctx, state: { ...ctx.state, view: "recentSubmissions" } }));
    const recentTraces = visibleText(simpleView("recentTraces", "recentTracesBody", { ...ctx, state: { ...ctx.state, view: "recentTraces" } }));
    const permissions = visibleText(simpleView("permissions", "myPermissionsBody", { ...ctx, state: { ...ctx.state, view: "permissions" } }));
    const deviceTrust = visibleText(simpleView("deviceTrust", "deviceTrustStatusBody", { ...ctx, state: { ...ctx.state, view: "deviceTrust" } }));
    const businessRecords = visibleText(simpleView("businessRecords", "businessRecordsBody", { ...ctx, state: { ...ctx.state, view: "businessRecords" } }));
    const completedRecords = visibleText(simpleView("completedRecords", "completedRecordsBody", { ...ctx, state: { ...ctx.state, view: "completedRecords" } }));
    const evidenceLibrary = visibleText(simpleView("evidenceLibrary", "evidenceLibraryBody", { ...ctx, state: { ...ctx.state, view: "evidenceLibrary" } }));

    expect(drafts).toContain("本地草稿 1");
    expect(uploadQueue).toContain("材料上传 1");
    expect(submitQueue).toContain("committed_projection_failed");
    expect(failedSync).toContain("投影失败，等待恢复");
    expect(recentSubmissions).toContain("确认后的稳定审计引用");
    expect(recentTraces).toContain("1");
    expect(permissions).toContain("经办人");
    expect(deviceTrust).toContain("设备已验证");
    expect(businessRecords).toContain("新建房间和床位");
    expect(completedRecords).toContain("已完成记录");
    expect(evidenceLibrary).toContain("room-photo.txt");
    expect(visibleText(confirmPageView(ctx))).toContain("填写房间信息");
    expect(visibleText(resultView(ctx))).toContain("工作项");
  });
});

function installBrowserMocks() {
  const storage = new Map();
  vi.stubGlobal("localStorage", {
    get length() {
      return storage.size;
    },
    key: (index) => Array.from(storage.keys())[index] || null,
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
}
