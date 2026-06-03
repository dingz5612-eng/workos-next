import { capacityForRoomType, defaultValueForField, fieldControlKind, isDerivedReadonlyField, optionsForField } from "../controls/fieldControls.js";
import { loadDraft } from "../operationDrafts.js";
import { lensIdsForWorkspace, lensPreview, lensTitle } from "../runtimeLensCatalog.js";
import { buildOperationActionState } from "../operationActionState.js";
import { isUnsafeLedgerCarryForward } from "../selectors/surfaceSelectors.js";
import { activeCardForWorkspace, activeWorkspaceCard, isCardActionDisabled } from "../selectors/workspaceSelectors.js";
import { checkoutServiceMobilePanel, checkoutServiceOperationAddon } from "./checkoutServiceView.js";
import { EvidenceSheet, EvidenceTile, LifecycleWorkspace, OperationPanelView } from "./experienceComponents.js";

const terminalStatuses = new Set(["done", "confirmed", "completed", "committed", "closed", "cancelled", "skipped"]);

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
  const requestedCard = activeWorkspaceCard(item, ctx.state.selectedCardIndex, ctx.state.selectedCardId);
  const workspaceCompleted = (item.cards || []).every((card) => terminalStatuses.has(String(card.status || "")));
  const activeCard = terminalStatuses.has(String(requestedCard.status || "")) && !workspaceCompleted
    ? activeWorkspaceCard(item, -1, "")
    : requestedCard;
  const actionState = buildOperationActionState({ workspace: item, workspaceId: item.id, cardId: activeCard.id }, activeCard, ctx.state.lastActionResult, ctx.state);
  const isCompleted = workspaceCompleted && terminalStatuses.has(String(activeCard.status || ""));
  if (isCompleted) {
    return ctx.shell(`
      <section class="workspace-page ${item.domain}">
        <span>${ctx.tr("completedRecordTitle")} · ${ctx.tr(item.domain)}</span>
        <h1>${ctx.tx(item.title)}</h1>
        <p>${ctx.tx(item.summary)}</p>
      </section>
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
      ${LifecycleWorkspace(item, activeCard, ctx)}
      ${compatCardTabs(item, activeCard, ctx)}
      ${workspaceLensPanel(item, ctx)}
      ${checkoutServiceMobilePanel(item, activeCard, ctx)}
      ${OperationPanelView(workspaceCardPanel(activeCard, item, true, ctx), item, activeCard, ctx)}
    </section>
    ${isCompleted ? "" : `<div class="sticky-action">${primaryActionButton(actionState, ctx)}</div>`}
  `);
}

