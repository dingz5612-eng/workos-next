import { bedLayoutForLabels, generatedBedLabelsForCount, serializeBedLayout } from "../controls/bedLabelControls.js";
import { fieldControlKind, isDerivedReadonlyField, optionsForField } from "../controls/fieldControls.js";
import { isScopedResourceFieldVisible } from "../controls/resourceScopeControls.js";
import { loadCompletedRecordSnapshot, loadDraft } from "../operationDrafts.js";
import { completedRecordActionPolicy } from "../operationRecordPolicy.js";
import { operationFieldId } from "../operationFieldKernel.js";
import { lensIdsForWorkspace, lensPreview, lensTitle } from "../runtimeLensCatalog.js";
import { buildOperationActionState } from "../operationActionState.js";
import { FIRST_GOLDEN_CHAIN_STEPS, defaultBedTypeForCount, isBedSetupCardId, isFirstGoldenChainWorkspaceId, isUserSubmittedCapabilityField, runtimeWorkItemMatchesCapabilityCard } from "../capabilityProjection.js";
import { activeCardForWorkspace, activeWorkspaceCard, isCardActionDisabled, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { checkoutServiceMobilePanel, checkoutServiceOperationAddon } from "./checkoutServiceView.js";
import { EvidenceStateVM, OperationStepRail } from "./experienceComponents.js";
import {
  currentMissingContextLabels,
  currentMissingRequiredLabels,
  hasCarryValue,
  isCaseContextReadonlyField,
  isForcedCaseContextReadonlyField,
  missingFieldIdsFor,
  operationDraftValues,
  operationFieldRequired,
  operationFieldState,
  operationInputFields,
  operationValue,
  sameWorkspaceEvents,
  stepDependencyValidationChips
} from "../fieldSourceRenderer.js";

export { operationFieldId } from "../operationFieldKernel.js";
export { operationInputFields, operationValue } from "../fieldSourceRenderer.js";

export function workspaceView(ctx) {
  const item = ctx.workspace();
  if (!item) {
    return ctx.shell(`
      <section class="workspace-page">
        <span>${ctx.tr("intentWorkspace")}</span>
        <h1>${ctx.tr("coachNoMatch")}</h1>
        <p>${ctx.tr("apiOffline")}</p>
      </section>
    `);
  }
  const activeCard = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  const workspaceCompleted = (item.cards || []).every((card) => isTerminalCardStatus(card.status));
  const viewingCompletedStep = isTerminalCardStatus(activeCard.status) && !workspaceCompleted;
  const currentActionResult = currentActionResultForOperationCard(ctx.state.lastActionResult, item, activeCard, ctx);
  const actionState = buildOperationActionState(
    operationAdmissionContext(item, activeCard, ctx),
    activeCard,
    currentActionResult,
    { ...ctx.state, lastActionResult: currentActionResult });
  const isCompleted = workspaceCompleted && isTerminalCardStatus(activeCard.status);
  if (isCompleted) {
    return ctx.shell(`
      ${completedWorkspaceRecord(item, activeCard, ctx)}
    `);
  }
  if (viewingCompletedStep) {
    return ctx.shell(`
      ${completedWorkspaceRecord(item, activeCard, ctx)}
    `);
  }
  return ctx.shell(`
    <section class="workspace-page ${item.domain}">
      <span>${ctx.tr("intentWorkspace")} · ${ctx.tr(item.domain)}</span>
      <h1>${ctx.tx(item.title)}</h1>
      <p>${ctx.tx(item.summary)}</p>
    </section>
    <section class="workspace-control">
      ${OperationStepRail(item, activeCard, ctx)}
      ${operationStepDebugTabs(item, activeCard, ctx)}
      ${workspaceLensPanel(item, ctx)}
      ${checkoutServiceMobilePanel(item, activeCard, ctx)}
      ${workspaceCardPanel(activeCard, item, true, ctx)}
    </section>
    ${viewingCompletedStep || isCompleted ? "" : `<div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>`}
  `);
}

function operationAdmissionContext(workspace = {}, card = {}, ctx = {}) {
  const workItem = (ctx.state.runtimeStore?.operationWorkItems || []).find((item) =>
    item.workspaceId === workspace.id &&
    runtimeWorkItemMatchesCapabilityCard(item, card.id));
  return {
    ...(workItem || {}),
    workspace,
    workspaceId: workspace.id,
    cardId: card.id
  };
}

export function currentActionResultForOperationCard(result = null, item = {}, card = {}, ctx = {}) {
  if (!result) return null;
  if (result.workspaceId && item?.id && result.workspaceId !== item.id) return result;
  if (result.cardId && card?.id && result.cardId !== card.id) return result;
  if (result.status !== "business_blocked_422" || result.reason !== "required_field_missing") return result;
  const validation = ctx.state?.fieldValidation || {};
  const hasCurrentValidation = validation.workspaceId === item?.id &&
    validation.cardId === card?.id &&
    Array.isArray(validation.missingFieldIds);
  if (!hasCurrentValidation) return result;
  const userMissing = currentMissingRequiredLabels(card, item, ctx);
  const contextMissing = currentMissingContextLabels(card, item, ctx);
  return userMissing.length || contextMissing.length ? result : null;
}

export function completedWorkspaceRecord(item, card, ctx) {
  const completedSteps = (item.cards || []).filter((candidate) => isTerminalCardStatus(candidate.status));
  const selectedStep = isTerminalCardStatus(card.status) ? card : completedSteps[0] || card;
  const policy = completedRecordActionPolicy({ workspace: item, card: selectedStep, state: ctx.state, surface: "readonlyRecord" });
  const nextWorkItem = policy.nextWorkItem;
  const continueNext = nextWorkItem
    ? `<button class="primary-action ready" data-work-item-id="${ctx.escapeAttr(nextWorkItem.workItemId)}" data-workspace-id="${ctx.escapeAttr(nextWorkItem.workspaceId)}" data-card-id="${ctx.escapeAttr(nextWorkItem.cardId)}">${ctx.tr("continueNextStage")}</button>`
    : "";
  const sourceWorkItemId = completedRecordSourceWorkItemId(item, selectedStep, ctx);
  const correctionAction = policy.canCorrect
    ? `<button class="secondary" data-correction-work-item="true" data-workspace-id="${ctx.escapeAttr(item.id)}" data-card-id="${ctx.escapeAttr(selectedStep.id)}" data-source-work-item-id="${ctx.escapeAttr(sourceWorkItemId)}">${ctx.tr("correctCompletedStep")}</button>`
    : "";
  const fieldRows = completedRecordFieldRows(selectedStep, item, ctx);
  const fieldsMissing = fieldRows.length > 0 && fieldRows.every((row) => !row.hasValue);
  const recordEvidence = evidenceForRecord(item, selectedStep);
  const evidenceText = recordEvidence.length ? recordEvidence.map((entry) => ctx.localTerm(entry)).join(" · ") : ctx.tr("noRequiredEvidence");
  const firstGoldenChainCompleted = isFirstGoldenChainWorkspaceId(item.id) &&
    FIRST_GOLDEN_CHAIN_STEPS.every((step) =>
      isTerminalCardStatus((item.cards || []).find((candidate) => candidate.id === step.cardId)?.status));
  const firstGoldenChainBusinessValues = firstGoldenChainCompleted
    ? firstGoldenChainCompletionValues(item, ctx)
    : [];
  const firstGoldenChainCompletionBanner = firstGoldenChainCompleted
    ? `<section class="operation-state" data-capability-completion="Dormitory.FirstGoldenChain"><b>第一金链内测完成</b>${firstGoldenChainBusinessValues.length ? `<p>${firstGoldenChainBusinessValues.map((value) => ctx.escapeHtml(value)).join(" / ")}</p>` : ""}<p>仅代表内测办理记录完成；不代表上线、发布或最终放行。</p></section>`
    : "";
  return `<section class="completed-record-control" data-component="completedWorkspaceRecord" data-surface="completed-workspace-record" data-lifecycle-state="${ctx.escapeAttr(selectedStep.status)}" data-admission-decision="visible_readonly_completed" data-runtime-decision="work_item_terminal:${ctx.escapeAttr(selectedStep.status)}">
    ${OperationStepRail(item, selectedStep, ctx, {
      surface: "completed-workspace-route",
      attrs: {
        "data-card-id": selectedStep.id,
        "data-lifecycle-state": selectedStep.status,
        "data-readonly": "true"
      }
    })}
    <div class="card-operation completed-record-operation" data-component="operation-card-shell">
      <span>${ctx.tr("completedRecordReadonly")}</span>
      <h3>${ctx.tx(selectedStep.title)}</h3>
      <section class="operation-state">
        <b>${ctx.tr(selectedStep.status)}</b>
        <p>${ctx.tr("completedReviewBeforeCorrection")}</p>
      </section>
      ${firstGoldenChainCompletionBanner}
      ${fieldRows.length ? `<section class="completed-record-facts">
      <b>${ctx.tr("businessFields")}</b>
      ${fieldsMissing ? `<p class="record-sync-warning">${ctx.tr("recordFieldsNotSynced")}</p>` : ""}
      <dl>${fieldRows.map((row) => completedFactRow(ctx.localTerm(row.field), row.displayValue || ctx.tr("recordValueMissing"), ctx)).join("")}</dl>
    </section>` : ""}
      <section class="completed-record-facts">
      <b>${ctx.tr("stepDetails")}</b>
      <dl>
        ${completedFactRow(ctx.tr("requiredEvidenceCopy"), evidenceText, ctx)}
        ${completedFactRow(ctx.tr("blockers"), blockersForRecord(item, selectedStep, ctx), ctx)}
        ${completedFactRow(ctx.tr("auditSummary"), ctx.tr("completedAuditHelp"), ctx)}
      </dl>
    </section>
      ${readonlyStateSummaryPanel(selectedStep, fieldRows, recordEvidence, policy, ctx)}
      <section class="completed-record-facts completed-record-actions">
      <b>${ctx.tr("recordActions")}</b>
      <p>${ctx.tr("completedCorrectionHelp")}</p>
      <div class="operation-actions">${continueNext}${correctionAction}</div>
    </section>
    </div>
  </section>`;
}

function readonlyStateSummaryPanel(card, fieldRows, recordEvidence, policy, ctx) {
  const submittedFields = fieldRows.filter((row) => row.hasValue).length;
  const fieldSummary = fieldRows.length
    ? `${submittedFields}/${fieldRows.length}`
    : ctx.tr("readonlyNoBusinessFields");
  const evidenceSummary = recordEvidence.length
    ? recordEvidence.map((entry) => ctx.localTerm(entry)).join(" · ")
    : ctx.tr("noRequiredEvidence");
  const correctionSummary = policy.canCorrect
    ? ctx.tr("readonlyCorrectionAvailable")
    : ctx.tr("readonlyCorrectionUnavailable");
  const chips = [
    `${ctx.tr("readonlyRecordFieldsCheck")}: ${fieldSummary}`,
    `${ctx.tr("readonlyEvidenceCheck")}: ${evidenceSummary}`,
    `${ctx.tr("readonlyTraceCheck")}: ${ctx.tr("traceBound")}`,
    `${ctx.tr("readonlyCorrectionStatus")}: ${correctionSummary}`
  ];
  return `<section class="system-check-panel readonly-state-summary" data-surface="readonly-state-summary" data-lifecycle-state="${ctx.escapeAttr(card.status)}">
    <b>${ctx.tr("readonlyStateSummary")}</b>
    <p>${ctx.tr("readonlyStateSummaryHelp")}</p>
    <div>${chips.map((chip) => `<span>${ctx.escapeHtml(chip)}</span>`).join("")}</div>
  </section>`;
}

function completedFactRow(label, value, ctx) {
  return `<dt>${ctx.escapeHtml(String(label || "-"))}</dt><dd>${ctx.escapeHtml(String(value || "-"))}</dd>`;
}

function fieldsForRecord(card, item, ctx) {
  const values = completedRecordPayload(item, card, ctx);
  return (card.fields?.business || []).filter((field) => {
    const fieldId = operationFieldId(field);
    if (isFirstGoldenChainWorkspaceId(item?.id) && !isUserSubmittedCapabilityField(card?.id, fieldId)) return false;
    const hasSubmittedValue = hasCarryValue(values[fieldId]) || hasCarryValue(values[field.id]);
    const fallbackVisible = hasSubmittedValue ||
      Boolean(field.required) ||
      !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN"));
    return isScopedResourceFieldVisible(card?.id, fieldId, values, fallbackVisible);
  });
}

function firstGoldenChainCompletionValues(item, ctx) {
  const values = {};
  for (const step of FIRST_GOLDEN_CHAIN_STEPS) {
    const card = (item.cards || []).find((candidate) => candidate.id === step.cardId);
    if (!card) continue;
    Object.assign(values, completedRecordPayload(item, card, ctx));
  }
  return [
    values.roomNo,
    values.bedNo ? `${values.roomNo || ""}-${values.bedNo}`.replace(/^-/, "") : "",
    readinessDisplayValue(values.readinessState, ctx)
  ].filter(Boolean);
}

function readinessDisplayValue(value, ctx) {
  if (!value) return "";
  return displayFieldValue({ id: "readinessState", label: { "zh-CN": "就绪状态" }, ui: { optionSet: "readinessState" } }, value, ctx);
}

function evidenceForRecord(item, card) {
  return card.evidence?.length ? card.evidence : item.cards?.flatMap((candidate) => candidate.id === card.id ? candidate.evidence || [] : []) || [];
}

function blockersForRecord(item, card, ctx) {
  const blockers = activeBlockers(item, card);
  return blockers.length ? blockers.map((entry) => ctx.tx(entry.title || entry)).join(" · ") : ctx.tr("noCriticalBlocker");
}

function displayOperationValue(field, item, card, ctx) {
  const value = operationValue(field, item, card, ctx);
  return displayFieldValue(field, value, ctx);
}

function completedRecordFieldRows(card, item, ctx) {
  return fieldsForRecord(card, item, ctx).map((field) => {
    const value = completedRecordRawValue(field, item, card, ctx);
    return {
      field,
      hasValue: hasCarryValue(value),
      displayValue: hasCarryValue(value) ? displayFieldValue(field, value, ctx) : ""
    };
  });
}

function completedRecordRawValue(field, item, card, ctx) {
  const payload = completedRecordPayload(item, card, ctx);
  const fieldId = operationFieldId(field);
  return payload?.[fieldId] || payload?.[field.id] || "";
}

function completedRecordSourceWorkItemId(item, card, ctx) {
  const payload = completedRecordPayload(item, card, ctx);
  const candidates = [
    payload.operationsWorkItemId,
    payload.sourceWorkItemId,
    ctx.state.lastActionResult?.workspaceId === item.id && ctx.state.lastActionResult?.cardId === card.id
      ? ctx.state.selectedWorkItemId
      : "",
    ...runtimeItemsForRecord(ctx.state)
      .filter((workItem) => workItemWorkspaceId(workItem) === item.id && workItemCardId(workItem) === card.id)
      .map(workItemIdForRecord),
    card.workItemId
  ];
  return candidates.find((id) => isPersistedOperationsWorkItemId(id)) || "";
}

function runtimeItemsForRecord(state = {}) {
  return [
    ...(state.runtimeStore?.operationWorkItems || []),
    ...(state.runtimeStore?.workQueue || [])
  ];
}

function workItemIdForRecord(item = {}) {
  return item.workItemId || item.work_item_id || "";
}

function workItemWorkspaceId(item = {}) {
  return item.workspaceId || item.workspace_id || item.workspace?.id || "";
}

function workItemCardId(item = {}) {
  return item.cardId || item.card_id || item.payload?.cardId || item.Payload?.cardId || item.card?.id || "";
}

function isPersistedOperationsWorkItemId(value = "") {
  const id = String(value || "");
  return id && !id.startsWith("T-");
}

function displayFieldValue(field, value, ctx) {
  const options = optionsForField(field, ctx.state.lang);
  const matched = options.find((entry) => String(entry.value) === String(value));
  return matched ? ctx.localTerm(matched.label) : ctx.localTerm(value);
}

function completedRecordPayload(item, card, ctx) {
  const snapshot = loadCompletedRecordSnapshot(item.id, card.id, {
    workItemId: card.workItemId || ctx.state.selectedWorkItemId || ""
  });
  return mergeRecordValues(
    loadDraft(item.id, card.id).values || {},
    ctx.state.lastActionResult?.workspaceId === item.id && ctx.state.lastActionResult?.cardId === card.id
      ? ctx.state.lastActionResult.fieldValues || {}
      : {},
    snapshot?.values || {},
    ...completedEventPayloads(item, card, ctx)
  );
}

function completedEventPayloads(item, card, ctx) {
  return sameWorkspaceEvents(item, ctx)
    .filter((event) => event.cardId === card.id && event.payload)
    .map((event) => flattenCompletedPayload(event.payload));
}

function flattenCompletedPayload(payload = {}) {
  return mergeRecordValues(
    objectMap(payload.input?.fieldValues),
    objectMap(payload.input?.FieldValues),
    objectMap(payload.Input?.fieldValues),
    objectMap(payload.Input?.FieldValues),
    objectMap(payload.fieldValues),
    objectMap(payload.FieldValues),
    objectMap(payload)
  );
}

function objectMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function mergeRecordValues(...sources) {
  return sources.reduce((current, source = {}) => {
    for (const [key, value] of Object.entries(source || {})) {
      if (!hasCarryValue(value)) continue;
      current[key] = String(value);
    }
    return current;
  }, {});
}

function operationStepDebugTabs(item, activeCard, ctx) {
  if (!debugToolsVisible(ctx)) return "";
  return `<section class="operation-step-debug-tabs" data-component="OperationStepDebugTabs">
    <span>Debug / Operations steps</span>
    <div class="card-tabs">${item.cards.map((card, index) => `<button class="${card.id === activeCard.id ? "active" : ""} ${card.status}" data-card-index="${index}">${ctx.tx(card.title)}</button>`).join("")}</div>
  </section>`;
}

function debugToolsVisible(ctx) {
  const role = ctx.state?.currentActor?.role || "";
  return Boolean(ctx.state?.debugSurface || ["admin", "support", "audit"].includes(role));
}

export function workspaceCard(item, ctx, cardId = "") {
  if (!item) return "";
  const activeCard = activeCardForWorkspace(item);
  return `<article class="workspace-card ${item.domain}">
    <div class="loop-head">
      <div><span>${ctx.tr(item.domain)} · ${ctx.tr("intentWorkspace")}</span><strong>${ctx.tx(item.title)}</strong></div>
      <button data-workspace="${item.id}" data-card-id="${cardId || activeCard.id}">${ctx.tr("openWorkspace")}</button>
    </div>
    <p>${ctx.tx(item.summary)}</p>
    <div class="workspace-card-strip">${item.cards.map((card) => `<span class="${card.status}">${ctx.tx(card.title)}</span>`).join("")}</div>
    <div class="loop-meta">
      <span>${ctx.tx(activeCard.title)} · ${ctx.tr(activeCard.status)}</span>
      <span>${ctx.tr("nextBestAction")}: ${ctx.tx(item.next)}</span>
    </div>
  </article>`;
}

export function workspaceCardPanel(card, item, expanded, ctx) {
  return expanded || ["ready", "blocked", "inProgress"].includes(card.status)
    ? OperationCardShell(card, item, ctx)
    : "";
}

export function OperationCardShell(card, item, ctx) {
  return cardOperation(card, item, ctx);
}

export function cardOperation(card, item, ctx) {
  const disabled = isCardActionDisabled(card) ? "disabled" : "";
  const visibleBlockers = activeBlockers(item, card);
  const statusHelp = cardStatusHelp(card, ctx);
  const draft = loadDraft(item.id, card.id);
  const fields = operationInputFields(card, ctx, item);
  if (isTerminalCardStatus(card.status)) {
    return `<div class="card-operation completed-operation" data-component="operation-card-shell">
      <span>${ctx.tr("completedRecordTitle")}</span>
      <h3>${ctx.tx(card.title)}</h3>
      <section class="operation-state"><b>${ctx.tr(card.status)}</b><p>${statusHelp}</p></section>
      <section><b>${ctx.tr("cardNext")}</b><p>${ctx.tr("cardNextHelp")} ${nextCardTitle(card, item, ctx)}</p></section>
      <section><b>${ctx.tr("nextBestAction")}</b><p>${ctx.tr("nextBestActionHelp")} ${ctx.tx(item.next)}</p></section>
    </div>`;
  }
  if (card.status === "notStarted") {
    return `<div class="card-operation pending-operation" data-component="operation-card-shell">
      <span>${ctx.tr("cardOperation")}</span>
      <h3>${ctx.tx(card.title)}</h3>
      <section class="operation-state"><b>${ctx.tr(card.status)}</b><p>${statusHelp}</p></section>
    </div>`;
  }
  return `<div class="card-operation" data-component="operation-card-shell">
    <span>${ctx.tr("cardOperation")}</span>
    <h3>${ctx.tx(card.title)}</h3>
    ${statusHelp ? `<section class="operation-state"><b>${ctx.tr(card.status)}</b><p>${statusHelp}</p></section>` : ""}
    <section class="operation-guidance"><b>${ctx.tr("cardAction")}</b><p>${operationActionText(card, item, ctx)}</p></section>
    ${fields.length ? `<section class="operation-input-section" data-surface="operation-form">
      <b>${ctx.tr("cardInput")}</b>
      <div class="operation-inputs">${fields.map((field) => operationControl(field, item, card, disabled, ctx)).join("")}</div>
    </section>` : ""}
    ${systemValidationPanel(card, item, draft, visibleBlockers, ctx)}
    ${checkoutServiceOperationAddon(card, item, ctx)}
    ${visibleBlockers.length ? `<section class="operation-blockers"><b>${ctx.tr("blockers")}</b><p>${visibleBlockers.map((entry) => ctx.tx(entry.title)).join(" · ")}</p></section>` : ""}
    <div class="operation-actions">
      <button class="secondary" data-save-draft ${disabled}>${ctx.tr("saveDraft")}</button>
    </div>
    ${inlineOperationMessage(card, item, ctx)}
  </div>`;
}

function inlineOperationMessage(card, item, ctx) {
  const message = ctx.state.operationMessage || "";
  if (!message) return "";
  const result = ctx.state.lastActionResult;
  if (result?.message === message || isSubmitResultMessage(message, ctx)) {
    return "";
  }
  return `<p class="operation-message">${ctx.escapeHtml(message)}</p>`;
}

function isSubmitResultMessage(message, ctx) {
  return [
    "submitting",
    "submitDone",
    "submitProjectionPending",
    "submitProjectionFailed"
  ].some((key) => message === ctx.tr(key));
}

function activeBlockers(item, card) {
  if (card?.status !== "blocked") return [];
  return card.blockerRules?.length ? card.blockerRules : item.blockers || [];
}

export function primaryActionButton(actionState, ctx) {
  const action = actionState.primaryAction;
  const disabled = action.disabled ? "disabled" : "";
  const title = action.reasonKey ? ` title="${ctx.escapeAttr(ctx.tr(action.reasonKey))}"` : "";
  const submit = ["ready", "readyObservation", "missingRequiredFields"].includes(actionState.status) ? "data-submit-card" : `data-action-state="${ctx.escapeAttr(actionState.status)}"`;
  return `<button class="primary-action ${ctx.escapeAttr(actionState.status)}" ${submit} ${disabled}${title}>${ctx.tr(action.labelKey)}</button>`;
}

export function cardStatusHelp(card, ctx) {
  if (isTerminalCardStatus(card.status)) return ctx.tr("completedCardHelp");
  if (card.status === "notStarted") return ctx.tr("notReadyCardHelp");
  return "";
}

export function confirmationText(card, item, ctx) {
  if (card.status === "blocked") return ctx.tx(item.next);
  return `${ctx.tr("cardConfirmHelp")} ${ctx.tr("confirmationDraft")} ${ctx.state.lang === "zh-CN" ? "所需角色" : "Роль"}: ${card.Confirmation?.requiredRole || card.confirmation?.requiredRole || "-"}.`;
}

export function operationActionText(card, item, ctx) {
  if (card.id === "activate") {
    return ctx.state.lang === "zh-CN"
      ? "确认房间和床位检查通过，把资源从建档状态切换为可分配状态。不会自动分配给入住人。"
      : "Подтвердите проверку комнаты и койки, затем переведите ресурс в доступный для назначения статус.";
  }
  if (card.status === "blocked") return ctx.tx(item.next);
  return ctx.state.lang === "zh-CN"
    ? `把这一步需要的信息填完整。不能提交时，页面会直接标出还差哪一项。`
    : `Заполните данные для этого шага. Если отправка невозможна, страница покажет, чего не хватает.`;
}

export function operationControl(field, item, card, disabled, ctx) {
  const fieldId = operationFieldId(field);
  const fieldState = operationFieldState(field, item, card, ctx);
  const value = fieldState.value;
  const kind = fieldControlKind(field);
  const options = optionsForField(field, ctx.state.lang);
  const help = operationFieldHelp(field, fieldId, card, ctx);
  const missing = missingFieldIdsFor(card, item, ctx).includes(fieldId);
  const requiredForOperation = operationFieldRequired(field, card, item, ctx);
  const required = requiredForOperation ? `required aria-required="true" data-required-field="true"` : "";
  const invalid = missing ? `aria-invalid="true" data-validation-state="missing"` : "";
  const carriedReadonly = isCaseContextReadonlyField(fieldId, card);
  const forcedReadonly = isForcedCaseContextReadonlyField(fieldId, card);
  const labelClass = ["operation-field", requiredForOperation ? "required" : "", missing ? "field-error" : "", forcedReadonly || fieldState.source === "caseContext" ? "context-carried" : "", fieldState.source === "derived" ? "system-derived" : ""].filter(Boolean).join(" ");
  const label = operationFieldLabel(field, fieldId, card, ctx, requiredForOperation);
  if (carriedReadonly && (forcedReadonly || fieldState.source === "caseContext")) {
    return contextCarriedControl(field, fieldId, fieldState, labelClass, label, required, invalid, ctx);
  }
  if (isBedSetupCardId(card.id) && fieldId === "bedLabels") {
    return bedLayoutDerivedControl(field, item, card, labelClass, label, value, required, invalid, disabled, help, ctx);
  }
  if (kind === "searchSelect") return `<label class="${labelClass} search-select"><span>${label} · ${ctx.tr("searchableSelect")}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" list="${ctx.escapeAttr(fieldId)}Options" value="${ctx.escapeAttr(value)}" ${required} ${invalid} ${disabled} /><datalist id="${ctx.escapeAttr(fieldId)}Options">${options.map((entry) => `<option value="${ctx.escapeAttr(entry.value)}" label="${ctx.escapeAttr(entry.label)}">`).join("")}</datalist>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "select" && fieldId === "resourceScope") {
    return segmentedOperationControl(fieldId, labelClass, label, value, options, required, invalid, disabled, help, ctx);
  }
  if (kind === "select") {
    const placeholder = value ? "" : `<option value="" selected disabled>${ctx.tr("selectPlaceholder")}</option>`;
    return `<label class="${labelClass}"><span>${label}</span><select data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" ${required} ${invalid} ${disabled}>${placeholder}${options.map((entry) => `<option value="${ctx.escapeAttr(entry.value)}" ${entry.value === value ? "selected" : ""}>${ctx.escapeHtml(entry.label)}</option>`).join("")}</select>${help ? `<small>${help}</small>` : ""}</label>`;
  }
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return `<label class="${labelClass}"><span>${label}</span><div class="datetime-range"><input data-operation-field-start="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${ctx.escapeAttr(start)}" ${required} ${invalid} ${disabled} /><input data-operation-field-end="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${ctx.escapeAttr(end)}" ${required} ${invalid} ${disabled} /></div>${help ? `<small>${help}</small>` : ""}</label>`;
  }
  if (kind === "dateTime") return `<label class="${labelClass}"><span>${label}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${ctx.escapeAttr(value)}" ${required} ${invalid} ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "readonly") return `<label class="${labelClass}"><span>${label}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" value="${ctx.escapeAttr(value)}" readonly ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "textarea") return `<label class="${labelClass}"><span>${label}</span><textarea data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" rows="3" ${required} ${invalid} ${disabled}>${ctx.escapeHtml(value)}</textarea>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "number") {
    const readonly = isDerivedReadonlyField(field) ? `readonly data-derived-from="${field.ui?.derivedFrom || ""}"` : "";
    return `<label class="${labelClass}"><span>${label}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" type="number" inputmode="decimal" value="${ctx.escapeAttr(value)}" ${readonly} ${required} ${invalid} ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  }
  return `<label class="${labelClass}"><span>${label}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" value="${ctx.escapeAttr(value)}" ${required} ${invalid} ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
}

