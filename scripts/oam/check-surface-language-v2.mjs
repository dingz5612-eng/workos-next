import fs from "node:fs";
import path from "node:path";
import { i18n } from "../../apps/mobile/src/i18n.js";
import { routeView } from "../../apps/mobile/src/appRouter.js";
import { shell } from "../../apps/mobile/src/appShell.js";
import { buildSearchResultVM } from "../../apps/mobile/src/searchIntentHub.js";
import { evaluateSurfaceAccess } from "../../apps/mobile/src/surfaceGuard.js";

const root = process.cwd();
const artifactPath = "artifacts/oam/checks/surface-language-v2-result.json";
const languages = ["zh-CN", "ru-RU", "ky-KG"];
const violations = [];

const source = {
  admissionSurface: read("apps/mobile/src/admissionSurface.js"),
  surfaceGuard: read("apps/mobile/src/surfaceGuard.js"),
  searchIntentHub: read("apps/mobile/src/searchIntentHub.js"),
  appRouter: read("apps/mobile/src/appRouter.js"),
  pcGovernanceView: read("apps/mobile/src/views/pcGovernanceView.js"),
  mobilePcTest: read("apps/mobile/src/__tests__/MobilePcSurfaceBoundary.test.js"),
  searchTest: read("apps/mobile/src/__tests__/SearchIntentHubContract.test.js")
};

const rendered = renderOrdinaryMobile();
checkOrdinaryVisibleCopy();
checkLanguageKeys();
checkStructuredAdmission();
checkPcGovernanceBoundary();
checkSearchGateResult();
checkStageTests();

writeArtifact();
if (violations.length) {
  for (const item of violations) console.error(`${item.severity} ${item.id}: ${item.message}`);
  throw new Error("surface language v2 check failed.");
}

console.log("Surface language v2 check: PASS");

function checkOrdinaryVisibleCopy() {
  const visible = visibleText(Object.values(rendered).join("\n"));
  for (const token of [
    "DomainEvent",
    "LedgerEntry",
    "ProcessManager",
    "Lens",
    "slice",
    "Projection",
    "Outbox",
    "Unit of Work",
    "Confirm Runtime",
    "admissionDecisionRef",
    "blockedAdapter",
    "definitionId",
    "payloadHash",
    "commandSubmissionId"
  ]) {
    if (visible.includes(token)) {
      violations.push(v("surface_language.internal_term_visible", `普通移动端可见文案不得出现 ${token}。`, { token }));
    }
  }
  for (const group of [
    { label: "办理", alternatives: ["办理", "工作"] },
    { label: "业务状态", alternatives: ["业务状态", "准入状态", "当前状态"] },
    { label: "失败原因", alternatives: ["失败原因", "不能访问", "不能确认", "未通过检查", "请补充"] },
    { label: "可继续操作", alternatives: ["可继续操作", "继续", "下一步动作"] }
  ]) {
    if (!group.alternatives.some((item) => visible.includes(item))) {
      violations.push(v("surface_language.business_copy_missing", `普通移动端缺少业务表达：${group.label}。`, { label: group.label }));
    }
  }
}