function completedWorkspaceRecord(item, card, ctx) {
  const completedSteps = (item.cards || []).filter((candidate) => terminalStatuses.has(String(candidate.status || "")));
  const next = nextIncompleteCardTitle(card, item, ctx);
  const selectedStep = terminalStatuses.has(String(card.status || "")) ? card : completedSteps[0] || card;
  return `<section class="completed-record-detail" data-surface="completed-workspace-record">
    <div class="completed-record-hero">
      <span>${ctx.tr("completedRecordTitle")}</span>
      <h2>${ctx.tx(item.title)}</h2>
      <p>${ctx.tr("completedCardHelp")}</p>
    </div>
    <section class="completed-step-list" data-surface="completed-step-list">
      <h3>${ctx.tr("completedSteps")}</h3>
      <div>${(item.cards || []).map((step, index) => completedStepButton(step, index, selectedStep, item, ctx)).join("")}</div>
    </section>
    <section class="completed-record-grid">
      ${recordTile(ctx.tr("objectSummary"), ctx.tx(item.title), ctx.tx(item.summary), ctx)}
      ${recordTile(ctx.tr("currentState"), ctx.tr(selectedStep.status), ctx.tx(item.next), ctx)}
      ${recordTile(ctx.tr("requiredEvidenceCopy"), evidenceForRecord(item, selectedStep).length ? evidenceForRecord(item, selectedStep).map((entry) => ctx.localTerm(entry)).join(" · ") : ctx.tr("noRequiredEvidence"), ctx.tr("traceBound"), ctx)}
      ${recordTile(ctx.tr("submissionRecord"), item.caseId || item.id, ctx.tr("submissionRecordHelp"), ctx)}
      ${recordTile(ctx.tr("cardNext"), next || ctx.tr("allStepsCompleted"), ctx.tr("completedNextHelp"), ctx)}
    </section>
    <section class="completed-record-section">
      <h3>${ctx.tr("stepDetails")}: ${ctx.tx(selectedStep.title)}</h3>
      <dl>
        <dt>${ctx.tr("currentState")}</dt><dd>${ctx.tr(selectedStep.status)}</dd>
        <dt>${ctx.tr("requiredEvidenceCopy")}</dt><dd>${evidenceForRecord(item, selectedStep).length ? evidenceForRecord(item, selectedStep).map((entry) => ctx.localTerm(entry)).join(" · ") : ctx.tr("noRequiredEvidence")}</dd>
        <dt>${ctx.tr("blockers")}</dt><dd>${blockersForRecord(item, selectedStep, ctx)}</dd>
      </dl>
    </section>
    ${fieldsForRecord(selectedStep, ctx).length ? `<section class="completed-record-section">
      <h3>${ctx.tr("businessFields")}</h3>
      <dl>${fieldsForRecord(selectedStep, ctx).map((field) => `<dt>${ctx.localTerm(field)}</dt><dd>${ctx.escapeHtml(displayCompletedRecordValue(field, item, selectedStep, ctx) || "-")}</dd>`).join("")}</dl>
    </section>` : ""}
    <section class="completed-record-section">
      <h3>${ctx.tr("auditSummary")}</h3>
      <p>${ctx.tr("completedAuditHelp")}</p>
    </section>
  </section>`;
}

function completedStepButton(step, index, selectedStep, item, ctx) {
  const selected = step.id === selectedStep.id ? " active" : "";
  return `<button class="completed-step-button${selected}" data-workspace="${ctx.escapeAttr(item.id)}" data-card-id="${ctx.escapeAttr(step.id)}">
    <span>${index + 1}</span>
    <strong>${ctx.tx(step.title)}</strong>
    <small>${ctx.tr(step.status)}</small>
  </button>`;
}

function fieldsForRecord(card, ctx) {
  return operationInputFields(card, ctx);
}

function evidenceForRecord(item, card) {
  return card.evidence?.length ? card.evidence : item.cards?.flatMap((candidate) => candidate.id === card.id ? candidate.evidence || [] : []) || [];
}

function blockersForRecord(item, card, ctx) {
  const blockers = activeBlockers(item, card);
  return blockers.length ? blockers.map((entry) => ctx.tx(entry.title || entry)).join(" · ") : ctx.tr("noCriticalBlocker");
}

function nextIncompleteCardTitle(card, item, ctx) {
  const index = (item.cards || []).findIndex((candidate) => candidate.id === card.id);
  const next = (item.cards || []).slice(index + 1).find((candidate) => !terminalStatuses.has(String(candidate.status || "")));
  return next ? ctx.tx(next.title) : "";
}

function displayOperationValue(field, item, card, ctx) {
  const value = operationValue(field, item, card, ctx);
  return displayFieldValue(field, value, ctx);
}

function displayCompletedRecordValue(field, item, card, ctx) {
  const payload = completedEventPayload(item, card, ctx);
  const fieldId = operationFieldId(field);
  const value = payload?.[fieldId] || payload?.[field.id] || "";
  return displayFieldValue(field, value, ctx);
}

function displayFieldValue(field, value, ctx) {
  const options = optionsForField(field, ctx.state.lang);
  const matched = options.find((entry) => String(entry.value) === String(value));
  return matched ? ctx.localTerm(matched.label) : ctx.localTerm(value);
}

function completedEventPayload(item, card, ctx) {
  return (ctx.state.projectionEvents || [])
    .filter((event) => event.workspaceId === item.id && event.cardId === card.id && event.payload)
    .slice()
    .reverse()[0]?.payload || {};
}

function recordTile(label, value, body, ctx) {
  return `<article>
    <span>${label}</span>
    <strong>${ctx.escapeHtml(String(value || "-"))}</strong>
    <p>${ctx.escapeHtml(String(body || "-"))}</p>
  </article>`;
}