function segmentedOperationControl(fieldId, labelClass, label, value, options, required, invalid, disabled, help, ctx) {
  const buttons = options.map((entry) => {
    const selected = String(entry.value) === String(value);
    return `<button type="button" class="operation-segment${selected ? " active" : ""}" data-operation-field-button="${ctx.escapeAttr(fieldId)}" data-value="${ctx.escapeAttr(entry.value)}" aria-pressed="${selected ? "true" : "false"}" ${disabled}>${ctx.escapeHtml(entry.label)}</button>`;
  }).join("");
  return `<div class="${labelClass} segmented-operation-field" ${invalid}>
    <span>${label}</span>
    <input type="hidden" data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" value="${ctx.escapeAttr(value)}" ${required} ${invalid} />
    <div class="operation-segmented-control" role="group" aria-label="${ctx.escapeAttr(ctx.tr("selectPlaceholder"))}">${buttons}</div>
    ${help ? `<small>${help}</small>` : ""}
  </div>`;
}

function bedLayoutDerivedControl(field, item, card, labelClass, label, value, required, invalid, disabled, help, ctx) {
  const values = operationDraftValues(item, card);
  const bedCountField = (card.fields?.business || []).find((candidate) => operationFieldId(candidate) === "bedCount") || { id: "bedCount", label: { "zh-CN": "床位数" } };
  const bedTypeField = (card.fields?.business || []).find((candidate) => operationFieldId(candidate) === "bedType") || { id: "bedType", label: { "zh-CN": "床铺生成方式" } };
  const bedCount = operationFieldState(bedCountField, item, card, ctx).value || values.bedCount || "";
  const pattern = operationFieldState(bedTypeField, item, card, ctx).value || defaultBedTypeForCount(bedCount);
  const labelsValue = value || generatedBedLabelsForCount(bedCount);
  const layout = bedLayoutForLabels(labelsValue, pattern, ctx.state.lang);
  const layoutValue = serializeBedLayout(layout);
  const chips = layout.map((entry) =>
    `<span class="bed-layout-chip" data-bed-label="${ctx.escapeAttr(entry.label)}" data-bed-type="${ctx.escapeAttr(entry.type)}">${ctx.escapeHtml(entry.label)} · ${ctx.escapeHtml(entry.typeLabel)}</span>`
  ).join("");
  return `<div class="${labelClass} bed-layout-derived" ${invalid} data-bed-layout-derived>
    <span>${label}</span>
    <input type="hidden" data-operation-field="bedLabels" data-field-id="bedLabels" value="${ctx.escapeAttr(labelsValue)}" ${required} ${invalid} ${disabled} />
    <input type="hidden" data-operation-field="bedLayout" data-field-id="bedLayout" value="${ctx.escapeAttr(layoutValue)}" ${disabled} />
    <div class="bed-layout-preview" data-bed-layout-preview aria-live="polite">${chips || `<span class="bed-layout-empty">${ctx.escapeHtml(ctx.tr("bedLayoutEmpty"))}</span>`}</div>
    ${help ? `<small data-bed-layout-help>${help}</small>` : ""}
  </div>`;
}

