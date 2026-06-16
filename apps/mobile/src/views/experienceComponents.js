import { capacityForRoomType, defaultValueForField } from "../controls/fieldControls.js";
import { loadCompletedRecordSnapshot, loadDraft } from "../operationDrafts.js";
import {
  bedLayoutPreviewValue,
  canonicalTaskFieldId,
  isLowValueTaskField,
  preferredTaskFieldIds,
  syntheticTaskField,
  taskDisplayLabel,
  taskDisplayValue,
  taskFieldForId,
  taskValueByFieldId
} from "../operationFieldKernel.js";
import { normalizeOperationLifecycleState } from "../operationStatus.js";
import { resolveOperationPanelTarget, resolvePersistedWorkItem } from "../operationRouteResolver.js";
import { evidenceStateFor } from "../selectors/queueSelectors.js";
import { isActionableCardStatus, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { permissionDiagnosticCopy } from "../surfaceGuard.js";
import { buildBusinessAnchor, businessAnchorFieldsHtml, businessAnchorHtml } from "../businessAnchorKernel.js";
import { isBedSetupCardId } from "../capabilityProjection.js";
import { stepContextContract } from "../systemContextContract.js";
import {
  DeviceTrustVM,
  OperationPanelVM,
  QueueStateVM,
  TrustedConfirmVM,
  WorkItemDecisionVM
} from "../viewModels/index.js";

export function BusinessSummaryHeader(summary = {}, ctx, options = {}) {
  const stateAttr = summary.state ? ` data-queue-state="${attr(summary.state, ctx)}"` : "";
  const state = summary.stateLabel
    ? `<span class="business-summary-state${summary.stateClass ? ` ${attr(summary.stateClass, ctx)}` : ""}"${stateAttr}>${text(summary.stateLabel, ctx)}</span>`
    : "";
  const title = summary.title ? `<strong class="business-summary-title">${text(summary.title, ctx)}</strong>` : "";
  const subtitle = summary.subtitle ? `<span class="business-summary-subtitle">${text(summary.subtitle, ctx)}</span>` : "";
  const source = summary.source || summary.item || {};
  const anchor = options.hideAnchor
    ? ""
    : businessAnchorFieldsHtml(source, ctx, { compact: true }) || businessAnchorHtml(source, ctx, { compact: true });
  const detail = summary.detail ? `<p class="business-summary-detail">${text(summary.detail, ctx)}</p>` : "";
  const classes = ["business-summary-header", options.compact ? "compact" : ""].filter(Boolean).join(" ");
  return `<div class="${classes}" data-surface="business-summary-header">
    <div class="business-summary-heading">
      ${state}
      ${title}
      ${subtitle}
    </div>
    ${anchor ? `<div class="business-summary-anchor-panel">${anchor}</div>` : ""}
    ${detail}
  </div>`;
}

export function WorkItemCard(item, ctx) {
  const model = workItemModel(item, ctx);
  const taskBody = BusinessTaskBody(model, ctx, { item });
  const hasOverview = taskBody.includes('data-surface="business-task-overview"');
  const canHandle = model.canHandleLabel;
  const route = resolveOperationPanelTarget({
    workItemId: model.workItemId,
    workspaceId: model.workspaceId,
    cardId: model.cardId
  }, ctx.state);
  const workspaceButton = route.canOpen
    ? `<button data-work-item-id="${attr(route.workItem.workItemId, ctx)}" data-workspace-id="${attr(route.workItem.workspaceId, ctx)}" data-card-id="${attr(route.workItem.cardId, ctx)}">${text(ctx.tr("openWorkspace"), ctx)}</button>`
    : `<div class="workitem-route-blocked"><b>${text(ctx.tr("operationUnavailableCta"), ctx)}</b><small>${text(ctx.tr("operationUnavailableBody"), ctx)}</small><button data-view="workbench">${text(ctx.tr("returnWorkbench"), ctx)}</button></div>`;
  const debug = ctx.state?.debugSurface ? `<details class="debug-only"><summary>${text(ctx.tr("debugTrace"), ctx)}</summary><dl>
      ${field("workItemId", model.workItemId, ctx)}
      ${field("caseId", model.caseId, ctx)}
      ${field("traceRefs", model.traceRefs.join(" · ") || "-", ctx)}
    </dl></details>` : "";

  return `<article class="workitem-card action-decision-card risk-${attr(model.riskLevel, ctx)}" data-surface="action-decision-card">
    <div class="workitem-card-head">
      ${BusinessSummaryHeader({
        stateLabel: canHandle,
        state: model.canHandle ? "ready" : "blocked",
        title: model.displayTitle,
        subtitle: model.workItemType,
        source: { ...item, workspace: item.workspace || item, card: item.card || model.card }
      }, ctx, { compact: true, hideAnchor: shouldHideHeaderAnchor({ ...item, workspace: item.workspace || item, card: item.card || model.card }, ctx, hasOverview) })}
    </div>
    ${taskBody}
    <div class="business-summary-actions">${workspaceButton}</div>
    ${debug}
  </article>`;
}

export function WorkItemSummaryCard(item, ctx) {
  const model = workItemModel(item, ctx);
  const taskBody = BusinessTaskBody(model, ctx, { item });
  const hasOverview = taskBody.includes('data-surface="business-task-overview"');
  const route = resolveOperationPanelTarget({
    workItemId: model.workItemId,
    workspaceId: model.workspaceId,
    cardId: model.cardId
  }, ctx.state);
  const action = route.canOpen
    ? `<button data-work-item-id="${attr(route.workItem.workItemId, ctx)}" data-workspace-id="${attr(route.workItem.workspaceId, ctx)}" data-card-id="${attr(route.workItem.cardId, ctx)}">${text(ctx.tr("startHandling"), ctx)}</button>`
    : `<button data-view="workbench">${text(ctx.tr("returnWorkbench"), ctx)}</button>`;

  return `<article class="today-workitem-summary" data-surface="today-workitem-summary">
    ${BusinessSummaryHeader({
      stateLabel: model.canHandleLabel,
      state: model.canHandle ? "ready" : "blocked",
      title: model.displayTitle,
      subtitle: model.workItemType,
      source: item
    }, ctx, { compact: true, hideAnchor: shouldHideHeaderAnchor(item, ctx, hasOverview) })}
    ${taskBody}
    <div class="business-summary-actions">${action}</div>
  </article>`;
}

export function BusinessTaskBody(model = {}, ctx, options = {}) {
  const rows = [];
  const overview = BusinessTaskOverview(model, ctx, options);
  if (overview) rows.push(overview);
  if (!model.canHandle && model.blocker) {
    rows.push(`<div class="business-task-row business-task-alert"><span>${text(ctx.tr("businessTaskIssue"), ctx)}</span><p>${text(model.blocker, ctx)}</p></div>`);
  }
  if (!model.canHandle && model.requiredEvidence?.length) {
    rows.push(`<div class="business-task-row business-task-alert"><span>${text(ctx.tr("businessTaskMissingEvidence"), ctx)}</span><p>${text(model.requiredEvidence.join(" · "), ctx)}</p></div>`);
  }
  return `<div class="business-task-body" data-surface="business-task-body">${rows.join("")}</div>`;
}

export function BusinessTaskOverview(model = {}, ctx, options = {}) {
  const source = options.item || options.source || model.item || {};
  const task = businessTaskContext(source, model);
  if (!task.workspace?.id || !task.card?.id) return "";
  const completed = completedTaskFacts(task, ctx).slice(0, 4);
  const current = currentTaskFacts(task, ctx).slice(0, 4);
  if (!completed.length && !current.length) return "";
  const groups = [
    completed.length ? taskFieldGroup("businessTaskCompletedFacts", completed, ctx) : "",
    current.length ? taskFieldGroup("businessTaskCurrentFields", current, ctx) : ""
  ].filter(Boolean);
  return `<div class="business-task-overview" data-surface="business-task-overview">${groups.join("")}</div>`;
}

function taskFieldGroup(titleKey, rows, ctx) {
  return `<section class="business-task-field-group">
    <span>${text(ctx.tr(titleKey), ctx)}</span>
    <div class="business-task-field-grid">
      ${rows.map((row) => taskField(row, ctx)).join("")}
    </div>
  </section>`;
}

function taskField(row, ctx) {
  const empty = row.empty ? ` data-empty="true"` : "";
  const source = row.source ? ` data-field-source="${attr(row.source, ctx)}"` : "";
  return `<div class="business-task-field"${empty}${source}>
    <span>${text(row.label, ctx)}</span>
    <strong>${text(row.value, ctx)}</strong>
  </div>`;
}

function businessTaskContext(source = {}, model = {}) {
  const workspace = source.workspace || source;
  const cardId = source.cardId || source.card_id || source._surfaceCardId || model.cardId || source.card?.id || "";
  const card = source.card || (workspace?.cards || []).find((candidate) => candidate.id === cardId) || activeCard(workspace) || {};
  return {
    source,
    workspace,
    card,
    workspaceId: model.workspaceId || source.workspaceId || source.workspace_id || workspace?.id || "",
    cardId: model.cardId || cardId || card?.id || ""
  };
}

function completedTaskFacts(task, ctx) {
  const previousCards = previousCardsForTask(task);
  return previousCards.flatMap((card) => {
    const values = taskValues(task, card, ctx, { mode: "completed" });
    return taskRowsForCard(card, task, values, ctx, { completed: true });
  });
}

function currentTaskFacts(task, ctx) {
  const values = taskValues(task, task.card, ctx, { mode: "current" });
  const contract = stepContextContract(task.card?.id);
  const fields = contract
    ? [
        ...contract.userSelectableFields.map((entry) => taskFieldForId(task.card, entry.fieldId, ctx)),
        ...contract.derivedFields
          .filter((entry) => entry.surface !== "hidden-submit-only")
          .map((entry) => taskFieldForId(task.card, entry.fieldId, ctx))
      ]
    : taskCoreFields(task.card, ctx, { includeEmpty: true });
  return uniqueTaskRows(fields
    .filter(Boolean)
    .filter((field) => !isLowValueTaskField(field, ctx))
    .map((field) => taskRowForField(field, task.card, task, values, ctx, { current: true }))
    .filter(Boolean));
}

function previousCardsForTask(task) {
  const cards = task.workspace?.cards || [];
  const activeIndex = cards.findIndex((card) => card.id === task.card?.id);
  const contract = stepContextContract(task.card?.id);
  const dependentIds = contract?.dependsOn?.length ? contract.dependsOn : [];
  const byDependency = dependentIds
    .map((id) => cards.find((card) => card.id === id))
    .filter(Boolean);
  if (byDependency.length) return byDependency;
  return cards
    .slice(0, activeIndex < 0 ? 0 : activeIndex)
    .filter((card) => isTerminalCardStatus(card.status));
}

function taskRowsForCard(card, task, values, ctx, options = {}) {
  const fields = taskCoreFields(card, ctx, { values });
  const rows = fields
    .map((field) => taskRowForField(field, card, task, values, ctx, options))
    .filter((row) => row && (!options.completed || !row.empty));
  return uniqueTaskRows(rows);
}

function taskCoreFields(card, ctx, options = {}) {
  const values = options.values || {};
  const fields = card?.fields?.business || [];
  const preferred = preferredTaskFieldIds(card?.id);
  const byId = new Map(fields.map((field) => [canonicalTaskFieldId(field), field]));
  const ordered = [
    ...preferred.map((id) => byId.get(id) || (taskValueByFieldId(values, id, null, ctx) ? syntheticTaskField(id, ctx) : null)),
    ...fields
  ].filter(Boolean);
  return uniqueTaskFields(ordered)
    .filter((field) => options.includeEmpty || hasDisplayableTaskValue(values, canonicalTaskFieldId(field), field, ctx))
    .filter((field) => !isLowValueTaskField(field, ctx));
}

function taskRowForField(field, card, task, values, ctx, options = {}) {
  const fieldId = canonicalTaskFieldId(field);
  if (!fieldId || fieldId === "bedLayout" || fieldId === "bedStatus") return null;
  const state = taskFieldState(field, fieldId, card, task, values, ctx, options);
  if (!state.value && options.completed) return null;
  const display = state.displayValue || (state.value ? taskDisplayValue(field, fieldId, state.value, ctx) : ctx.tr("businessTaskPendingValue"));
  return {
    id: fieldId,
    label: taskDisplayLabel(field, fieldId, card, ctx),
    value: display,
    source: state.source || "",
    empty: !state.value
  };
}

function taskFieldState(field, fieldId, card, task, values, ctx, options = {}) {
  if (isBedSetupCardId(card?.id) && fieldId === "bedLabels") {
    const bedCount = taskValueByFieldId(values, "bedCount", field, ctx) ||
      inheritedTaskValue(task, "bedCount", ctx) ||
      taskValueByFieldId(values, "capacity", field, ctx);
    const pattern = taskValueByFieldId(values, "bedType", field, ctx) || defaultValueForField(taskFieldForId(card, "bedType", ctx)) || "bunk_pair";
    const displayValue = bedLayoutPreviewValue(bedCount, pattern, ctx);
    return { value: displayValue, displayValue, source: "derived" };
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedType") {
    const value = taskValueByFieldId(values, fieldId, field, ctx) || defaultValueForField(field) || "bunk_pair";
    return { value, source: value ? "default" : "" };
  }
  if (field?.ui?.derivedFrom === "roomType") {
    const roomType = taskValueByFieldId(values, "roomType", field, ctx);
    const value = taskValueByFieldId(values, fieldId, field, ctx) || capacityForRoomType(roomType);
    return { value, source: "derived" };
  }
  const value = taskValueByFieldId(values, fieldId, field, ctx);
  if (value) return { value, source: options.current ? "current" : "completed" };
  return { value: "", source: "" };
}

function inheritedTaskValue(task, fieldId, ctx) {
  const previous = previousCardsForTask(task);
  for (const card of previous) {
    const values = taskValues(task, card, ctx, { mode: "completed" });
    const value = taskValueByFieldId(values, fieldId, null, ctx);
    if (value) return value;
  }
  return "";
}

function taskValues(task, card, ctx, options = {}) {
  const workspaceId = task.workspaceId || task.workspace?.id || "";
  const cardId = card?.id || "";
  const draft = workspaceId && cardId ? loadDraft(workspaceId, cardId).values || {} : {};
  const snapshot = workspaceId && cardId ? loadCompletedRecordSnapshot(workspaceId, cardId, {
    workItemId: card?.workItemId || task.source?.workItemId || task.source?.work_item_id || ""
  })?.values || {} : {};
  const sourceValues = [
    task.source?.payload?.input?.fieldValues,
    task.source?.payload?.fieldValues,
    task.source?.Payload?.input?.fieldValues,
    task.source?.Payload?.fieldValues,
    task.source?.payload,
    task.source?.Payload,
    task.source?.fieldValues,
    task.source?.field_values,
    task.source?.values,
    task.source?.businessAnchor,
    task.source?.business_anchor,
    task.workspace?.fieldValues,
    task.workspace?.field_values,
    task.workspace?.values,
    task.workspace?.businessAnchor,
    task.workspace?.business_anchor,
    card?.fieldValues,
    card?.field_values,
    card?.values,
    card?.businessAnchor,
    card?.business_anchor
  ];
  const eventValues = taskEventValues(task, card, ctx);
  return options.mode === "current"
    ? mergeTaskValues(...sourceValues, snapshot, ...eventValues, draft)
    : mergeTaskValues(...sourceValues, draft, snapshot, ...eventValues);
}

function taskEventValues(task, card, ctx) {
  const workspaceId = task.workspaceId || task.workspace?.id || "";
  if (!workspaceId) return [];
  return [
    ...(ctx.state?.projectionEvents || []),
    ...(ctx.state?.runtimeStore?.events || [])
  ]
    .map((event) => ({
      workspaceId: event.workspaceId || event.WorkspaceId,
      cardId: event.cardId || event.CardId,
      payload: event.payload || event.Payload || {}
    }))
    .filter((event) => event.workspaceId === workspaceId && (!card?.id || !event.cardId || event.cardId === card.id))
    .map((event) => flattenTaskPayload(event.payload));
}

function flattenTaskPayload(payload = {}) {
  return mergeTaskValues(
    payload?.input?.fieldValues,
    payload?.input?.FieldValues,
    payload?.Input?.fieldValues,
    payload?.Input?.FieldValues,
    payload?.fieldValues,
    payload?.FieldValues,
    payload
  );
}

function mergeTaskValues(...sources) {
  return sources.reduce((current, source = {}) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return current;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null || typeof value === "object") continue;
      const textValue = String(value).trim();
      if (textValue) current[key] = textValue;
    }
    return current;
  }, {});
}