function checkLanguageKeys() {
  const requiredKeys = [
    "surface.permission.title",
    "surface.permission.reason.actorSessionRequired",
    "surface.permission.reason.roleSurfaceNotAllowed",
    "surface.permission.reason.capabilityMissing",
    "surface.permission.reason.deviceNotTrusted",
    "surface.permission.reason.pcSurfaceRequiresPcDevice",
    "surface.permission.reason.releaseSurfaceRestricted",
    "surface.permission.reason.businessAdmissionBlocked",
    "surface.permission.reason.pilotScopeBlocked",
    "surface.permission.nextStep.contactOwner",
    "surface.permission.nextStep.switchAllowedSurface",
    "surface.permission.owner.releaseOwner",
    "surface.permission.owner.admin",
    "surface.permission.owner.finance",
    "surface.permission.owner.manager",
    "surface.permission.owner.operator",
    "surface.kind.workItem",
    "surface.kind.truthRecord",
    "surface.kind.summary",
    "surface.kind.receipt",
    "surface.kind.blocker",
    "surface.kind.readonlyRecord",
    "explain.visibleNotConfirm",
    "explain.summaryNotConfirm",
    "explain.receiptNotProduction",
    "explain.businessBasisNotFinancialTruth",
    "explain.managementReadonly",
    "explain.financeTruthRequired",
    "truth.owner.sharedGovernance",
    "truth.owner.financeTruth",
    "truth.owner.moneyKernel",
    "truth.owner.projectionKernel",
    "truth.owner.accommodation",
    "truth.owner.identity",
    "truth.owner.maintenance",
    "operations.admission.visibleOnly",
    "operations.admission.visibleDenied",
    "operations.admission.prepareOnly",
    "operations.admission.confirmDenied",
    "operations.admission.productionBlocked",
    "operations.admission.internalPilotObservation",
    "operations.admission.contractPreview",
    "operations.admission.confirmAllowed",
    "operations.admission.confirmAllowedHelp",
    "operations.error.safe.400",
    "operations.error.safe.403",
    "operations.error.safe.409",
    "operations.error.safe.422",
    "operations.error.safe.generic",
    "search.admission.visibleOnly",
    "search.admission.visibleDenied",
    "search.admission.prepareOnly",
    "search.admission.confirmDenied",
    "search.admission.productionBlocked",
    "search.admission.internalPilotObservation",
    "search.admission.contractPreview",
    "search.admission.confirmAllowed",
    "search.admission.confirmAllowedHelp",
    "permission.reason.actor_session_required",
    "permission.reason.role_surface_not_allowed",
    "permission.reason.capability_missing",
    "permission.reason.device_not_trusted",
    "permission.reason.pc_surface_requires_pc_device",
    "permission.reason.business_line_admission_blocked",
    "permission.next.contactOwner",
    "permission.next.switchAllowedSurface",
    "permission.next.businessAdmission"
  ];

  for (const language of languages) {
    for (const key of requiredKeys) {
      const copy = i18n[language]?.[key];
      if (typeof copy !== "string" || copy.trim().length === 0 || copy === key) {
        violations.push(v("surface_language.copy_key_missing", `${language} 缺少语言键 ${key}。`, { language, key }));
      }
    }
  }
}

function checkStructuredAdmission() {
  for (const fragment of [
    "/L0|",
    "/contract_preview|L0",
    "/internal_pilot_observation|L1",
    "/production/i.test",
    "/L0|Contract Preview/i"
  ]) {
    if (source.admissionSurface.includes(fragment) || source.surfaceGuard.includes(fragment)) {
      violations.push(v("surface_language.text_mode_branch", `移动端准入不得使用展示文本分支：${fragment}。`, { fragment }));
    }
  }
  for (const token of ["normalizeStructuredToken", "normalizeAdmissionMode", "productionAllowed", "confirmAllowed"]) {
    if (!source.admissionSurface.includes(token)) {
      violations.push(v("surface_language.admission_structure_missing", `admissionSurface 缺少结构化字段处理：${token}。`, { token }));
    }
  }
  for (const token of ["surfaceMode", "productionAllowed", "productionConfirmAllowed", "normalizeSurfaceMode"]) {
    if (!source.surfaceGuard.includes(token)) {
      violations.push(v("surface_language.surface_guard_structure_missing", `surfaceGuard 缺少结构化准入字段：${token}。`, { token }));
    }
  }

  const allowedPreview = evaluateSurfaceAccess("workspace", {
    currentActor: { role: "operator", capabilities: [] },
    currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" },
    selectedWorkspace: "repair-current-admission-line",
    businessLineAdmission: {
      repair: { surfaceMode: "contract-preview", productionAllowed: false, productionConfirmAllowed: false }
    }
  });
  const blockedPreview = evaluateSurfaceAccess("workspace", {
    currentActor: { role: "operator", capabilities: [] },
    currentDevice: { deviceTrustStatus: "trusted", surface: "mobile" },
    selectedWorkspace: "repair-current-admission-line",
    businessLineAdmission: {
      repair: { surfaceMode: "contract-preview", productionAllowed: true, productionConfirmAllowed: false }
    }
  });
  if (!allowedPreview.allowed || blockedPreview.allowed || blockedPreview.reason !== "business_line_admission_blocked") {
    violations.push(v("surface_language.structured_preview_decision", "业务线准入必须由 surfaceMode、productionAllowed 和 productionConfirmAllowed 结构化字段决定。"));
  }
}

