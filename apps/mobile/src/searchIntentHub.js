import { resolveOperationPanelTarget } from "./operationRouteResolver.js";

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
  return {
    kind: "SearchResultVM",
    resultType,
    title: safeLocalized(item.localizedTitle ?? item.title, ctx) || titleForType(resultType, ctx),
    subtitle: safeLocalized(item.localizedSubtitle ?? item.subtitle, ctx) || ctx.tr?.("workosSearchSubtitle") || "",
    statusLabel: localizedStatus(item.localizedStatus ?? item.statusLabel ?? item.status ?? item.lifecycleState, ctx),
    nextActionLabel: safeLocalized(item.localizedNextAction ?? item.nextActionLabel ?? item.nextAction, ctx) || action.label,
    actionType: action.type,
    actionLabel: action.label,
    workItemId,
    workspaceId,
    cardId,
    caseId,
    evidenceId,
    traceId,
    learningId,
    templateWorkspaceId,
    firstCardId,
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
  if (item.resultType === "command" && (item.commandId === "startResourceSetup" || item.templateWorkspaceId)) {
    return { type: "startWorkspace", label: ctx.tr?.("startHandling") || "开始办理", view: "workspace", reason: "" };
  }
  if (item.resultType === "workItem" && item.workItemId && resolveOperationPanelTarget(item, ctx.state || {}).canOpen) {
    return { type: "openWorkItem", label: safeLocalized(item.actionLabel, ctx) || ctx.tr?.("searchActionProcess") || "处理", view: "operationPanel", reason: "" };
  }
  if (["room", "bed", "stay", "object"].includes(item.resultType) && item.workspaceId) {
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
  const matched = text.includes(query)
    || query.split(/\s+/).filter(Boolean).some((part) => text.includes(part))
    || (/创建房间|房间/.test(query) && text.includes("房间"));
  if (!matched) return 0;
  if (/创建房间/.test(query) && (item.workItemId || item.cardId === "roomSetup")) return 100;
  if (/创建房间|房间/.test(query) && text.includes("房间")) return 90;
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
    learningId: ids.learningId
  };
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
  return ctx.tr?.(raw) || raw;
}

function safeText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(safeText).join(" ");
  return Object.values(value).map(safeText).join(" ");
}
