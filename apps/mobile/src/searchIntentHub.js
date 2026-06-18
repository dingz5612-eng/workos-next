import { resolveOperationPanelTarget } from "./operationRouteResolver.js";
import { operationStatusTranslationKey } from "./operationStatus.js";
import { isAccommodationResourceSetupQuery } from "./searchIntentRegistry.js";
import { DORMITORY_MAINLINE_WORKSPACE_ID, DORMITORY_SCENARIO1_STEPS, MAINLINE_ENTRY_ADMISSION_CONTRACT } from "./capabilityProjection.js";
import { admissionCopy, missingAdmissionState, normalizeAdmissionState } from "./admissionSurface.js";
import { userFacingBusinessText } from "./businessDisplayLanguage.js";

export function buildSearchResultVM(item = {}, ctx = {}) {
  const resultType = item.resultType || item.type || item.kind || "object";
  const workspaceId = item.workspaceId || item.workspace_id || item.id || "";
  const cardId = item.cardId || item.card_id || item._surfaceCardId || "";
  const workItemId = item.workItemId || item.work_item_id || "";
  const evidenceId = item.evidenceId || item.evidence_id || "";
  const traceId = item.traceId || item.commandSubmissionId || item.command_submission_id || item.traceRefs?.[0] || "";
  const learningId = item.learningId || "";
  const caseId = item.caseId || item.case_id || "";
  const commandId = item.commandId || item.command_id || "";
  const templateWorkspaceId = item.templateWorkspaceId || item.template_workspace_id || "";
  const firstCardId = item.firstCardId || item.first_card_id || "";
  const query = item.query || item.searchQuery || item.search_query || safeLocalized(item.localizedTitle ?? item.title, ctx);
  const action = searchActionFor({ ...item, resultType, workspaceId, cardId, workItemId, evidenceId, traceId, learningId, caseId, commandId }, ctx);
  const admission = admissionForSearchItem(item, action);
  const gateResult = gateResultForSearchItem(item, admission);
  const admissionSurface = admissionCopy(admission, ctx, "search");
  const admissionLabel = searchReadonlyOpenLabel(action, admission, admissionSurface);
  const actionLabel = displayBusinessText(admissionActionLabel(action, admission, ctx), ctx);
  const explicitNextAction = displayBusinessText(safeLocalized(item.localizedNextAction ?? item.nextActionLabel ?? item.nextAction, ctx), ctx);
  const entryAdmission = entryAdmissionForSearchItem(item, {
    action,
    actionLabel,
    admission,
    admissionSurface,
    ctx,
    explicitNextAction,
    workspaceId,
    cardId,
    resultType
  });
  return {
    kind: "SearchResultVM",
    resultType,
    title: displayBusinessText(safeLocalized(item.localizedTitle ?? item.businessTitle ?? item.title, ctx), ctx) || titleForType(resultType, ctx),
    subtitle: displayBusinessText(safeLocalized(item.localizedSubtitle ?? item.businessSummary ?? item.subtitle, ctx), ctx) || ctx.tr?.("workosSearchSubtitle") || "",
    statusLabel: displayBusinessText(localizedStatus(item.localizedStatus ?? item.statusLabel ?? item.status ?? item.lifecycleState, ctx), ctx),
    nextActionLabel: genericProcessCopy(explicitNextAction, ctx) ? actionLabel : explicitNextAction || actionLabel,
    actionType: action.type,
    actionLabel,
    businessTitle: entryAdmission.businessTitle,
    businessSummary: entryAdmission.businessSummary,
    legalActions: entryAdmission.legalActions,
    nextAction: entryAdmission.nextAction,
    cannotSubmitReason: entryAdmission.cannotSubmitReason,
    readonlyReason: entryAdmission.readonlyReason,
    sourceScenario: entryAdmission.sourceScenario,
    workItemId,
    workspaceId,
    cardId,
    caseId,
    evidenceId,
    traceId,
    learningId,
    templateWorkspaceId,
    firstCardId,
    query,
    admission,
    gateResult,
    visibleAllowed: admission.visibleAllowed,
    prepareAllowed: admission.prepareAllowed,
    confirmAllowed: admission.confirmAllowed,
    productionAllowed: admission.productionAllowed,
    admissionReason: admission.reason,
    admissionLabel: admissionLabel || admissionSurface.label,
    admissionReasonLabel: admissionSurface.reason,
    admissionLabelKey: admissionSurface.labelKey,
    admissionReasonKey: admissionSurface.reasonKey,
    admissionDecision: entryAdmission.admissionDecision,
    view: action.view,
    reasonIfNoAction: displayBusinessText(action.reason, ctx),
    sourceRefs: sourceRefs(item, { workspaceId, cardId, workItemId, caseId, evidenceId, traceId, learningId })
  };
}