function checkPcGovernanceBoundary() {
  for (const token of ["routePcSurface", "isPcSurfaceView"]) {
    if (!source.appRouter.includes(token)) {
      violations.push(v("surface_language.pc_route_boundary_missing", `appRouter 缺少 PC 分流：${token}。`, { token }));
    }
  }
  if (!source.pcGovernanceView.includes("data-pc-governance-full") || !source.pcGovernanceView.includes("PC 治理控制平面")) {
    violations.push(v("surface_language.pc_governance_mark_missing", "PC 治理面必须带治理面标记和治理标题。"));
  }
  const visible = visibleText(Object.values(rendered).join("\n"));
  for (const token of ["PC 治理控制平面", "GateResult 明细", "Production Observability", "Governance navigation"]) {
    if (visible.includes(token)) {
      violations.push(v("surface_language.pc_term_leaked_to_mobile", `PC 治理术语不得出现在普通移动端：${token}。`, { token }));
    }
  }
}

function checkSearchGateResult() {
  const vm = buildSearchResultVM({
    resultId: "operations:evt:wi",
    resultType: "workItem",
    workItemId: "wi-search",
    workspaceId: "W-STAY-RESOURCE",
    cardId: "roomSetup",
    admission: {
      visibleAllowed: true,
      prepareAllowed: true,
      confirmAllowed: false,
      productionAllowed: false,
      mode: "internal_pilot_observation",
      reason: "business_production_blocked",
      admissionDecisionRef: "admission:search:v2"
    },
    gateResult: {
      status: "visible_readonly",
      source: "SearchKernelService",
      sourceType: "operationsDomainEvent",
      checkedAt: "2026-06-06T00:00:00.0000000Z",
      policyVersion: "oam.search-permission-policy.v1",
      admissionDecisionRef: "admission:search:v2",
      writeThroughSearchAllowed: false,
      writeBusinessFactAllowed: false
    },
    sourceRefs: { source: "SearchKernelService", sourceType: "operationsDomainEvent" }
  }, ctxFor("search"));

  if (vm.gateResult?.writeThroughSearchAllowed !== false || vm.gateResult?.writeBusinessFactAllowed !== false) {
    violations.push(v("surface_language.search_gate_write_flag", "SearchResultVM 必须保留禁止经搜索写入的 gateResult 标记。"));
  }
  for (const token of ["gateResultForSearchItem", "writeThroughSearchAllowed", "writeBusinessFactAllowed"]) {
    if (!source.searchIntentHub.includes(token)) {
      violations.push(v("surface_language.search_gate_adapter_missing", `searchIntentHub 缺少 ${token}。`, { token }));
    }
  }
}

function checkStageTests() {
  for (const marker of ["uses structured admission fields", "does not use admission mode display text"]) {
    if (!source.mobilePcTest.includes(marker)) {
      violations.push(v("surface_language.selector_test_missing", `移动端 selector/surface 测试缺少：${marker}。`, { marker }));
    }
  }
  for (const marker of ["gateResult", "writeBusinessFactAllowed", "writeThroughSearchAllowed"]) {
    if (!source.searchTest.includes(marker)) {
      violations.push(v("surface_language.search_test_missing", `Search 视图模型测试缺少：${marker}。`, { marker }));
    }
  }
}

function renderOrdinaryMobile() {
  return {
    ...Object.fromEntries(["home", "workbench", "search", "me", "operationPanel"].map((view) => [view, routeView(ctxFor(view))])),
    permissionDenied: routeView(ctxFor("releaseControl"))
  };
}

