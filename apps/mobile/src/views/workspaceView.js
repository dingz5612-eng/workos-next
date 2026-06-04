import { generatedBedLabelsForCount, splitBedLabels } from "../controls/bedLabelControls.js";
import { capacityForRoomType, defaultValueForField, fieldControlKind, isDerivedReadonlyField, optionsForField } from "../controls/fieldControls.js";
import { isScopedResourceFieldRequired, isScopedResourceFieldVisible } from "../controls/resourceScopeControls.js";
import { loadCompletedRecordSnapshot, loadDraft } from "../operationDrafts.js";
import { completedRecordActionPolicy } from "../operationRecordPolicy.js";
import { lensIdsForWorkspace, lensPreview, lensTitle } from "../runtimeLensCatalog.js";
import { buildOperationActionState } from "../operationActionState.js";
import { isUnsafeLedgerCarryForward } from "../selectors/surfaceSelectors.js";
import { activeCardForWorkspace, activeWorkspaceCard, isCardActionDisabled, isTerminalCardStatus } from "../selectors/workspaceSelectors.js";
import { checkoutServiceMobilePanel, checkoutServiceOperationAddon } from "./checkoutServiceView.js";
import { EvidenceStateVM, OperationStepRail } from "./experienceComponents.js";

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
  const actionState = buildOperationActionState({ workspace: item, workspaceId: item.id, cardId: activeCard.id }, activeCard, ctx.state.lastActionResult, ctx.state);
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
    const hasSubmittedValue = hasCarryValue(values[fieldId]) || hasCarryValue(values[field.id]);
    const fallbackVisible = hasSubmittedValue ||
      Boolean(field.required) ||
      !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN"));
    return isScopedResourceFieldVisible(card?.id, fieldId, values, fallbackVisible);
  });
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
    ${ctx.state.operationMessage ? `<p class="operation-message">${ctx.escapeHtml(ctx.state.operationMessage)}</p>` : ""}
  </div>`;
}

function activeBlockers(item, card) {
  if (card?.status !== "blocked") return [];
  return card.blockerRules?.length ? card.blockerRules : item.blockers || [];
}

export function primaryActionButton(actionState, ctx) {
  const action = actionState.primaryAction;
  const disabled = action.disabled ? "disabled" : "";
  const title = action.reasonKey ? ` title="${ctx.escapeAttr(ctx.tr(action.reasonKey))}"` : "";
  const submit = ["ready", "missingRequiredFields"].includes(actionState.status) ? "data-submit-card" : `data-action-state="${ctx.escapeAttr(actionState.status)}"`;
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

export function operationInputFields(card, ctx, item = null) {
  return (card.fields?.business || []).filter((field) => operationFieldVisible(field, card, item, ctx));
}

export function operationControl(field, item, card, disabled, ctx) {
  const fieldId = operationFieldId(field);
  const fieldState = operationFieldState(field, item, card, ctx);
  const value = fieldState.value;
  const kind = fieldControlKind(field);
  const options = optionsForField(field, ctx.state.lang);
  const help = ctx.tx(field.help);
  const missing = missingFieldIdsFor(card, item, ctx).includes(fieldId);
  const requiredForOperation = operationFieldRequired(field, card, item, ctx);
  const required = requiredForOperation ? `required aria-required="true" data-required-field="true"` : "";
  const invalid = missing ? `aria-invalid="true" data-validation-state="missing"` : "";
  const labelClass = ["operation-field", requiredForOperation ? "required" : "", missing ? "field-error" : "", fieldState.source === "caseContext" ? "context-carried" : ""].filter(Boolean).join(" ");
  const label = fieldLabel(field, ctx, requiredForOperation);
  if (fieldState.source === "caseContext" && isCaseContextIdentityField(fieldId)) {
    return contextCarriedControl(field, fieldId, fieldState, labelClass, label, required, invalid, ctx);
  }
  if (kind === "searchSelect") return `<label class="${labelClass} search-select"><span>${label} · ${ctx.tr("searchableSelect")}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" list="${ctx.escapeAttr(fieldId)}Options" value="${ctx.escapeAttr(value)}" ${required} ${invalid} ${disabled} /><datalist id="${ctx.escapeAttr(fieldId)}Options">${options.map((entry) => `<option value="${ctx.escapeAttr(entry.value)}" label="${ctx.escapeAttr(entry.label)}">`).join("")}</datalist>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "select" && fieldId === "resourceScope") {
    return segmentedOperationControl(fieldId, labelClass, label, value, options, required, invalid, disabled, help, ctx);
  }
  if (kind === "select") {
    return `<label class="${labelClass}"><span>${label}</span><select data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" ${required} ${invalid} ${disabled}>${options.map((entry) => `<option value="${ctx.escapeAttr(entry.value)}" ${entry.value === value ? "selected" : ""}>${ctx.escapeHtml(entry.label)}</option>`).join("")}</select>${help ? `<small>${help}</small>` : ""}</label>`;
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

function contextCarriedControl(field, fieldId, fieldState, labelClass, label, required, invalid, ctx) {
  const displayValue = fieldState.displayValue || displayFieldValue(field, fieldState.value, ctx);
  return `<label class="${labelClass}">
    <span>${label}<em class="context-mark">${ctx.tr("caseContextAutoFilled")}</em></span>
    <input value="${ctx.escapeAttr(displayValue)}" readonly aria-readonly="true" ${invalid} />
    <input type="hidden" data-operation-field="${ctx.escapeAttr(fieldId)}" value="${ctx.escapeAttr(fieldState.value)}" ${required} />
    <small>${ctx.tr("caseContextAutoFilledHelp")}</small>
  </label>`;
}

function isCaseContextIdentityField(fieldId) {
  return ["roomId", "bedId", "stayId", "residentId", "reservationId", "leadId", "depositId", "depositReceiptId", "paymentId", "chargeId", "taskId", "expenseId", "periodId"].includes(fieldId);
}

export function operationValue(field, item, card, ctx) {
  return operationFieldState(field, item, card, ctx).value;
}

function operationFieldState(field, item, card, ctx) {
  const draft = loadDraft(item.id, card.id);
  const values = draft.values || {};
  const fieldId = operationFieldId(field);
  if (values[fieldId]) return { value: values[fieldId], source: "draft" };
  if (values[field.id]) return { value: values[field.id], source: "draft" };
  if (fieldId === "amount") {
    const derivedAmount = derivedChargeAmount(item, ctx, values);
    if (derivedAmount) return { value: derivedAmount, source: "derived" };
  }
  if (fieldId === "refundAmount") {
    const derivedRefundAmount = derivedDepositRefundAmount(item, ctx, values);
    if (derivedRefundAmount) return { value: derivedRefundAmount, source: "derived" };
  }
  const carried = carriedForwardValue(field, item, card, values, ctx);
  if (carried) return { value: carried.value, displayValue: carried.displayValue, source: "caseContext" };
  if (fieldId === "bedLabels") {
    const bedCount = values.bedCount || carriedForwardValue({ id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, values, ctx)?.value || "";
    return { value: generatedBedLabelsForCount(bedCount), source: "derived" };
  }
  if (field.ui?.derivedFrom === "roomType") {
    const roomType = Object.entries(values).find(([, candidate]) => ["single", "double", "four_bed", "six_bed", "单人间", "双人间", "四人间", "六人间"].includes(candidate))?.[1] || "four_bed";
    return { value: capacityForRoomType(roomType), source: "derived" };
  }
  return { value: defaultValueForField(field), source: "default" };
}

function derivedChargeAmount(item, ctx, values = {}) {
  const draftUnitRate = Number(values.unitRate || values["单价"] || 0);
  const draftQuantity = Number(values.tariffQuantity || values["天数/周数/月数"] || values["计费数量"] || 0);
  if (draftUnitRate > 0 && draftQuantity > 0) {
    return String(draftUnitRate * draftQuantity);
  }
  const events = (ctx.state.projectionEvents || [])
    .filter((event) => event.workspaceId === item.id && event.payload)
    .slice()
    .reverse();
  for (const event of events) {
    const unitRate = Number(event.payload.unitRate || 0);
    const quantity = Number(event.payload.tariffQuantity || 0);
    if (unitRate > 0 && quantity > 0) {
      return String(unitRate * quantity);
    }
  }
  return "";
}

function derivedDepositRefundAmount(item, ctx, values = {}) {
  const events = (ctx.state.projectionEvents || [])
    .filter((event) => event.workspaceId === item.id && event.payload)
    .slice()
    .reverse();
  let confirmed = 0;
  let deducted = 0;
  let applied = 0;
  let paid = 0;
  for (const event of events) {
    if (event.eventType === "Accommodation.DepositConfirmed") confirmed += Number(event.payload.confirmedAmount || 0);
    if (event.eventType === "Accommodation.DepositDeducted") deducted += Number(event.payload.deductionAmount || 0);
    if (event.eventType === "Accommodation.DepositAppliedToBalance") applied += Number(event.payload.applyToBalanceAmount || 0);
    if (event.eventType === "Accommodation.DepositRefundPaid") paid += Number(event.payload.refundAmount || 0);
  }
  const draftDeduction = Number(values.deductionAmount || values["扣除金额"] || 0);
  const draftApplyToBalance = Number(values.applyToBalanceAmount || values["抵扣欠款金额"] || 0);
  const available = confirmed - deducted - applied - paid - draftDeduction - draftApplyToBalance;
  return available > 0 ? String(available) : "";
}

export function operationFieldId(field) {
  const aliases = {
    "楼栋": "buildingName",
    "楼栋/地点": "buildingName",
    "房间号": "roomNo",
    "房型": "roomType",
    "房间类型": "roomType",
    "容量": "capacity",
    "床位数": "bedCount",
    "性别策略": "genderPolicy",
    "家具状态": "furnitureStatus",
    "技术状态": "technicalState",
    "房间备注": "roomNote",
    "所属房间": "roomId",
    "房间": "roomId",
    "关联房间": "roomId",
    "床位": "bedId",
    "关联床位": "bedId",
    "床位号": "bedNo",
    "床位标签": "bedLabels",
    "床位标签清单": "bedLabels",
    "上/下铺": "bedType",
    "床位类型": "bedType",
    "初始床位状态": "bedStatus",
    "床位状态": "bedStatus",
    "阻断原因": "blockedReason",
    "价格规则": "ratePlanId",
    "每床日价": "dailyRatePerBed",
    "每床周价": "weeklyRatePerBed",
    "每床月价": "monthlyRatePerBed",
    "币种": "currency",
    "生效日期": "effectiveFrom",
    "价格备注": "rateNote",
    "可售状态": "availabilityStatus",
    "任务": "taskId",
    "关联任务": "taskId",
    "服务范围": "resourceScope",
    "阻断范围": "resourceScope",
    "释放范围": "resourceScope",
    "阻断开始时间": "blockStartAt",
    "预计恢复时间": "expectedReleaseAt",
    "恢复可售时间": "releaseAvailableAt",
    "准备备注": "readinessNote",
    "阻断备注": "blockNote",
    "释放备注": "releaseNote",
    "通讯方式": "contactChannel",
    "期望入住日期": "expectedCheckInDate",
    "预算金额": "budgetAmount",
    "线索备注": "leadNote",
    "备注": "note",
    "跟进日期": "followUpDate",
    "跟进结果": "followUpResult",
    "下一次跟进时间": "nextFollowUpAt",
    "是否需要预订押金": "reservationDepositRequired",
    "预订押金金额": "reservationDepositAmount",
    "预订备注": "reservationNote",
    "取消原因": "cancelReason",
    "取消备注": "cancelNote",
    "转入住日期": "convertedAt",
    "转换备注": "conversionNote",
    "实际入住时间": "checkInDate",
    "钥匙物品交接": "handoverStatus",
    "钥匙/物品交接": "handoverStatus",
    "住客状态": "residentStatus",
    "住客备注": "residentNote",
    "紧急联系人": "emergencyContactName",
    "紧急联系电话": "emergencyContactPhone",
    "入住周期": "stayPeriod",
    "床位锁定备注": "bedLockNote",
    "计费方式": "tariffType",
    "单价": "unitRate",
    "计费数量": "tariffQuantity",
    "天数/周数/月数": "tariffQuantity",
    "应收金额": "amount",
    "应收备注": "chargeNote",
    "续住原因": "extensionReason",
    "续住备注": "extensionNote",
    "押金截止日期": "depositDueAt",
    "押金截止时间": "depositDueAt",
    "是否允许免押": "depositWaiverAllowed",
    "免押原因": "depositWaiverReason",
    "押金单": "depositId",
    "扣除金额": "deductionAmount",
    "抵扣欠款金额": "applyToBalanceAmount",
    "应退金额": "refundAmount",
    "退款方式": "refundMethod",
    "退款接收人": "refundReceiver",
    "退款凭证": "refundEvidenceId",
    "付款时间": "paymentTime",
    "人工确认摘要": "manualConfirmSummary",
    "押金收款备注": "depositReceiptNote",
    "关闭结果": "closeResult",
    "覆盖周期开始": "coverageStart",
    "覆盖周期结束": "coverageEnd",
    "到账时间": "confirmedAt",
    "财务确认人": "financeReviewer",
    "财务备注": "financeNote",
    "处理意见": "handlingOpinion",
    "覆盖应收项": "coveredChargeIds",
    "分配备注": "allocationNote",
    "调整金额": "adjustmentAmount",
    "调整原因": "adjustmentReason",
    "欠款原因": "debtReason",
    "退房人": "checkoutPerson",
    "退房原因": "checkoutReason",
    "预计退房时间": "plannedCheckOutAt",
    "实际退住日期": "actualCheckOutDate",
    "退住原因": "checkoutReason",
    "是否发现损坏": "damageFound",
    "损坏说明": "damageDescription",
    "物品/损坏检查": "damageInspection",
    "物品损坏检查": "damageInspection",
    "照片证据": "photoEvidenceId",
    "查房凭证": "inspectionEvidenceId",
    "住宿费用": "stayFeeAmount",
    "额外费用": "extraFeeAmount",
    "押金抵扣": "depositDeductionAmount",
    "押金扣除金额": "depositDeductionAmount",
    "押金抵欠金额": "depositApplyToBalanceAmount",
    "应退/应补": "refundOrSupplementAmount",
    "应退应补": "refundOrSupplementAmount",
    "退款/补款确认": "refundOrSupplementConfirmation",
    "退款补款确认": "refundOrSupplementConfirmation",
    "财务凭证": "financeEvidenceId",
    "确认人": "confirmer",
    "释放床位": "releaseBed",
    "关闭住宿单": "closeStayOrder",
    "任务日期": "taskDate",
    "区域": "area",
    "问题描述": "issueDescription",
    "处理措施": "resolutionAction",
    "目标完成日期": "targetCompletionDate",
    "任务凭证": "taskEvidenceId",
    "优先级": "priority",
    "分派备注": "assignmentNote",
    "复盘结论": "reviewConclusion",
    "后续行动": "nextAction",
    "处理状态": "processingStatus",
    "完成日期": "completedAt",
    "关联支出": "expenseId",
    "完成凭证": "completionEvidenceId",
    "验收备注": "verificationNote",
    "年份": "periodYear",
    "周期编号": "periodNo",
    "周期开始时间": "periodStartAt",
    "周期结束时间": "periodEndAt",
    "周期说明": "periodDescription",
    "经营周期": "periodId",
    "指标快照备注": "metricsSnapshotNote",
    "财务复核结果": "financeReviewResult",
    "财务复核备注": "financeReviewNote",
    "主要问题分类": "primaryIssueCategory",
    "主要问题": "primaryIssue",
    "根因分析": "rootCauseAnalysis",
    "诊断置信度": "diagnosisConfidence",
    "行动标题": "actionTitle",
    "行动类型": "actionType",
    "目标指标": "targetMetric",
    "目标值": "targetValue",
    "截止日期": "dueAt",
    "行动状态": "actionStatus",
    "行动计划": "actionPlanId",
    "完成备注": "completionNote",
    "管理结论": "managementConclusion",
    "下一周期重点": "nextPeriodFocus",
    "指标已复核": "metricsReviewed",
    "财务已复核": "financeReviewed",
    "运营已诊断": "operationsDiagnosed",
    "行动计划已提交": "actionPlanCommitted",
    "行动计划已跳过": "actionPlanSkipped",
    "无阻断不变量": "noBlockingInvariantViolation",
    "业务签署完成": "businessSignoffCompleted",
    "行动计划数量": "actionPlanCount",
    "阻断问题数量": "blockingIssueCount",
    "阻断不变量数量": "blockingInvariantViolationCount"
  };
  return aliases[field.id] || aliases[field.label?.["zh-CN"]] || field.id;
}

function carriedForwardValue(field, item, card, values, ctx) {
  const fieldId = operationFieldId(field);
  if (isUnsafeLedgerCarryForward(item, fieldId)) return null;
  const aggregateRef = aggregateRefForValues(values);
  const events = sameWorkspaceEvents(item, ctx)
    .filter((event) => !aggregateRef || event.aggregateRef === aggregateRef || sameAggregatePayload(event.payload, aggregateRef))
    .slice()
    .reverse();
  for (const event of events) {
    const carried = carriedFieldFromPayload(fieldId, event.payload, ctx);
    if (carried) return carried;
  }
  return carriedFieldFromCompletedDraft(fieldId, item, card, ctx);
}

function sameWorkspaceEvents(item, ctx) {
  const events = [
    ...(ctx.state.projectionEvents || []),
    ...(ctx.state.runtimeStore?.events || [])
  ];
  const seen = new Set();
  return events
    .map((event) => ({
      ...event,
      workspaceId: event.workspaceId || event.WorkspaceId,
      cardId: event.cardId || event.CardId,
      aggregateRef: event.aggregateRef || event.AggregateRef,
      payload: event.payload || event.Payload || {}
    }))
    .filter((event) => event.workspaceId === item.id && event.payload)
    .filter((event) => {
      const key = event.eventId || event.EventId || `${event.cardId}:${JSON.stringify(event.payload)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function carriedFieldFromCompletedDraft(fieldId, item, card, ctx) {
  const currentIndex = (item.cards || []).findIndex((candidate) => candidate.id === card.id);
  const previousCards = (item.cards || [])
    .slice(0, currentIndex < 0 ? 0 : currentIndex)
    .filter((candidate) => isTerminalCardStatus(candidate.status))
    .reverse();
  for (const previous of previousCards) {
    const draft = loadDraft(item.id, previous.id);
    const carried = carriedFieldFromPayload(fieldId, draft.values || {}, ctx);
    if (carried) return carried;
  }
  return null;
}

function carriedFieldFromPayload(fieldId, payload = {}, ctx) {
  const direct = payload[fieldId];
  if (hasCarryValue(direct)) {
    return { value: String(direct), displayValue: contextDisplayValue(fieldId, String(direct), payload, ctx) };
  }
  if (fieldId === "roomId") {
    const roomNo = payload.roomNo || payload["房间号"];
    if (hasCarryValue(roomNo)) {
      const value = `room-${String(roomNo).trim()}`.toLowerCase();
      return { value, displayValue: roomDisplayValue(value, payload, ctx) };
    }
  }
  if (fieldId === "bedId") {
    const bedNo = payload.bedNo || payload["床位号"];
    if (hasCarryValue(bedNo)) {
      const value = `bed-${String(bedNo).trim()}`.toLowerCase();
      return { value, displayValue: bedDisplayValue(value, payload, ctx) };
    }
  }
  return null;
}

function hasCarryValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function contextDisplayValue(fieldId, value, payload, ctx) {
  if (fieldId === "roomId") return roomDisplayValue(value, payload, ctx);
  if (fieldId === "bedId") return bedDisplayValue(value, payload, ctx);
  return value;
}

function roomDisplayValue(value, payload = {}, ctx) {
  const building = payload.buildingName || payload.buildingId || payload["楼栋"] || "";
  const roomNo = payload.roomNo || payload["房间号"] || "";
  const label = [building, roomNo].filter(Boolean).join(" / ");
  return label || value;
}

function bedDisplayValue(value, payload = {}, ctx) {
  const room = roomDisplayValue(payload.roomId || "", payload, ctx);
  const bedNo = payload.bedNo || payload["床位号"] || "";
  const label = [room, bedNo].filter(Boolean).join(" / ");
  return label || value;
}

function aggregateRefForValues(values) {
  for (const key of ["depositId", "paymentId", "stayId", "residentId", "reservationId", "leadId", "roomId", "bedId", "taskId", "expenseId", "periodId"]) {
    if (values[key]) return `${key}:${values[key]}`;
  }
  return "";
}

function fieldLabel(field, ctx, requiredForOperation = field.required) {
  const required = requiredForOperation ? `<em class="required-mark">${ctx.tr("requiredMark")}</em>` : "";
  return `${ctx.localTerm(field)}${required}`;
}

function missingFieldIdsFor(card, item, ctx) {
  const validation = ctx.state.fieldValidation || {};
  if (validation.workspaceId !== item.id || validation.cardId !== card.id) return [];
  return validation.missingFieldIds || [];
}

function systemValidationPanel(card, item, draft, visibleBlockers, ctx) {
  const evidenceStates = (card.evidence || []).map((field) =>
    EvidenceStateVM(field, (draft.evidenceDrafts || []).find((item) => item.requirementId === field.id), ctx));
  const evidenceNames = evidenceStates.map((state) => businessCheckName(state.name)).filter(Boolean);
  const checkNames = (card.checks || []).map((entry) => businessCheckName(ctx.localTerm(entry))).filter(Boolean);
  const missingLabels = currentMissingRequiredLabels(card, item, ctx);
  const submitStatus = missingLabels.length
    ? `${ctx.tr("cannotSubmitYet")}: ${ctx.tr("requiredFieldsMissing")}`
    : visibleBlockers.length
    ? `${ctx.tr("cannotSubmitYet")}: ${visibleBlockers.map((entry) => ctx.tx(entry.title)).join(" · ")}`
    : ctx.tr("readyToSubmit");
  const chips = [
    `${ctx.tr(missingLabels.length ? "requiredFieldsMissing" : "requiredFields")}: ${missingLabels.length ? missingLabels.join(" · ") : ctx.tr("systemCheckReady")}`,
    `${ctx.tr("systemEvidenceCheck")}: ${evidenceNames.length ? evidenceNames.join(" · ") : ctx.tr("noRequiredEvidence")}`,
    `${ctx.tr("submitStatus")}: ${submitStatus}`,
    checkNames.length ? `${ctx.tr("systemRules")}: ${checkNames.slice(0, 3).join(" · ")}` : ""
  ].filter(Boolean);
  return `<section class="system-check-panel${missingLabels.length ? " has-error" : ""}" data-surface="system-validation-summary">
    <b>${ctx.tr("systemValidation")}</b>
    <p>${ctx.tr("systemValidationHelp")}</p>
    <div>${chips.map((chip) => `<span>${ctx.escapeHtml(chip)}</span>`).join("")}</div>
  </section>`;
}

function businessCheckName(name = "") {
  return String(name || "")
    .replace("房间重复校验", "房间是否重复")
    .replace("配置人记录", "记录办理人")
    .replace("系统规则", "业务规则")
    .replace("校验", "确认");
}

function currentMissingRequiredLabels(card, item, ctx) {
  const validation = ctx.state.fieldValidation || {};
  if (validation.workspaceId === item.id && validation.cardId === card.id && validation.missingLabels?.length) {
    return validation.missingLabels;
  }
  return operationInputFields(card, ctx, item)
    .filter((field) => operationFieldRequired(field, card, item, ctx))
    .filter((field) => !hasRequiredFieldValue(field, item, card, ctx))
    .map((field) => ctx.localTerm(field));
}

function operationFieldRequired(field, card, item, ctx) {
  const fieldId = operationFieldId(field);
  const values = operationDraftValues(item, card);
  return isScopedResourceFieldRequired(card?.id, fieldId, values, Boolean(field.required));
}

function operationFieldVisible(field, card, item, ctx) {
  const fieldId = operationFieldId(field);
  const values = operationDraftValues(item, card);
  const fallbackVisible = operationFieldRequired(field, card, item, ctx) ||
    !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN"));
  return isScopedResourceFieldVisible(card?.id, fieldId, values, fallbackVisible);
}

function operationDraftValues(item, card) {
  return item ? loadDraft(item.id, card.id).values || {} : {};
}

function hasRequiredFieldValue(field, item, card, ctx) {
  const kind = fieldControlKind(field);
  const fieldId = operationFieldId(field);
  const value = operationFieldState(field, item, card, ctx).value;
  if (fieldId === "bedLabels") {
    const values = loadDraft(item.id, card.id).values || {};
    const bedCount = Number(values.bedCount || carriedForwardValue({ id: "bedCount", label: { "zh-CN": "床位数" } }, item, card, values, ctx)?.value || 0);
    const labels = splitBedLabels(value);
    return labels.length > 0 && (!Number.isFinite(bedCount) || bedCount <= 0 || labels.length === bedCount);
  }
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return hasCarryValue(start) && hasCarryValue(end);
  }
  if (hasCarryValue(value)) return true;
  if (kind === "select") {
    if (fieldId === "resourceScope") return hasCarryValue(value);
    return optionsForField(field, ctx.state.lang).some((entry) => hasCarryValue(entry.value));
  }
  return false;
}

function sameAggregatePayload(payload, aggregateRef) {
  const [key, value] = aggregateRef.split(":");
  return key && value && payload?.[key] === value;
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
