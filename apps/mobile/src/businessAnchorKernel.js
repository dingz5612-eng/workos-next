const anchorFieldAliases = {
  roomLabel: ["roomLabel", "room_label", "roomDisplay", "room_display", "roomName", "room_name"],
  buildingName: ["buildingName", "building_name", "building", "buildingId", "building_id"],
  roomNo: ["roomNo", "room_no", "roomNumber", "room_number", "房间号"],
  bedLabel: ["bedLabel", "bed_label", "bedNo", "bed_no", "bedNumber", "bed_number", "床位号"],
  bedType: ["bedType", "bed_type", "bunkType", "bunk_type", "床铺类型", "床位类型"],
  bedTypeLabel: ["bedTypeLabel", "bed_type_label", "bedLayoutLabel", "bed_layout_label"],
  residentName: ["residentName", "resident_name", "customerName", "customer_name", "contactName", "contact_name", "guestName", "guest_name", "leadName", "lead_name", "name", "姓名", "线索姓名", "客户姓名"],
  phone: ["residentPhone", "resident_phone", "customerPhone", "customer_phone", "contactPhone", "contact_phone", "mobile", "phone", "telephone", "tel", "电话", "手机号"],
  periodLabel: ["periodLabel", "period_label", "periodName", "period_name", "periodNo", "period_no"],
  currentAction: ["currentAction", "current_action", "actionLabel", "action_label", "nextAction", "next_action", "reason", "statusLabel", "status_label"],
  depositStatus: ["depositStatus", "deposit_status"],
  paymentStatus: ["paymentStatus", "payment_status"],
  taskStatus: ["taskStatus", "task_status"],
  checkoutStatus: ["checkoutStatus", "checkout_status"]
};

const actionByCardId = {
  roomSetup: "anchorActionRoomSetup",
  bedSetup: "anchorActionBedSetup",
  rateSetup: "anchorActionRateSetup",
  roomReadiness: "anchorActionRoomReadiness",
  roomBlock: "anchorActionRoomBlock",
  roomRelease: "anchorActionRoomRelease",
  lead: "anchorActionResident",
  residentProfile: "anchorActionResident",
  bedAssign: "anchorActionBedAssign",
  tariff: "anchorActionTariff",
  depositAssessment: "anchorActionDepositAssess",
  depositReceipt: "anchorActionDepositReceive",
  depositConfirmation: "anchorActionDepositConfirm",
  depositDeduction: "anchorActionDepositDeduct",
  depositRefundApproval: "anchorActionDepositRefund",
  depositRefundPayment: "anchorActionDepositRefundPay",
  depositClose: "anchorActionDepositClose",
  paymentReceipt: "anchorActionPaymentReceive",
  paymentConfirmation: "anchorActionPaymentConfirm",
  paymentAllocation: "anchorActionPaymentAllocate",
  paymentAdjustment: "anchorActionPaymentAdjust",
  serviceTaskCreate: "anchorActionServiceCreate",
  serviceTaskAssign: "anchorActionServiceAssign",
  serviceTaskComplete: "anchorActionServiceComplete",
  serviceTaskVerify: "anchorActionServiceVerify",
  roomReleaseAfterService: "anchorActionRoomRelease",
  checkoutStart: "anchorActionCheckoutStart",
  roomInspection: "anchorActionRoomInspection",
  feeSettlement: "anchorActionFeeSettlement",
  checkoutFinance: "anchorActionCheckoutFinance",
  finalBalanceClose: "anchorActionFinalBalance",
  bedRelease: "anchorActionBedRelease",
  expenseRecord: "anchorActionExpense",
  periodScope: "anchorActionPeriodScope",
  periodDiagnosis: "anchorActionPeriodDiagnosis",
  periodActionPlan: "anchorActionPeriodActionPlan",
  periodClose: "anchorActionPeriodClose",
  ledgerCorrectionApply: "anchorActionCorrection"
};