function compatCardTabs(item, activeCard, ctx) {
  if (!debugToolsVisible(ctx)) return "";
  return `<section class="compat-card-tabs" data-component="CompatibilityCardTabs">
    <span>Debug / compatibility</span>
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
  return `<article class="intent-card ${card.status} ${expanded ? "expanded" : ""}">
    ${expanded || ["ready", "blocked", "inProgress"].includes(card.status) ? cardOperation(card, item, ctx) : ""}
  </article>`;
}

export function cardOperation(card, item, ctx) {
  const disabled = isCardActionDisabled(card) ? "disabled" : "";
  const visibleBlockers = activeBlockers(item, card);
  const statusHelp = cardStatusHelp(card, ctx);
  const draft = loadDraft(item.id, card.id);
  if (card.status === "done") {
    return `<div class="card-operation completed-operation">
      <span>${ctx.tr("completedRecordTitle")}</span>
      <h3>${ctx.tx(card.title)}</h3>
      <section class="operation-state"><b>${ctx.tr(card.status)}</b><p>${statusHelp}</p></section>
      <section><b>${ctx.tr("cardNext")}</b><p>${ctx.tr("cardNextHelp")} ${nextCardTitle(card, item, ctx)}</p></section>
      <section><b>${ctx.tr("nextBestAction")}</b><p>${ctx.tr("nextBestActionHelp")} ${ctx.tx(item.next)}</p></section>
    </div>`;
  }
  return `<div class="card-operation">
    <span>${ctx.tr("cardOperation")}</span>
    <h3>${ctx.tx(card.title)}</h3>
    ${statusHelp ? `<section class="operation-state"><b>${ctx.tr(card.status)}</b><p>${statusHelp}</p></section>` : ""}
    <section><b>${ctx.tr("cardAction")}</b><p>${operationActionText(card, item, ctx)}</p></section>
    <section>
      <b>${ctx.tr("cardInput")}</b>
      <div class="operation-inputs">${operationInputFields(card, ctx).map((field) => operationControl(field, item, card, disabled, ctx)).join("")}</div>
    </section>
    <section>
      <b>${ctx.tr("cardEvidence")}</b>
      <p>${ctx.tr("cardEvidenceHelp")}</p>
      <div class="evidence-row">${card.evidence.map((field) => evidenceButton(field, draft, disabled, ctx)).join("")}</div>
      ${EvidenceSheet(card, draft, ctx)}
    </section>
    <section><b>${ctx.tr("cardConfirm")}</b><p>${confirmationText(card, item, ctx)}</p></section>
    ${checkoutServiceOperationAddon(card, item, ctx)}
    <section><b>${ctx.tr("cardNext")}</b><p>${ctx.tr("cardNextHelp")} ${nextCardTitle(card, item, ctx)}</p></section>
    <section><b>${ctx.tr("nextBestAction")}</b><p>${ctx.tr("nextBestActionHelp")} ${ctx.tx(item.next)}</p></section>
    <section><b>${ctx.tr("blockers")}</b><p>${visibleBlockers.length ? visibleBlockers.map((entry) => ctx.tx(entry.title)).join(" · ") : `${ctx.tr("noCriticalBlocker")} ${ctx.tr("blockerHelp")}`}</p></section>
    <div class="operation-actions">
      <button class="secondary" data-save-draft ${disabled}>${ctx.tr("saveDraft")}</button>
      <button class="secondary" type="button" data-view="operationPanel" ${disabled}>${ctx.tr("trustedConfirm")}</button>
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
  const reason = action.reasonKey ? `<small>${ctx.tr(action.reasonKey)}</small>` : "";
  const submit = ["ready"].includes(actionState.status) ? "data-submit-card" : `data-action-state="${ctx.escapeAttr(actionState.status)}"`;
  return `<button class="primary-action ${ctx.escapeAttr(actionState.status)}" ${submit} ${disabled}>${ctx.tr(action.labelKey)}</button>${reason}`;
}