function searchReadonlyOpenLabel(action = {}, admission = {}, admissionSurface = {}) {
  const readonlyOpenActions = new Set(["openObject", "openWorkspace", "startOperationsWorkspace"]);
  if (!readonlyOpenActions.has(action.type)) return "";
  if (admission.visibleAllowed && admission.prepareAllowed && !admission.confirmAllowed) {
    return admissionSurface.reason;
  }
  return "";
}

export function rankSearchResults(items = [], query = "") {
  const normalized = String(query || "").trim().toLocaleLowerCase();
  return [...items]
    .map((item, index) => ({ ...item, _searchRank: rankFor(item, normalized), _searchIndex: index }))
    .filter((item) => !normalized || item._searchRank > 0)
    .sort((a, b) => b._searchRank - a._searchRank || a._searchIndex - b._searchIndex);
}

function searchActionFor(item, ctx) {
  if (item.resultType === "evidence" && item.workspaceId && item.cardId) {
    return { type: "openEvidence", label: ctx.tr?.("searchActionEvidence") || "补充证据", view: "workspace", reason: "" };
  }
  if (item.resultType === "trace" && item.traceId) {
    return { type: "openTrace", label: ctx.tr?.("searchActionTrace") || "查看轨迹", view: "recentTraces", reason: "" };
  }
  if (item.resultType === "learning" && item.learningId) {
    return { type: "openLearning", label: ctx.tr?.("searchActionLearning") || "开始学习", view: "learning", reason: "" };
  }
  if (item.resultType === "operationCase" && item.workspaceId) {
    if (isTerminalStatus(item.status || item.lifecycleState || item.statusLabel)) {
      return { type: "openWorkspace", label: ctx.tr?.("viewOnly") || "查看", view: "workspace", reason: "" };
    }
    return { type: "openWorkspace", label: ctx.tr?.("searchActionViewCase") || "查看案件", view: "workspace", reason: "" };
  }
  if (item.resultType === "command" && item.templateWorkspaceId) {
    return { type: "startOperationsWorkspace", label: safeLocalized(item.nextAction, ctx) || ctx.tr?.("startHandling") || "开始办理", view: "operationPanel", reason: "" };
  }
  if (item.resultType === "mainlineScenario") {
    return { type: "queryOnly", label: ctx.tr?.("searchActionViewWorkItems") || "查看工作项", view: "search", reason: "" };
  }
  if (item.resultType === "workItem" && item.workItemId) {
    const target = resolveOperationPanelTarget(item, ctx.state || {});
    return {
      type: "openWorkItem",
      label: safeLocalized(item.actionLabel, ctx) || ctx.tr?.(target.canOpen ? "searchActionProcess" : "viewOnly") || (target.canOpen ? "处理" : "查看记录"),
      view: "operationPanel",
      reason: ""
    };
  }
  if (["room", "bed", "stay", "object", "workspaceCardCompatibility"].includes(item.resultType) && item.workspaceId) {
    return { type: "openObject", label: ctx.tr?.("searchActionOpenObject") || "打开对象", view: "workspace", reason: "" };
  }
  return {
    type: "noAction",
    label: "",
    view: "",
    reason: ctx.tr?.("searchNoActionReason") || "这条结果暂时没有可跳转目标，请换一个业务词搜索。"
  };
}

function isTerminalStatus(status) {
  return /^(done|confirmed|completed|committed|closed|cancelled|已完成)$/i.test(String(status || "").trim());
}

function titleForType(type, ctx) {
  const keyByType = {
    workItem: "searchWorkItems",
    operationCase: "searchOperationCases",
    workspaceCardCompatibility: "workosSearch",
    gateResult: "workosSearch",
    room: "searchRooms",
    bed: "searchBeds",
    stay: "searchStays",
    evidence: "searchEvidence",
    trace: "searchSubmissionTrace",
    learning: "searchLearning"
  };
  return ctx.tr?.(keyByType[type] || "workosSearch") || "搜索结果";
}