function hasDisplayableTaskValue(values, fieldId, field, ctx) {
  return Boolean(taskValueByFieldId(values, fieldId, field, ctx));
}

function uniqueTaskRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.id}:${row.label}:${row.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueTaskFields(fields = []) {
  const seen = new Set();
  return fields.filter((field) => {
    const id = canonicalTaskFieldId(field);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function shouldHideHeaderAnchor(source = {}, ctx = {}, hasOverview = false) {
  if (!hasOverview) return false;
  const importantKeys = new Set(["resident", "phone", "deposit", "payment", "task", "checkout", "period"]);
  const anchor = buildBusinessAnchor(source, ctx);
  return !anchor.fields.some((field) => importantKeys.has(field.key));
}

export function LifecycleWorkspace(item, activeCard, ctx) {
  const model = workItemModel({ workspace: item, card: activeCard, workspaceId: item.id, cardId: activeCard.id }, ctx);
  const blockers = activeBlockers(item, activeCard);
  const activeStepState = stepVisualState(activeCard.status, activeCard);
  const workspaceCompleted = (item.cards || []).every((card) => isTerminalCardStatus(card.status));
  const viewingCompletedStep = isTerminalCardStatus(activeCard.status) && !workspaceCompleted;
  const blockerText = blockers.length
    ? blockers.map((entry) => tx(entry.title || entry, ctx)).join(" · ")
    : ctx.tr("noSubmitBlocker");
  const workItemLabel = viewingCompletedStep ? ctx.tr("viewingCompletedStep") : ctx.tr("currentWorkItem");
  const workItemHelp = viewingCompletedStep ? ctx.tr("completedStepReadonlyHelp") : model.nextAction || tx(item.next, ctx);
  const stateHelp = viewingCompletedStep ? ctx.tr("completedRecordBody") : blockerText;
  return `<section class="lifecycle-workspace compact" data-surface="lifecycle-workspace">
    <article>
      <span>${text(workItemLabel, ctx)}</span>
      <strong>${text(tx(activeCard.title, ctx), ctx)}</strong>
      <p>${text(workItemHelp, ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("currentState"), ctx)}</span>
      <strong class="status-chip" data-step-state="${attr(activeStepState, ctx)}" data-card-status="${attr(activeCard.status, ctx)}">${text(ctx.tr(activeCard.status) || activeCard.status, ctx)}</strong>
      <p>${text(stateHelp, ctx)}</p>
    </article>
    <article class="lifecycle-wide">
      <span>${text(ctx.tr("lifecycleTimeline"), ctx)}</span>
      <div class="lifecycle-timeline">${(item.cards || []).map((card) => timelineStep(item, card, activeCard, ctx)).join("")}</div>
    </article>
  </section>`;
}

export function OperationStepRail(item, activeCard, ctx, options = {}) {
  const cards = item.cards || [];
  const currentIndex = Math.max(0, cards.findIndex((card) => card.id === activeCard.id));
  const activeStepState = stepVisualState(activeCard.status, activeCard);
  const surface = options.surface || "operation-step-rail";
  const attrs = dataAttrs(options.attrs || {}, ctx);
  return `<section class="operation-step-rail" data-surface="${attr(surface, ctx)}" data-component="operation-step-rail"${attrs}>
    <div class="operation-step-summary">
      <div class="operation-step-title">
        <strong>${text(tx(item.title, ctx) || ctx.tr("operationPanel"), ctx)}</strong>
        ${businessAnchorHtml({ workspace: item, card: activeCard, workspaceId: item.id, cardId: activeCard.id }, ctx, { compact: true })}
      </div>
      <div class="operation-step-meta">
        <strong>${text(stepPositionText(currentIndex, cards.length, ctx), ctx)}</strong>
        <small class="status-chip" data-step-state="${attr(activeStepState, ctx)}" data-card-status="${attr(activeCard.status, ctx)}">${text(stepStatusLabel(activeCard, ctx), ctx)}</small>
      </div>
    </div>
    <div class="operation-step-list">
      ${cards.map((card, index) => timelineStep(item, card, activeCard, ctx, index)).join("")}
    </div>
  </section>`;
}

function dataAttrs(values = {}, ctx) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => ` ${key}="${attr(value, ctx)}"`)
    .join("");
}

function timelineStep(item, card, activeCard, ctx, index = 0) {
  const current = card.id === activeCard.id;
  const statusLabel = stepStatusLabel(card, ctx);
  const label = `${tx(card.title, ctx)} ${statusLabel}`.trim();
  const state = stepVisualState(card.status, card);
  const marker = isCorrectionStep(card) ? ` data-step-marker="${attr(ctx.tr("correctionStepMarker"), ctx)}"` : "";
  return `<button type="button" class="timeline-step${current ? " current" : ""}" data-step-state="${attr(state, ctx)}" data-card-status="${attr(card.status, ctx)}" data-current-step="${current ? "true" : "false"}"${marker} data-workspace="${attr(item.id, ctx)}" data-card-id="${attr(card.id, ctx)}" aria-label="${attr(label, ctx)}" title="${attr(label, ctx)}" ${current ? `aria-current="step"` : ""}>
    <strong>${index + 1}</strong>
  </button>`;
}

function stepStatusLabel(card = {}, ctx = {}) {
  if (isTerminalCorrectionStep(card)) return ctx.tr("completedWithCorrectionStatus");
  if (isCorrectionStep(card)) return ctx.tr("correctionStepStatus");
  return ctx.tr(card.status) || card.status;
}

function stepVisualState(status = "", card = {}) {
  if (isTerminalCardStatus(status)) return "completed";
  if (isCorrectionStep(card)) return "correction";
  if (status === "blocked") return "blocked";
  if (status === "inProgress") return "in-progress";
  if (["ready", "available"].includes(status)) return "ready";
  return "not-started";
}

function isTerminalCorrectionStep(card = {}) {
  return isCorrectionStep(card) && isTerminalCardStatus(card.status);
}

function isCorrectionStep(card = {}) {
  return card.correctionMode === "append_only" ||
    card.operationMode === "correction" ||
    card.payload?.correctionMode === "append_only" ||
    card.Payload?.correctionMode === "append_only" ||
    card.payload?.operationMode === "correction" ||
    card.Payload?.operationMode === "correction";
}

function stepPositionText(index, total, ctx) {
  const current = index + 1;
  if (ctx.state?.lang === "ru-RU") return `Шаг ${current} из ${total || current}`;
  if (ctx.state?.lang === "ky-KG") return `${current}/${total || current}-кадам`;
  return `第 ${current}/${total || current} 步`;
}

export function OperationPanelView(innerHtml, item, activeCard, ctx) {
  const workspace = item.workspace || item;
  const model = workItemModel({ ...item, workspace, card: activeCard, workspaceId: item.workspaceId || workspace.id, cardId: item.cardId || activeCard.id }, ctx);
  const vm = OperationPanelVM({ ...item, workspace, card: activeCard }, ctx);
  return `<section class="operation-panel-view" data-surface="operation-panel-runtime">
    <div class="operation-panel-head">
      <span>${text(ctx.tr("operationPanel"), ctx)}</span>
      <strong>${text(vm.subtitle, ctx)}</strong>
      <small>${text(model.workItemType || vm.title, ctx)} · ${text(vm.trace.status, ctx)}</small>
    </div>
    ${innerHtml}
  </section>`;
}

export function TrustedConfirmSheet(item, card, ctx) {
  const workspace = item.workspace || item;
  const model = workItemModel({ ...item, workspace, card, workspaceId: item.workspaceId || workspace.id, cardId: item.cardId || card.id }, ctx);
  const vm = TrustedConfirmVM({ ...item, workspace, card }, ctx);
  return `<section class="trusted-confirm-sheet" data-surface="trusted-confirm">
    <h2>${text(ctx.tr("trustedConfirm"), ctx)}</h2>
    <article>
      <h3>${text(vm.businessCommitment.title, ctx)}</h3>
      <p>${text(vm.businessCommitment.body, ctx)}</p>
      <p>${text(vm.businessCommitment.ledgerImpact, ctx)}</p>
    </article>
    <article>
      <h3>${text(vm.evidenceAndPermission.title, ctx)}</h3>
      <p>${text(vm.evidenceAndPermission.body, ctx)}</p>
      <p>${text(ctx.tr("permissionPolicyMatched"), ctx)} · ${text(ctx.tr("decisionRisk"), ctx)} ${text(vm.evidenceAndPermission.risk, ctx)}</p>
    </article>
    <article>
      <h3>${text(vm.auditAndRollback.title, ctx)}</h3>
      <p>${text(vm.auditAndRollback.body, ctx)}</p>
    </article>
    ${ctx.state?.debugSurface ? `<dl>
      ${field("workItemId", model.workItemId, ctx)}
      ${field("caseId", model.caseId, ctx)}
      ${field("requiredEvidence", model.requiredEvidence.join(" · ") || "-", ctx)}
      ${field("policyRef", card.policyRef || card.confirmation?.policyRef || "operations-runtime-policy", ctx)}
      ${field("risk", model.riskLevel, ctx)}
      ${field("nextAction", model.nextAction, ctx)}
    </dl>` : ""}
  </section>`;
}

export function TechnicalAuditDetails(details = {}, ctx) {
  const canInspect = technicalDetailsVisible(ctx);
  const shouldOpen = Boolean(ctx.state?.debugSurface);
  return `<details class="operation-technical-details" data-surface="operation-runtime-proof" data-work-item-id="${attr(details.model?.workItemId, ctx)}" data-case-id="${attr(details.model?.caseId, ctx)}" data-submission-id="${attr(details.commandSubmissionId, ctx)}" data-payload-fingerprint="${attr(details.payloadHash, ctx)}" ${shouldOpen ? "open" : ""}>
    <summary>${text(ctx.tr(canInspect ? "auditDetails" : "technicalDetails"), ctx)}</summary>
    ${canInspect ? `<section class="operation-panel-runtime">
      <article><span>${text(ctx.tr("prepareContract"), ctx)}</span><strong>${text(ctx.tr("prepareContractReady"), ctx)}</strong><p>${text(ctx.tr("prepareContractHelp"), ctx)}</p></article>
      <article><span>${text(ctx.tr("confirmCommit"), ctx)}</span><strong>${text(ctx.tr("confirmCommitReady"), ctx)}</strong><p>${text(ctx.tr("confirmCommitHelp"), ctx)}</p></article>
      <article><span>${text(ctx.tr("trace"), ctx)}</span><strong>${text(details.traceCount ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind"), ctx)}</strong><p>${text(ctx.tr("traceHelp"), ctx)}</p></article>
      <article><span>${text(ctx.tr("projection"), ctx)}</span><strong>${text(ctx.tr(details.projectionStatus), ctx)}</strong><p>${text(ctx.tr("projectionPendingBody"), ctx)}</p></article>
      <article><span>${text(ctx.tr("submissionRecord"), ctx)}</span><strong>${text(details.commandSubmissionId ? ctx.tr("traceAvailable") : ctx.tr("traceWillBind"), ctx)}</strong><p>${text(ctx.tr("submissionRecordHelp"), ctx)}</p></article>
      <article><span>${text(ctx.tr("payloadFingerprint"), ctx)}</span><strong>${text(ctx.tr("localDraftFingerprint"), ctx)}</strong><p>${text(ctx.tr("payloadFingerprintHelp"), ctx)}</p></article>
      <dl>
        ${field("workItemId", details.model?.workItemId, ctx)}
        ${field("caseId", details.model?.caseId, ctx)}
        ${field("commandSubmissionId", details.commandSubmissionId, ctx)}
        ${field("payloadHash", details.payloadHash, ctx)}
        ${field("policyRef", details.policyRef, ctx)}
      </dl>
    </section>` : ""}
  </details>`;
}

export function ActionResult(result = {}, ctx) {
  if (!result.status && !result.message) return "";
  if (result.status === "committed_projection_pending") return ProjectionPendingState(result, ctx);
  if (result.status === "committed_projection_failed") return FailedSyncState(result, ctx);
  if (result.status === "permission_blocked_403") return PermissionDiagnostic(result.permissionDiagnostic || result, ctx);
  if (result.status === "idempotency_conflict_409") return RecoveryState("duplicateSubmitRecovery", "duplicateSubmitRecoveryBody", "recentTraces", ctx);
  if (result.status === "business_blocked_422") return RecoveryState("validationRecovery", "validationRecoveryBody", "learning", ctx);
  const status = result.status || "network_unknown";
  return `<section class="action-result ${attr(status, ctx)}" data-surface="action-result">
    <b>${text(ctx.tr("actionResult"), ctx)}</b>
    <p>${text(result.message || status, ctx)}</p>
    ${result.commandSubmissionId ? `<small>${ctx.tr("submissionRecord")}: ${ctx.tr("traceAvailable")}</small>` : ""}
  </section>`;
}

function RecoveryState(titleKey, bodyKey, view, ctx) {
  return `<section class="action-result recovery" data-surface="action-recovery">
    <b>${text(ctx.tr(titleKey), ctx)}</b>
    <p>${text(ctx.tr(bodyKey), ctx)}</p>
    <button data-view="${attr(view, ctx)}">${text(ctx.tr(view === "learning" ? "learningCenter" : "recentTraces"), ctx)}</button>
  </section>`;
}

export function ProjectionPendingState(result = {}, ctx) {
  return `<section class="projection-pending-state" data-surface="projection-pending">
    <b>${text(ctx.tr("projectionPending"), ctx)}</b>
    <p>${text(result.message || ctx.tr("projectionPendingBody"), ctx)}</p>
  </section>`;
}

export function FailedSyncState(result = {}, ctx) {
  return `<section class="failed-sync-state" data-surface="failed-sync">
    <b>${text(ctx.tr("failedSync"), ctx)}</b>
    <p>${text(result.message || ctx.tr("failedSyncBody"), ctx)}</p>
  </section>`;
}

export function EvidenceTile(field, draft, disabled, ctx) {
  const saved = (draft.evidenceDrafts || []).find((item) => item.requirementId === field.id);
  const state = EvidenceStateVM(field, saved, ctx);
  const selected = saved ? `selected ${state.status}` : state.status;
  const evidenceDraftId = saved?.evidenceId ? `data-evidence-draft-id="${attr(saved.evidenceId, ctx)}"` : "";
  return `<button type="button" class="evidence-tile ${selected}" data-surface="evidence-tile" data-evidence-id="${attr(field.id, ctx)}" ${evidenceDraftId} ${disabled}>
    <span>${text(ctx.localTerm(field), ctx)}</span>
    <small>${text(state.label, ctx)}</small>
  </button>`;
}

export function EvidenceSheet(card, draft, ctx) {
  const evidence = card.evidence || [];
  const states = evidence.map((field) => EvidenceStateVM(field, (draft.evidenceDrafts || []).find((item) => item.requirementId === field.id), ctx));
  const verified = states.filter((state) => ["verified", "system_ready"].includes(state.status)).length;
  const hasMissing = states.some((state) => state.status === "missing");
  return `<section class="evidence-sheet" data-surface="evidence-sheet">
    <b>${text(ctx.tr("trustedEvidence"), ctx)}</b>
    <p>${evidence.length ? states.map((state) => text(`${state.name}: ${state.label}`, ctx)).join(" · ") : text(ctx.tr("noRequiredEvidence"), ctx)}</p>
    <small>${verified}/${evidence.length} ${text(verified >= evidence.length && evidence.length ? ctx.tr("evidenceReady") : ctx.tr("evidenceNeedReview"), ctx)}</small>
    ${hasMissing ? `<p>${text(ctx.tr("evidenceMissingBlocksSubmit"), ctx)}</p>` : ""}
  </section>`;
}

export function EvidenceStateVM(field, draft = null, ctx = {}) {
  const name = ctx.localTerm ? ctx.localTerm(field) : field?.id || "";
  if (!draft) return { status: "system_ready", name, label: ctx.tr?.("evidenceSystemReady") || "系统将在提交时自动绑定" };
  const status = draft.status || draft.verificationStatus || (isRuntimePlaceholder(draft) ? "pending_review" : "draft");
  if (status === "verified") return { status, name, label: ctx.tr?.("evidenceReady") || "证据已就绪" };
  if (status === "rejected") return { status, name, label: `${ctx.tr?.("evidenceRejected") || "证据被拒绝"}：${draft.reason || ctx.tr?.("evidenceRejectedNext") || "请重新补充并提交复核"}` };
  if (status === "scope_mismatch") return { status, name, label: ctx.tr?.("evidenceScopeMismatch") || "证据不属于当前办理，请重新选择" };
  if (status === "already_used" || status === "used") return { status, name, label: ctx.tr?.("evidenceAlreadyUsed") || "证据已被其他办理使用，请更换证据" };
  if (status === "upload_failed") return { status, name, label: ctx.tr?.("evidenceUploadFailed") || "上传失败，请重试" };
  if (status === "expired") return { status, name, label: ctx.tr?.("evidenceExpired") || "证据已过期，请重新补充" };
  if (status === "locked") return { status, name, label: ctx.tr?.("evidenceLocked") || "证据已锁定，需负责人复核" };
  if (status === "attached" || status === "hash_verified" || status === "pending_review") return { status: "pending_review", name, label: ctx.tr?.("evidencePendingReview") || "已上传，等待可信校验" };
  return { status: "draft", name, label: ctx.tr?.("evidenceTrustedDraft") || "已选择，待可信校验" };
}

export function PermissionDiagnostic(decision = {}, ctx) {
  const copy = permissionDiagnosticCopy(decision, ctx.tr);
  return `<section class="permission-diagnostic" data-surface="permission-diagnostic">
    <span>${ctx.tr("permissionDiagnostic")}</span>
    <h1>${text(copy.reason, ctx)}</h1>
    <dl>
      ${field(ctx.tr("permissionWhy"), copy.reason, ctx)}
      ${field(ctx.tr("permissionOwner"), copy.owner, ctx)}
      ${field(ctx.tr("requiredPermission"), copy.requiredPermission, ctx)}
      ${field(ctx.tr("permissionNextAction"), copy.nextAction, ctx)}
    </dl>
    <button data-view="learning">${text(ctx.tr("learningCenter"), ctx)}</button>
  </section>`;
}

export function UploadQueue(state = {}, ctx) {
  const vm = QueueStateVM(state, ctx);
  return queuePanel("upload-queue", vm.upload.title, vm.upload.count, vm.upload.message, ctx);
}

export function SubmitQueue(state = {}, ctx) {
  const vm = QueueStateVM(state, ctx);
  return queuePanel("submit-queue", vm.submit.title, vm.submit.count, vm.submit.message, ctx);
}

export function DeviceTrustPanel(state = {}, ctx) {
  // DeviceTrustVM maps deviceContextIssue when "pc-" device ids leak into mobile.
  const vm = DeviceTrustVM({ currentDevice: state.currentDevice || state.pcGovernance?.currentDevice || {} }, ctx);
  if (vm.contextMismatch) {
    return `<section class="device-trust-panel context-mismatch" data-surface="device-trust">
      <b>${text(vm.statusLabel, ctx)}</b>
      <p>${text(vm.body, ctx)}</p>
    </section>`;
  }

  return `<section class="device-trust-panel" data-surface="device-trust">
    <b>${text(vm.title, ctx)}</b>
    <p>${text(vm.statusLabel, ctx)}</p>
  </section>`;
}

export function workItemModel(item = {}, ctx) {
  const workspace = item.workspace || item;
  const card = item.card || workspace.card || activeCard(workspace);
  const runtimeItem = runtimeWorkItemFor(item, workspace, card, ctx);
  const evidence = card?.evidence || item.requiredEvidence || [];
  const drafts = workspace?.id && card?.id ? loadDraft(workspace.id, card.id) : { evidenceDrafts: [] };
  const title = item.title || workspace?.title || card?.title || item.workItemId || "";
  const evidenceState = evidenceStateFor({ ...item, card, evidenceDrafts: drafts.evidenceDrafts });
  const vm = WorkItemDecisionVM({ ...item, workspace, card, evidenceState }, ctx);
  return {
    ...vm,
    workspaceId: item.workspaceId || workspace?.id || "",
    cardId: item.cardId || card?.id || "",
    workItemId: vm.sourceRefs.workItemId || runtimeItem?.workItemId || runtimeItem?.work_item_id || persistedWorkItemIdFor(workspace, card) || persistedCandidate(item.workItemId || item.work_item_id) || "",
    caseId: vm.sourceRefs.caseId || item.caseId || item.case_id || runtimeItem?.caseId || runtimeItem?.case_id || workspace?.caseId || workspace?.id || "",
    workItemType: tx(card?.title, ctx) || vm.typeLabel,
    lifecycleState: normalizeOperationLifecycleState(item.lifecycleState || item.lifecycle_state || item.status || runtimeItem?.lifecycleState || runtimeItem?.lifecycle_state || runtimeItem?.status || card?.status),
    ownerRole: item.ownerRole || item.owner_role || runtimeItem?.ownerRole || runtimeItem?.owner_role || card?.confirmation?.requiredRole || card?.Confirmation?.requiredRole || "operator",
    SLA: vm.slaLabel,
    requiredEvidence: vm.requiredEvidenceLabels,
    nextAction: vm.nextAction,
    traceRefs: array(item.traceRefs || item.trace_refs || item.commandSubmissionId || item.command_submission_id || workspace?.traceRefs),
    riskLevel: vm.riskLabel,
    evidenceState,
    dueAt: vm.dueAtLabel,
    businessObject: vm.businessObject
  };
}

function persistedCandidate(value) {
  return isPersistedWorkItemId(value) ? value : "";
}

function runtimeWorkItemFor(item, workspace, card, ctx) {
  const selectedWorkItemId = ctx?.state?.selectedWorkItemId || item.workItemId || item.work_item_id || "";
  return resolvePersistedWorkItem({
    workItemId: selectedWorkItemId,
    workspaceId: workspace?.id,
    cardId: card?.id
  }, ctx?.state || {});
}

function persistedWorkItemIdFor(workspace, card) {
  if (workspace?.runtimeWorkItemId) return workspace.runtimeWorkItemId;
  if (card?.runtimeWorkItemId) return card.runtimeWorkItemId;
  if (workspace?.workItemId && isPersistedWorkItemId(workspace.workItemId)) return workspace.workItemId;
  if (card?.workItemId && isPersistedWorkItemId(card.workItemId)) return card.workItemId;
  return "";
}

function isPersistedWorkItemId(value) {
  return String(value || "").includes(":") || /^wi-/i.test(String(value || ""));
}

function queuePanel(component, label, count, message, ctx) {
  return `<section class="personal-ops-panel" data-surface="${attr(component, ctx)}">
    <b>${label}</b>
    <strong>${count}</strong>
    <p>${text(message, ctx)}</p>
  </section>`;
}

function activeCard(workspace) {
  return workspace?.cards?.find((card) => isActionableCardStatus(card.status)) || workspace?.cards?.[0] || {};
}

function roleLabel(role, ctx) {
  const labels = {
    frontdesk: ctx.tr("frontdeskRole"),
    operator: ctx.tr("operatorRole"),
    housekeeping: ctx.tr("housekeepingRole"),
    finance: ctx.tr("financeRole"),
    manager: ctx.tr("managerRole"),
    admin: ctx.tr("adminRole"),
    releaseOwner: ctx.tr("releaseOwnerRole")
  };
  return labels[role] || role;
}

function technicalDetailsVisible(ctx) {
  const role = ctx.state?.currentActor?.role || "";
  return Boolean(ctx.state?.debugSurface || ["admin", "support", "audit"].includes(role));
}

function isRuntimePlaceholder(draft = {}) {
  return String(draft.fileName || draft.name || draft.evidenceId || "").includes("runtime-evidence");
}

function field(label, value, ctx) {
  return `<div class="definition-row"><dt>${text(label, ctx)}</dt><dd>${text(value || "-", ctx)}</dd></div>`;
}

function statusFromMessage(message = "") {
  if (!message) return "";
  if (String(message).includes("pending")) return "committed_projection_pending";
  if (String(message).includes("failed")) return "committed_projection_failed";
  return "committed_projected";
}

function fallbackActionResult(ctx) {
  const message = ctx.state.operationMessage || "";
  return { status: statusFromMessage(message), message };
}

function array(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function tx(value, ctx) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (ctx.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || "";
}

function activeBlockers(item, card) {
  if (card?.status !== "blocked") return [];
  return card.blockerRules?.length ? card.blockerRules : item.blockers || [];
}

function text(value, ctx) {
  return ctx.escapeHtml ? ctx.escapeHtml(String(value ?? "")) : String(value ?? "");
}

function attr(value, ctx) {
  return ctx.escapeAttr ? ctx.escapeAttr(String(value ?? "")) : text(value, ctx);
}