export function cardStatusHelp(card, ctx) {
  if (card.status === "done") return ctx.tr("completedCardHelp");
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
    ? `处理“${ctx.tx(card.title)}”，提交前系统会校验字段、证据和人工确认边界。`
    : `Обработайте "${ctx.tx(card.title)}"; перед отправкой система проверит поля, доказательства и подтверждение.`;
}

export function operationInputFields(card, ctx) {
  return card.fields.business.filter((field) => field.required || !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN")));
}

export function operationControl(field, item, card, disabled, ctx) {
  const fieldId = operationFieldId(field);
  const value = operationValue(field, item, card, ctx);
  const kind = fieldControlKind(field);
  const options = optionsForField(field, ctx.state.lang);
  const help = ctx.tx(field.help);
  if (kind === "searchSelect") return `<label class="search-select"><span>${ctx.localTerm(field)} · ${ctx.tr("searchableSelect")}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" list="${ctx.escapeAttr(fieldId)}Options" value="${value}" ${disabled} /><datalist id="${ctx.escapeAttr(fieldId)}Options">${options.map((entry) => `<option value="${entry.value}" label="${entry.label}">`).join("")}</datalist>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "select") return `<label><span>${ctx.localTerm(field)}</span><select data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" ${disabled}>${options.map((entry) => `<option value="${entry.value}" ${entry.value === value ? "selected" : ""}>${entry.label}</option>`).join("")}</select>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return `<label><span>${ctx.localTerm(field)}</span><div class="datetime-range"><input data-operation-field-start="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${start}" ${disabled} /><input data-operation-field-end="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${end}" ${disabled} /></div>${help ? `<small>${help}</small>` : ""}</label>`;
  }
  if (kind === "dateTime") return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" type="datetime-local" value="${value}" ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "readonly") return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" value="${value}" readonly ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "number") {
    const readonly = isDerivedReadonlyField(field) ? `readonly data-derived-from="${field.ui?.derivedFrom || ""}"` : "";
    return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" data-field-id="${ctx.escapeAttr(fieldId)}" type="number" inputmode="decimal" value="${value}" ${readonly} ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  }
  return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${ctx.escapeAttr(fieldId)}" value="${value}" ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
}

export function operationValue(field, item, card, ctx) {
  const draft = loadDraft(item.id, card.id);
  const values = draft.values || {};
  const fieldId = operationFieldId(field);
  if (values[fieldId]) return values[fieldId];
  if (values[field.id]) return values[field.id];
  if (fieldId === "amount") {
    const derivedAmount = derivedChargeAmount(item, ctx, values);
    if (derivedAmount) return derivedAmount;
  }
  if (fieldId === "refundAmount") {
    const derivedRefundAmount = derivedDepositRefundAmount(item, ctx, values);
    if (derivedRefundAmount) return derivedRefundAmount;
  }
  const carried = carriedForwardValue(field, item, card, values, ctx);
  if (carried) return carried;
  if (field.ui?.derivedFrom === "roomType") {
    const roomType = Object.entries(values).find(([, candidate]) => ["single", "double", "four_bed", "six_bed", "单人间", "双人间", "四人间", "六人间"].includes(candidate))?.[1] || "four_bed";
    return capacityForRoomType(roomType);
  }
  return defaultValueForField(field);
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

function operationFieldId(field) {
  const aliases = {
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
  if (isUnsafeLedgerCarryForward(item, field.id)) return "";
  const aggregateRef = aggregateRefForValues(values);
  const events = (ctx.state.projectionEvents || [])
    .filter((event) => event.workspaceId === item.id && event.payload)
    .filter((event) => !aggregateRef || event.aggregateRef === aggregateRef || sameAggregatePayload(event.payload, aggregateRef))
    .slice()
    .reverse();
  for (const event of events) {
    if (event.payload[field.id]) return event.payload[field.id];
  }
  return "";
}

function evidenceButton(field, draft, disabled, ctx) {
  return EvidenceTile(field, draft, disabled, ctx);
}

function aggregateRefForValues(values) {
  for (const key of ["depositId", "paymentId", "stayId", "residentId", "reservationId", "leadId", "roomId", "bedId", "taskId", "expenseId", "periodId"]) {
    if (values[key]) return `${key}:${values[key]}`;
  }
  return "";
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