function contextCarriedControl(field, fieldId, fieldState, labelClass, label, required, invalid, ctx) {
  const displayValue = fieldState.displayValue || displayFieldValue(field, fieldState.value, ctx);
  return `<label class="${labelClass}">
    <span>${label}</span>
    <input value="${ctx.escapeAttr(displayValue)}" readonly aria-readonly="true" ${invalid} />
    <input type="hidden" data-operation-field="${ctx.escapeAttr(fieldId)}" value="${ctx.escapeAttr(fieldState.value)}" ${required} />
    <small>${ctx.tr("caseContextAutoFilledHelp")}</small>
  </label>`;
}

function operationFieldLabel(field, fieldId, card, ctx, requiredForOperation = field.required) {
  const required = requiredForOperation ? `<em class="required-mark">${ctx.tr("requiredMark")}</em>` : "";
  if (isBedSetupCardId(card?.id) && fieldId === "bedType") {
    return `${ctx.tr("bedTypeTemplateLabel")}${required}`;
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedLabels") {
    return `${ctx.tr("bedLayoutPreviewLabel")}${required}`;
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedStatus") {
    return `${ctx.tr("bedStatusTemplateLabel")}${required}`;
  }
  return `${ctx.localTerm(field)}${required}`;
}

function operationFieldHelp(field, fieldId, card, ctx) {
  if (isBedSetupCardId(card?.id) && fieldId === "bedType") {
    return ctx.tr("bedTypeTemplateHelp");
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedLabels") {
    return ctx.tr("bedLayoutGeneratedHelp");
  }
  if (isBedSetupCardId(card?.id) && fieldId === "bedStatus") {
    return ctx.tr("bedStatusTemplateHelp");
  }
  return ctx.tx(field.help);
}