function ctxFor(view) {
  const state = {
    view,
    lang: "zh-CN",
    apiStatus: "online",
    query: view === "search" ? "住宿" : "",
    queueDomain: "all",
    queueBadge: "mine",
    selectedWorkItemId: "W-STAY-RESOURCE:roomSetup",
    selectedWorkspace: "W-STAY-RESOURCE",
    selectedCardId: "roomSetup",
    currentActor: { role: "operator", displayName: "内测经办人", capabilities: [] },
    currentDevice: { deviceId: "mobile-current", deviceTrustStatus: "trusted", surface: "mobile" },
    pcGovernance: { currentDevice: { deviceId: "pc-current", deviceTrustStatus: "unknown", surface: "pc" } },
    runtimeStore: runtimeStore()
  };
  const ctx = {
    state,
    shell: (content) => shell(content, ctx),
    tr: (key) => escape(i18n[state.lang]?.[key] || key),
    tx: (value) => escape(typeof value === "string" ? value : value?.[state.lang] || value?.["zh-CN"] || ""),
    localTerm: (value) => escape(value?.label?.[state.lang] || value?.label?.["zh-CN"] || value?.id || value),
    escapeHtml: escape,
    escapeAttr: escape,
    metric: (value, label) => `<article><span>${escape(i18n[state.lang]?.[label] || label)}</span><strong>${escape(value)}</strong></article>`,
    render: () => {}
  };
  return ctx;
}

function runtimeStore() {
  return {
    currentState: { businessProductionState: "BLOCKED" },
    businessLineAdmission: {
      dormitory: { mode: "internal_pilot_observation", productionAllowed: false, productionConfirmAllowed: false },
      repair: { surfaceMode: "contract-preview", productionAllowed: false, productionConfirmAllowed: false }
    },
    workspaces: [{
      id: "W-STAY-RESOURCE",
      domain: "stay",
      caseId: "case:W-STAY-RESOURCE",
      title: { "zh-CN": "住宿资源" },
      summary: { "zh-CN": "房间床位配置" },
      next: { "zh-CN": "可继续操作：先配置房间和床位" },
      blockers: [],
      cards: [{
        id: "roomSetup",
        status: "ready",
        title: { "zh-CN": "房间配置" },
        fields: { business: [], system: [], analytics: [] },
        evidence: [{ id: "room-duplicate-check", label: { "zh-CN": "房间重复校验" } }],
        blockerRules: [],
        confirmation: { required: true, requiredRole: "operator" },
        admission: {
          visibleAllowed: true,
          prepareAllowed: true,
          confirmAllowed: true,
          productionAllowed: false,
          mode: "internal_pilot_observation",
          reason: "business_production_blocked"
        }
      }]
    }],
    workQueue: [{
      queueItemId: "q-room",
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      badges: ["mine", "ready"],
      reason: "业务状态：可继续操作"
    }],
    operationWorkItems: [{
      workItemId: "W-STAY-RESOURCE:roomSetup",
      workspaceId: "W-STAY-RESOURCE",
      cardId: "roomSetup",
      caseId: "case:W-STAY-RESOURCE",
      workItemType: "Dorm.RoomSetup",
      lifecycleState: "ready",
      ownerRole: "operator",
      reason: "失败原因：暂无阻断"
    }],
    searchResultsByQuery: {}
  };
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeArtifact() {
  const fullPath = path.join(root, artifactPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify({
    generatedAtUtc: new Date().toISOString(),
    generatedBy: "scripts/oam/check-surface-language-v2.mjs",
    status: violations.length ? "failed" : "passed",
    checkedLanguages: languages,
    checkedViews: Object.keys(rendered),
    productionAllowed: false,
    writeThroughSearchAllowed: false,
    violations
  }, null, 2)}\n`, "utf8");
}

function visibleText(value) {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function escape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function v(id, message, extra = {}) {
  return { severity: "P0", id, message, ...extra };
}