function rankFor(item, query) {
  if (!query) return 1;
  const text = [
    item.resultType,
    item.type,
    item.title,
    item.localizedTitle,
    item.subtitle,
    item.localizedSubtitle,
    item.businessObject,
    item.business_object,
    item.objectLabel,
    item.object_label,
    item.objectName,
    item.object_name,
    item.roomNo,
    item.room_no,
    item.bedNo,
    item.bed_no,
    item.reason,
    item.nextAction,
    item.actionLabel,
    item.businessAnchor,
    item.anchorLabel,
    item.anchor,
    item.scenarioAnchor,
    item.card?.title,
    item.workspace?.title,
    item.workspace?.summary,
    item.workspace?.next,
    item.fieldValues,
    item.field_values,
    item.values
  ].map((value) => safeText(value).toLocaleLowerCase()).join(" ");
  const roomSetupIntent = isAccommodationResourceSetupQuery(query);
  const comparableText = normalizeRoomSearchToken(text);
  const comparableQuery = normalizeRoomSearchToken(query);
  const matched = item._searchKernelMatchedQuery === query
    || text.includes(query)
    || comparableText.includes(comparableQuery)
    || query.split(/\s+/).filter(Boolean).some((part) => text.includes(part))
    || (roomSetupIntent && text.includes("房间"));
  if (!matched) return 0;
  const currentRoomSetupCardId = DORMITORY_SCENARIO1_STEPS[0]?.cardId || "";
  if (roomSetupIntent && (item.templateWorkspaceId === DORMITORY_MAINLINE_WORKSPACE_ID || item.cardId === currentRoomSetupCardId || item.workItemType === currentRoomSetupCardId)) return 100;
  if (roomSetupIntent && text.includes("房间")) return 90;
  if (item.workItemId) return 80;
  if (["room", "bed", "stay"].includes(item.resultType || item.type)) return 70;
  return 40;
}

function sourceRefs(item, ids) {
  return {
    aggregateRef: item.aggregateRef || ids.workItemId || ids.caseId || ids.workspaceId || "",
    workspaceId: ids.workspaceId,
    cardId: ids.cardId,
    workItemId: ids.workItemId,
    caseId: ids.caseId,
    evidenceId: ids.evidenceId,
    traceId: ids.traceId,
    learningId: ids.learningId,
    source: item.sourceRefs?.source || item.source || "",
    sourceType: item.sourceRefs?.sourceType || "",
    projectionAdapter: item.sourceRefs?.projectionAdapter || ""
  };
}

function admissionActionLabel(action = {}, admission = {}, ctx = {}) {
  if (action.type === "openWorkItem") {
    if (!admission.confirmAllowed) return ctx.tr?.("viewOnly") || "查看记录";
    if (!admission.productionAllowed) return ctx.tr?.("searchActionObservation") || "继续填写";
  }
  if (action.type === "startOperationsWorkspace") {
    if (!admission.prepareAllowed) return ctx.tr?.("searchActionLearning") || "开始学习";
    return action.label;
  }
  return action.label;
}

function genericProcessCopy(value, ctx = {}) {
  const text = String(value || "").trim();
  return Boolean(text) && [
    ctx.tr?.("searchActionProcess") || "处理",
    ctx.tr?.("startHandling") || "开始办理",
    "处理",
    "开始办理"
  ].includes(text);
}

function entryAdmissionForSearchItem(item = {}, options = {}) {
  const {
    action = {},
    actionLabel = "",
    admission = {},
    admissionSurface = {},
    ctx = {},
    explicitNextAction = "",
    workspaceId = "",
    cardId = "",
    resultType = ""
  } = options;
  const admissionDecision = item.admissionDecision || item.admission_decision || admissionSurface.decision;
  const cannotSubmitReason = item.cannotSubmitReason || item.cannot_submit_reason || (admission.confirmAllowed ? "" : admission.reason || "");
  const nextAction = displayBusinessText(
    safeLocalized(item.nextAction ?? item.next_action ?? explicitNextAction, ctx),
    ctx) || actionLabel;
  const fallbackReadonlyReason = ctx.tr?.("searchReadonlyReason") || "搜索结果只读，只能跳转合法动作。";
  const entry = {
    businessTitle: displayBusinessText(safeLocalized(item.businessTitle ?? item.business_title ?? item.localizedTitle ?? item.title, ctx), ctx) || titleForType(resultType, ctx),
    businessSummary: displayBusinessText(safeLocalized(item.businessSummary ?? item.business_summary ?? item.localizedSubtitle ?? item.subtitle ?? item.summary, ctx), ctx) || "",
    legalActions: normalizeEntryLegalActions(item.legalActions || item.legal_actions, {
      action,
      actionLabel,
      admission,
      admissionDecision,
      cannotSubmitReason,
      ctx
    }),
    admissionDecision,
    nextAction,
    cannotSubmitReason,
    readonlyReason: displayBusinessText(safeLocalized(item.readonlyReason ?? item.readonly_reason, ctx), ctx) || fallbackReadonlyReason,
    sourceScenario: item.sourceScenario || item.source_scenario || sourceScenarioFallback(workspaceId, cardId, resultType)
  };
  for (const field of MAINLINE_ENTRY_ADMISSION_CONTRACT.requiredFields || []) {
    if (field === "legalActions" && !entry.legalActions.length) {
      entry.legalActions = normalizeEntryLegalActions([], { action, actionLabel, admission, admissionDecision, cannotSubmitReason, ctx });
    } else if (entry[field] === undefined || entry[field] === null) {
      entry[field] = "";
    }
  }
  return entry;
}