function systemValidationPanel(card, item, draft, visibleBlockers, ctx) {
  const evidenceStates = (card.evidence || []).map((field) =>
    EvidenceStateVM(field, (draft.evidenceDrafts || []).find((item) => item.requirementId === field.id), ctx));
  const evidenceNames = evidenceStates.map((state) => businessCheckName(state.name)).filter(Boolean);
  const checkNames = (card.checks || []).map((entry) => businessCheckName(ctx.localTerm(entry))).filter(Boolean);
  const missingLabels = currentMissingRequiredLabels(card, item, ctx);
  const missingContextLabels = currentMissingContextLabels(card, item, ctx);
  const stepCheck = stepDependencyValidationChips(card, item, ctx);
  const submitStatus = missingContextLabels.length
    ? `${ctx.tr("cannotSubmitYet")}: ${ctx.tr("upstreamContextMissing")}`
    : missingLabels.length
    ? `${ctx.tr("cannotSubmitYet")}: ${ctx.tr("requiredFieldsMissing")}`
    : visibleBlockers.length
    ? `${ctx.tr("cannotSubmitYet")}: ${visibleBlockers.map((entry) => ctx.tx(entry.title)).join(" · ")}`
    : ctx.tr("readyToSubmit");
  const detailChips = [
    ...(stepCheck.length ? stepCheck : [`${ctx.tr(missingLabels.length ? "requiredFieldsMissing" : "requiredFields")}: ${missingLabels.length ? missingLabels.join(" · ") : ctx.tr("systemCheckReady")}`]),
    `${ctx.tr("systemEvidenceCheck")}: ${evidenceNames.length ? evidenceNames.join(" · ") : ctx.tr("noRequiredEvidence")}`,
    `${ctx.tr("submitStatus")}: ${submitStatus}`,
    checkNames.length ? `${ctx.tr("systemRules")}: ${checkNames.slice(0, 3).join(" · ")}` : ""
  ].filter(Boolean);
  const actionChips = [
    missingContextLabels.length ? `${ctx.tr("upstreamContextMissing")}: ${missingContextLabels.join("、")}` : "",
    missingLabels.length ? `${ctx.tr("requiredFieldsMissing")}: ${missingLabels.join("、")}` : "",
    visibleBlockers.length ? visibleBlockers.map((entry) => ctx.tx(entry.title)).join("、") : ""
  ].filter(Boolean);
  const hasError = missingLabels.length || missingContextLabels.length;
  return `<section class="system-check-panel${hasError ? " has-error" : ""}" data-surface="system-validation-summary">
    <b>${ctx.tr("systemValidation")}</b>
    <p>${actionChips.length ? ctx.tr("systemValidationHelp") : ctx.tr("readyToSubmit")}</p>
    ${actionChips.length ? `<div>${actionChips.map((chip) => `<span>${ctx.escapeHtml(chip)}</span>`).join("")}</div>` : ""}
    <details class="system-check-details">
      <summary>${ctx.tr("systemCheckDetails")}</summary>
      <div>${detailChips.map((chip) => `<span>${ctx.escapeHtml(chip)}</span>`).join("")}</div>
    </details>
  </section>`;
}

function businessCheckName(name = "") {
  return String(name || "")
    .replace("房间重复校验", "房间是否重复")
    .replace("配置人记录", "记录办理人")
    .replace("系统规则", "业务规则")
    .replace("校验", "确认");
}

function workspaceLensPanel(item, ctx) {
  const lenses = lensIdsForWorkspace(item.id)
    .map((lensId) => ({ lensId, items: ctx.state.accommodationLenses?.[lensId] || [] }))
    .filter((entry) => entry.items.length);
  if (!lenses.length) return "";
  return `<section class="runtime-lenses">
    <b>${ctx.tr("runtimeLens")}</b>
    <div>${lenses.map((entry) => `<article><span>${lensTitle(entry.lensId, ctx.state.lang)}</span><strong>${entry.items.length}</strong><small>${lensPreview(entry.lensId, entry.items)}</small></article>`).join("")}</div>
  </section>`;
}

export function nextCardTitle(card, item, ctx) {
  const index = item.cards.findIndex((entry) => entry.id === card.id);
  const next = item.cards[index + 1];
  return next ? ctx.tx(next.title) : ctx.tr("finish");
}