export function buildBusinessAnchor(source = {}, ctx = {}) {
  const facts = collectAnchorFacts(source, ctx);
  const room = roomAnchor(facts);
  const bed = bedAnchor(facts, ctx);
  const person = firstValue(facts, "residentName");
  const phone = firstValue(facts, "phone");
  const period = firstValue(facts, "periodLabel");
  const action = actionAnchor(source, facts, ctx);
  const fields = anchorFields(source, facts, { room, bed, person, phone, period, action }, ctx);
  const tokens = unique([
    room,
    bed,
    person,
    maskPhone(phone),
    period,
    action
  ].filter(isDisplayValue));
  const searchTokens = unique([
    ...tokens,
    normalizePhone(phone),
    phone,
    firstValue(facts, "roomNo"),
    firstValue(facts, "bedLabel")
  ].filter(isDisplayValue));
  return {
    kind: "BusinessAnchorVM",
    label: tokens.join(" · "),
    tokens,
    fields,
    searchText: searchTokens.join(" "),
    hasAnchor: tokens.length > 0,
    privacy: {
      personAndPhoneAreDisplaySearchOnly: Boolean(person || phone),
      phoneMasked: Boolean(phone)
    },
    sourceRefs: {
      workspaceId: source.workspaceId || source.workspace_id || source.workspace?.id || source.id || "",
      cardId: source.cardId || source.card_id || source.card?.id || source._surfaceCardId || ""
    }
  };
}

export function businessAnchorText(source = {}, ctx = {}) {
  return buildBusinessAnchor(source, ctx).searchText;
}

export function businessAnchorHtml(source = {}, ctx = {}, options = {}) {
  const anchor = buildBusinessAnchor(source, ctx);
  if (!anchor.hasAnchor) return "";
  const label = options.label || ctx.tr?.("businessAnchor") || "业务锚点";
  const className = ["business-anchor", options.compact ? "compact" : ""].filter(Boolean).join(" ");
  return `<p class="${escapeAttr(className, ctx)}" data-surface="business-anchor" data-anchor-privacy="display-search-only"><span>${escapeHtml(label, ctx)}</span><strong>${escapeHtml(anchor.label, ctx)}</strong></p>`;
}

export function businessAnchorFieldsHtml(source = {}, ctx = {}, options = {}) {
  const anchor = buildBusinessAnchor(source, ctx);
  if (!anchor.fields.length) return "";
  const className = ["business-anchor-fields", options.compact ? "compact" : ""].filter(Boolean).join(" ");
  return `<div class="${escapeAttr(className, ctx)}" data-surface="business-anchor-fields" data-anchor-privacy="display-search-only">
    ${anchor.fields.map((field) => `<div class="business-anchor-field" data-anchor-field="${escapeAttr(field.key, ctx)}"><span>${escapeHtml(field.label, ctx)}</span><strong>${escapeHtml(field.value, ctx)}</strong></div>`).join("")}
  </div>`;
}

