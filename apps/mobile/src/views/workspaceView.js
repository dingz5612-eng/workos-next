import { capacityForRoomType, defaultValueForField, fieldControlKind, isDerivedReadonlyField, optionsForField } from "../controls/fieldControls.js";
import { loadDraft } from "../operationDrafts.js";
import { lensIdsForWorkspace, lensPreview, lensTitle } from "../runtimeLensCatalog.js";
import { activeCardForWorkspace, activeWorkspaceCard, isCardActionDisabled } from "../selectors/workspaceSelectors.js";

export function workspaceView(ctx) {
  const item = ctx.workspace();
  const activeCard = activeWorkspaceCard(item, ctx.state.selectedCardIndex);
  return ctx.shell(`
    <section class="workspace-page ${item.domain}">
      <span>${ctx.tr("intentWorkspace")} · ${ctx.tr(item.domain)}</span>
      <h1>${ctx.tx(item.title)}</h1>
      <p>${ctx.tx(item.summary)}</p>
    </section>
    <section class="workspace-control">
      <div class="card-tabs">${item.cards.map((card, index) => `<button class="${card.id === activeCard.id ? "active" : ""} ${card.status}" data-card-index="${index}">${ctx.tx(card.title)}</button>`).join("")}</div>
      ${workspaceLensPanel(item, ctx)}
      ${workspaceCardPanel(activeCard, item, true, ctx)}
    </section>
    <div class="sticky-action"><button data-submit-card>${ctx.tr("confirmAction")}</button></div>
  `);
}

export function workspaceCard(item, ctx) {
  if (!item) return "";
  const activeCard = activeCardForWorkspace(item);
  return `<article class="workspace-card ${item.domain}">
    <div class="loop-head">
      <div><span>${ctx.tr(item.domain)} · ${ctx.tr("intentWorkspace")}</span><strong>${ctx.tx(item.title)}</strong></div>
      <button data-workspace="${item.id}">${ctx.tr("openWorkspace")}</button>
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
  const visibleBlockers = card.blockerRules.length ? card.blockerRules : item.blockers;
  const statusHelp = cardStatusHelp(card, ctx);
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
      <div class="evidence-row">${card.evidence.map((field) => `<button type="button" data-evidence-id="${field.id}" ${disabled}>${ctx.localTerm(field)}</button>`).join("")}</div>
    </section>
    <section><b>${ctx.tr("cardConfirm")}</b><p>${confirmationText(card, item, ctx)}</p></section>
    <section><b>${ctx.tr("cardNext")}</b><p>${ctx.tr("cardNextHelp")} ${nextCardTitle(card, item, ctx)}</p></section>
    <section><b>${ctx.tr("nextBestAction")}</b><p>${ctx.tr("nextBestActionHelp")} ${ctx.tx(item.next)}</p></section>
    <section><b>${ctx.tr("blockers")}</b><p>${visibleBlockers.length ? visibleBlockers.map((entry) => ctx.tx(entry.title)).join(" · ") : `${ctx.tr("noCriticalBlocker")} ${ctx.tr("blockerHelp")}`}</p></section>
    <div class="operation-actions">
      <button class="secondary" data-save-draft ${disabled}>${ctx.tr("saveDraft")}</button>
      <button data-submit-card ${disabled}>${ctx.tr("submitForReview")}</button>
    </div>
    ${ctx.state.operationMessage ? `<p class="operation-message">${ctx.escapeHtml(ctx.state.operationMessage)}</p>` : ""}
  </div>`;
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
  return card.fields.business.filter((field) => !["备注", "补充说明", "异议说明"].includes(ctx.localTerm(field, "zh-CN")));
}

export function operationControl(field, item, card, disabled, ctx) {
  const value = operationValue(field, item, card, ctx);
  const kind = fieldControlKind(field);
  const options = optionsForField(field, ctx.state.lang);
  const help = ctx.tx(field.help);
  if (kind === "searchSelect") return `<label class="search-select"><span>${ctx.localTerm(field)} · ${ctx.tr("searchableSelect")}</span><input data-operation-field="${field.id}" list="${field.id}Options" value="${value}" ${disabled} /><datalist id="${field.id}Options">${options.map((entry) => `<option value="${entry.value}" label="${entry.label}">`).join("")}</datalist>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "select") return `<label><span>${ctx.localTerm(field)}</span><select data-operation-field="${field.id}" data-field-id="${field.id}" ${disabled}>${options.map((entry) => `<option value="${entry.value}" ${entry.value === value ? "selected" : ""}>${entry.label}</option>`).join("")}</select>${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "dateTimeRange") {
    const [start = "", end = ""] = String(value || "").split(" 至 ");
    return `<label><span>${ctx.localTerm(field)}</span><div class="datetime-range"><input data-operation-field-start="${field.id}" type="datetime-local" value="${start}" ${disabled} /><input data-operation-field-end="${field.id}" type="datetime-local" value="${end}" ${disabled} /></div>${help ? `<small>${help}</small>` : ""}</label>`;
  }
  if (kind === "dateTime") return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${field.id}" type="datetime-local" value="${value}" ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "readonly") return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${field.id}" value="${value}" readonly ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  if (kind === "number") {
    const readonly = isDerivedReadonlyField(field) ? `readonly data-derived-from="${field.ui?.derivedFrom || ""}"` : "";
    return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${field.id}" data-field-id="${field.id}" type="number" inputmode="decimal" value="${value}" ${readonly} ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
  }
  return `<label><span>${ctx.localTerm(field)}</span><input data-operation-field="${field.id}" value="${value}" ${disabled} />${help ? `<small>${help}</small>` : ""}</label>`;
}

export function operationValue(field, item, card, ctx) {
  const draft = loadDraft(item.id, card.id);
  const values = draft.values || {};
  if (values[field.id]) return values[field.id];
  const carried = carriedForwardValue(field, item, ctx);
  if (carried) return carried;
  if (field.ui?.derivedFrom === "roomType") {
    const roomType = Object.entries(values).find(([, candidate]) => ["single", "double", "four_bed", "six_bed", "单人间", "双人间", "四人间", "六人间"].includes(candidate))?.[1] || "four_bed";
    return capacityForRoomType(roomType);
  }
  return defaultValueForField(field);
}

function carriedForwardValue(field, item, ctx) {
  const events = (ctx.state.projectionEvents || [])
    .filter((event) => event.workspaceId === item.id && event.payload)
    .slice()
    .reverse();
  for (const event of events) {
    if (event.payload[field.id]) return event.payload[field.id];
  }
  return "";
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