function normalizeEntryLegalActions(actions = [], options = {}) {
  if (Array.isArray(actions) && actions.length) {
    return actions.map((entry) => ({
      action: entry.action || "",
      label: displayBusinessText(safeLocalized(entry.label, options.ctx), options.ctx),
      view: entry.view || "",
      allowed: entry.allowed === true,
      writeBusinessFact: entry.writeBusinessFact === true || entry.write_business_fact === true,
      admissionDecision: entry.admissionDecision || entry.admission_decision || options.admissionDecision || "",
      cannotSubmitReason: entry.cannotSubmitReason || entry.cannot_submit_reason || ""
    }));
  }
  if (!options.action?.type || options.action.type === "noAction") {
    return [{
      action: "readonly",
      label: options.ctx?.tr?.("viewOnly") || "查看",
      view: "",
      allowed: false,
      writeBusinessFact: false,
      admissionDecision: options.admissionDecision || "",
      cannotSubmitReason: options.cannotSubmitReason || ""
    }];
  }
  return [{
    action: options.action.type,
    label: options.actionLabel,
    view: options.action.view || "",
    allowed: Boolean(options.admission?.visibleAllowed && options.admission?.prepareAllowed),
    writeBusinessFact: false,
    admissionDecision: options.admissionDecision || "",
    cannotSubmitReason: options.cannotSubmitReason || ""
  }];
}

function sourceScenarioFallback(workspaceId = "", cardId = "", resultType = "") {
  const text = `${workspaceId} ${cardId} ${resultType}`;
  if (/resourceOperationStatus|operation-status|operation/i.test(text)) return "lodging.resource-operation-status";
  if (/W-DORM-MAINLINE|cert\.roomSetup|cert\.bedSetup|cert\.resourceReadiness|resource-basic-readiness/i.test(text)) return "lodging.resource-basic-readiness";
  return "lodging.unknown-entry";
}

function admissionForSearchItem(item = {}, action = {}) {
  if (item.admission) return action.type === "startOperationsWorkspace"
    ? startCommandAdmission(normalizeAdmissionState(item.admission))
    : normalizeAdmissionState(item.admission);
  if (["openWorkItem", "startOperationsWorkspace"].includes(action.type)) {
    return missingAdmissionState("contract_preview");
  }
  return missingAdmissionState("contract_preview");
}

function startCommandAdmission(admission = {}) {
  if (!admission.visibleAllowed) return admission;
  return {
    ...admission,
    prepareAllowed: true,
    confirmAllowed: false,
    productionAllowed: false,
    mode: admission.mode || "internal_pilot_observation",
    reason: admission.reason || "search_readonly_runtime_start"
  };
}

function gateResultForSearchItem(item = {}, admission = {}) {
  const source = item.gateResult || {};
  return {
    status: source.status || (admission.visibleAllowed ? "visible_readonly" : "hidden"),
    source: source.source || "SearchKernelService",
    sourceType: source.sourceType || item.sourceRefs?.sourceType || "",
    checkedAt: source.checkedAt || "",
    policyVersion: source.policyVersion || "oam.search-permission-policy.v1",
    admissionDecisionRef: source.admissionDecisionRef || "",
    writeThroughSearchAllowed: source.writeThroughSearchAllowed === true ? true : false,
    writeBusinessFactAllowed: source.writeBusinessFactAllowed === true ? true : false
  };
}

function safeLocalized(value, ctx) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => safeLocalized(entry, ctx)).filter(Boolean).join(" · ");
  if (ctx.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || value.title || value.label || "";
}

function displayBusinessText(value = "", ctx = {}) {
  return userFacingBusinessText(value, ctx);
}

function localizedStatus(value, ctx) {
  const raw = safeLocalized(value, ctx);
  if (!raw) return ctx.tr?.("ready") || "可办理";
  const key = statusTranslationKey(raw);
  const translated = ctx.tr?.(key);
  return translated && translated !== key ? translated : raw;
}

function statusTranslationKey(raw) {
  const lifecycleKey = operationStatusTranslationKey(raw);
  if (lifecycleKey && lifecycleKey !== raw) return lifecycleKey;
  const keyByStatus = {
    ready: "ready",
    done: "done",
    confirmed: "confirmed",
    completed: "completed",
    inProgress: "inProgress",
    notStarted: "notStarted",
    blocked: "blocked",
    evidence: "learnStatusEvidence",
    rejection: "learnStatusBlocked",
    device: "learnStatusDevice",
    permission: "learnStatusPermission",
    finance: "learnStatusFinance",
    role: "learnStatusRole"
  };
  return keyByStatus[String(raw || "").trim()] || raw;
}

function safeText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(safeText).join(" ");
  return Object.values(value).map(safeText).join(" ");
}

function normalizeRoomSearchToken(value = "") {
  return String(value || "")
    .replace(/([0-9０-９]+)\s*号\s*房间/g, "$1房间")
    .replace(/\s+/g, " ");
}