export function maskPhone(value = "") {
  const text = String(value || "").trim();
  const digits = normalizePhone(text);
  if (digits.length >= 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  if (digits.length >= 7) return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
  return text;
}

function anchorFields(source = {}, facts = {}, values = {}, ctx = {}) {
  const cardId = source.cardId || source.card_id || source.card?.id || source._surfaceCardId || activeCard(source.workspace || source)?.id || "";
  const actionSlot = actionFieldByCardId(cardId);
  const fields = [];
  const roomValue = values.room || (actionSlot === "room" ? shortActionValue(values.action, ctx.tr?.("anchorRoom") || "房间") : "");
  const bedValue = values.bed || (actionSlot === "bed" ? shortActionValue(values.action, ctx.tr?.("anchorBed") || "床位") : "");
  pushField(fields, "room", ctx.tr?.("anchorRoom") || "房间", roomValue);
  pushField(fields, "bed", ctx.tr?.("anchorBed") || "床位", bedValue);
  pushField(fields, "resident", ctx.tr?.("anchorResident") || "入住人", values.person);
  pushField(fields, "phone", ctx.tr?.("anchorPhone") || "电话", maskPhone(values.phone));
  pushField(fields, "period", ctx.tr?.("anchorPeriod") || "周期", values.period);
  const actionLabel = actionSlot ? actionFieldLabel(actionSlot, ctx) : ctx.tr?.("anchorStatus") || "状态";
  const actionValue = actionSlot ? shortActionValue(values.action, actionLabel) : values.action;
  const hasActionField = fields.some((field) => field.key === actionSlot);
  if (actionValue && !hasActionField) pushField(fields, actionSlot || "status", actionLabel, actionValue);
  return fields;
}

function pushField(fields = [], key = "", label = "", value = "") {
  if (!isDisplayValue(value)) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  if (fields.some((field) => field.key === key && field.value === normalized)) return;
  fields.push({ key, label, value: normalized });
}

function actionFieldByCardId(cardId = "") {
  const groups = {
    room: ["roomSetup", "roomReadiness", "roomBlock", "roomRelease", "roomReleaseAfterService"],
    bed: ["bedSetup", "bedAssign", "bedRelease"],
    price: ["rateSetup", "tariff"],
    resident: ["lead", "residentProfile"],
    deposit: ["depositAssessment", "depositReceipt", "depositConfirmation", "depositDeduction", "depositRefundApproval", "depositRefundPayment", "depositClose"],
    payment: ["paymentReceipt", "paymentConfirmation", "paymentAllocation", "paymentAdjustment"],
    task: ["serviceTaskCreate", "serviceTaskAssign", "serviceTaskComplete", "serviceTaskVerify"],
    checkout: ["checkoutStart", "roomInspection", "feeSettlement", "checkoutFinance", "finalBalanceClose"],
    period: ["periodScope", "periodDiagnosis", "periodActionPlan", "periodClose"]
  };
  return Object.entries(groups).find(([, ids]) => ids.includes(cardId))?.[0] || "status";
}

function actionFieldLabel(slot = "", ctx = {}) {
  const labels = {
    room: "anchorRoom",
    bed: "anchorBed",
    price: "anchorPrice",
    resident: "anchorResident",
    deposit: "anchorDeposit",
    payment: "anchorPayment",
    task: "anchorTask",
    checkout: "anchorCheckout",
    period: "anchorPeriod",
    status: "anchorStatus"
  };
  const key = labels[slot] || "anchorStatus";
  return ctx.tr?.(key) || key;
}

function shortActionValue(action = "", label = "") {
  const value = String(action || "").trim();
  const prefix = String(label || "").trim();
  if (prefix && value.startsWith(prefix) && value.length > prefix.length) return value.slice(prefix.length).trim();
  return value;
}

function collectAnchorFacts(source = {}, ctx = {}) {
  const workspace = source.workspace || source;
  const card = source.card || workspace.card || activeCard(workspace);
  const payloads = [
    source.businessAnchor,
    source.business_anchor,
    source.anchor,
    source.scenarioAnchor,
    source.scenario_anchor,
    source.payload?.businessAnchor,
    source.Payload?.businessAnchor,
    source.payload?.anchor,
    source.Payload?.anchor,
    source.payload?.fieldValues,
    source.Payload?.fieldValues,
    source.payload?.input?.fieldValues,
    source.Payload?.input?.fieldValues,
    source.payload,
    source.Payload,
    source.fieldValues,
    source.field_values,
    source.values,
    source.input?.fieldValues,
    source.input?.field_values,
    workspace.businessAnchor,
    workspace.business_anchor,
    workspace.anchor,
    workspace.values,
    workspace.fieldValues,
    card?.businessAnchor,
    card?.business_anchor,
    card?.values,
    latestEventPayload(workspace, source, ctx),
    source
  ];
  const facts = {};
  for (const payload of payloads.filter(isObject)) {
    for (const [factKey, aliases] of Object.entries(anchorFieldAliases)) {
      const value = valueByAlias(payload, aliases, ctx);
      if (isDisplayValue(value) && !facts[factKey]) facts[factKey] = String(value).trim();
    }
  }
  return facts;
}

function latestEventPayload(workspace = {}, source = {}, ctx = {}) {
  const workspaceId = source.workspaceId || source.workspace_id || workspace.id || "";
  if (!workspaceId) return null;
  const events = [
    ...(ctx.state?.runtimeStore?.events || []),
    ...(ctx.state?.projectionEvents || [])
  ];
  for (const event of events.slice().reverse()) {
    const eventWorkspaceId = event.workspaceId || event.WorkspaceId;
    if (eventWorkspaceId !== workspaceId) continue;
    const payload = event.payload || event.Payload || {};
    if (isObject(payload.input?.fieldValues)) return payload.input.fieldValues;
    if (isObject(payload.fieldValues)) return payload.fieldValues;
    if (isObject(payload)) return payload;
  }
  return null;
}

function roomAnchor(facts = {}) {
  const explicit = firstValue(facts, "roomLabel");
  if (explicit) return explicit;
  const building = firstValue(facts, "buildingName");
  const roomNo = firstValue(facts, "roomNo");
  if (building && roomNo) return `${building} / ${roomNo}`;
  return roomNo;
}

function bedAnchor(facts = {}, ctx = {}) {
  const label = firstValue(facts, "bedLabel");
  if (!label) return "";
  const typeLabel = firstValue(facts, "bedTypeLabel") || bedTypeLabel(firstValue(facts, "bedType"), ctx);
  return [label, typeLabel].filter(Boolean).join(" ");
}

function actionAnchor(source = {}, facts = {}, ctx = {}) {
  for (const key of ["depositStatus", "paymentStatus", "taskStatus", "checkoutStatus"]) {
    const value = firstValue(facts, key);
    if (value) return value;
  }
  const cardId = source.cardId || source.card_id || source.card?.id || source._surfaceCardId || activeCard(source.workspace || source)?.id || "";
  const key = actionByCardId[cardId];
  if (key) return ctx.tr?.(key) || key;
  const currentAction = firstValue(facts, "currentAction");
  if (currentAction) return currentAction;
  const cardTitle = localized(source.card?.title || activeCard(source.workspace || source)?.title, ctx);
  const rawStatus = source.status || source.lifecycleState || source.card?.status || activeCard(source.workspace || source)?.status;
  const translatedStatus = rawStatus ? ctx.tr?.(rawStatus) : "";
  const status = translatedStatus && translatedStatus !== rawStatus ? translatedStatus : localized(rawStatus, ctx);
  return [cardTitle, status].filter(Boolean).join(" ");
}

function bedTypeLabel(value = "", ctx = {}) {
  const type = String(value || "").trim();
  const labels = {
    upper: "anchorBedUpper",
    lower: "anchorBedLower",
    flat: "anchorBedFlat",
    whole: "anchorBedFlat"
  };
  const key = labels[type];
  return key ? ctx.tr?.(key) || key : "";
}

function valueByAlias(payload = {}, aliases = [], ctx = {}) {
  for (const alias of aliases) {
    if (payload[alias] === undefined || payload[alias] === null) continue;
    const value = localized(payload[alias], ctx);
    if (String(value || "").trim() !== "") {
      return value;
    }
  }
  return "";
}

function firstValue(values = {}, key = "") {
  return isDisplayValue(values[key]) ? String(values[key]).trim() : "";
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function isDisplayValue(value) {
  if (isObject(value) || Array.isArray(value)) return false;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function activeCard(workspace = {}) {
  return workspace?.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || workspace?.cards?.[0] || {};
}

function localized(value, ctx = {}) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (ctx.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || value["ky-KG"] || value.label || value.title || "";
}

function escapeHtml(value, ctx = {}) {
  return ctx.escapeHtml ? ctx.escapeHtml(value) : String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function escapeAttr(value, ctx = {}) {
  return ctx.escapeAttr ? ctx.escapeAttr(value) : escapeHtml(value, ctx);
}
