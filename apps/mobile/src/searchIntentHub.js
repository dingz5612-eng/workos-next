import { resolveOperationPanelTarget } from "./operationRouteResolver.js";
import { operationStatusTranslationKey } from "./operationStatus.js";
import { isAccommodationResourceSetupQuery } from "./searchIntentRegistry.js";
import { admissionCopy, normalizeAdmissionState } from "./admissionSurface.js";

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
  const action = searchActionFor({ ...item, resultType, workspaceId, cardId, workItemId, evidenceId, traceId, learningId, caseId, commandId }, ctx);
  const admission = admissionForSearchItem(item, action);
  const admissionSurface = admissionCopy(admission, ctx, "search");
  const actionLabel = admissionActionLabel(action, admission, ctx);
  const explicitNextAction = safeLocalized(item.localizedNextAction ?? item.nextActionLabel ?? item.nextAction, ctx);
  return {
    kind: "SearchResultVM",
    resultType,
    title: safeLocalized(item.localizedTitle ?? item.title, ctx) || titleForType(resultType, ctx),
    subtitle: safeLocalized(item.localizedSubtitle ?? item.subtitle, ctx) || ctx.tr?.("workosSearchSubtitle") || "",
    statusLabel: localizedStatus(item.localizedStatus ?? item.statusLabel ?? item.status ?? item.lifecycleState, ctx),
    nextActionLabel: genericProcessCopy(explicitNextAction, ctx) ? actionLabel : explicitNextAction || actionLabel,
    actionType: action.type,
    actionLabel,
    workItemId,
    workspaceId,
    cardId,
    caseId,
    evidenceId,
    traceId,
    learningId,
    templateWorkspaceId,
    firstCardId,
    admission,
    visibleAllowed: admission.visibleAllowed,
    prepareAllowed: admission.prepareAllowed,
    confirmAllowed: admission.confirmAllowed,
    productionAllowed: admission.productionAllowed,
    admissionReason: admission.reason,
    admissionLabel: admissionSurface.label,
    admissionReasonLabel: admissionSurface.reason,
    admissionLabelKey: admissionSurface.labelKey,
    admissionReasonKey: admissionSurface.reasonKey,
    admissionDecision: admissionSurface.decision,
    view: action.view,
    reasonIfNoAction: action.reason,
    sourceRefs: sourceRefs(item, { workspaceId, cardId, workItemId, caseId, evidenceId, traceId, learningId })
  };
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
    return { type: "startOperationsWorkspace", label: ctx.tr?.("startHandling") || "开始办理", view: "operationPanel", reason: "" };
  }
  if (item.resultType === "workItem" && item.workItemId && resolveOperationPanelTarget(item, ctx.state || {}).canOpen) {
    return { type: "openWorkItem", label: safeLocalized(item.actionLabel, ctx) || ctx.tr?.("searchActionProcess") || "处理", view: "operationPanel", reason: "" };
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
    item.workItemType,
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
    item.objectId,
    item.object_id,
    item.roomNo,
    item.room_no,
    item.roomId,
    item.room_id,
    item.bedNo,
    item.bed_no,
    item.stayId,
    item.stay_id,
    item.aggregateRef,
    item.aggregate_ref,
    item.reason,
    item.nextAction,
    item.actionLabel,
    item.businessAnchor,
    item.anchorLabel,
    item.anchor,
    item.scenarioAnchor,
    item.workspaceId,
    item.cardId,
    item.caseId,
    item.evidenceId,
    item.traceId,
    item.card?.id,
    item.card?.title,
    item.card?.status,
    item.workspace?.id,
    item.workspace?.title,
    item.workspace?.summary,
    item.workspace?.next,
    item.fieldValues,
    item.field_values,
    item.values,
    item.payload,
    item.draft
  ].map((value) => safeText(value).toLocaleLowerCase()).join(" ");
  const roomSetupIntent = isAccommodationResourceSetupQuery(query);
  const matched = text.includes(query)
    || query.split(/\s+/).filter(Boolean).some((part) => text.includes(part))
    || (roomSetupIntent && text.includes("房间"));
  if (!matched) return 0;
  if (roomSetupIntent && (item.templateWorkspaceId === "W-STAY-RESOURCE" || item.workItemId || item.cardId === "roomSetup")) return 100;
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
    if (!admission.productionAllowed) return ctx.tr?.("searchActionObservation") || "继续观察记录";
  }
  if (action.type === "startOperationsWorkspace") {
    if (!admission.confirmAllowed) return ctx.tr?.("searchActionLearning") || "开始学习";
    if (!admission.productionAllowed) return ctx.tr?.("startObservation") || "开始观察记录";
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

function admissionForSearchItem(item = {}, action = {}) {
  if (item.admission) return normalizeAdmissionState(item.admission);
  if (["openWorkItem", "startOperationsWorkspace"].includes(action.type)) {
    return normalizeAdmissionState({
      visibleAllowed: true,
      prepareAllowed: true,
      confirmAllowed: true,
      productionAllowed: false,
      mode: "internal_pilot_observation",
      reason: "business_production_blocked"
    });
  }
  return normalizeAdmissionState({
    visibleAllowed: true,
    prepareAllowed: false,
    confirmAllowed: false,
    productionAllowed: false,
    mode: "contract_preview",
    reason: "visible_only"
  });
}

function safeLocalized(value, ctx) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => safeLocalized(entry, ctx)).filter(Boolean).join(" · ");
  if (ctx.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || value.title || value.label || "";
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
