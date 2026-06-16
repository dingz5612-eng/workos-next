import { stepContextContract } from "./systemContextContract.js";

const idGenerationRules = {
  actionPlanId: { prefix: "action-plan", sources: ["periodId", "actionTitle"] },
  bedId: { prefix: "bed", sources: ["roomId", "roomNo", "bedNo", "roomBed"] },
  blockId: { prefix: "block", sources: ["roomId", "bedId", "resourceScope", "blockedReason"] },
  bookingId: { prefix: "booking", sources: ["leadId", "checkInDate", "plannedCheckInDate", "reservedBedCount"] },
  chargeId: { prefix: "charge", sources: ["stayId", "chargeType", "periodStart"] },
  checkoutId: { prefix: "checkout", sources: ["stayId", "actualCheckOutDate"] },
  depositId: { prefix: "deposit", sources: ["stayId", "folioId", "requiredDepositAmount"] },
  depositReceiptId: { prefix: "deposit-receipt", sources: ["depositId", "receivedDate", "receivedAmount"] },
  expenseId: { prefix: "expense", sources: ["expenseDate", "expenseCategory", "expenseAmount"] },
  folioId: { prefix: "folio", sources: ["stayId", "tariffType", "unitRate"] },
  leadId: { prefix: "lead", sources: ["leadName", "guestName", "residentName", "phone", "contactDate", "expectedCheckInDate"] },
  paymentId: { prefix: "payment", sources: ["stayId", "folioId", "paymentAmount", "receivedDate", "paymentTime"] },
  periodId: { prefix: "period", sources: ["periodYear", "periodNo", "periodStartAt"] },
  releaseId: { prefix: "release", sources: ["roomId", "bedId", "resourceScope", "releaseAvailableAt"] },
  reservationId: { prefix: "reservation", sources: ["leadId", "plannedCheckInDate", "reservedBedCount"] },
  residentId: { prefix: "resident", sources: ["residentName", "guestName", "leadName", "phone", "bookingId", "reservationId"] },
  roomId: { prefix: "room", sources: ["buildingName", "roomNo", "reservedRoomId", "roomBed"] },
  stayId: { prefix: "stay", sources: ["residentId", "bedId", "roomBed", "checkInDate", "plannedCheckInDate"] },
  taskId: { prefix: "task", sources: ["taskDate", "taskType", "roomId", "bedId", "area"] }
};

const valueAliases = {
  actualCheckOutDate: ["actualCheckOutDate", "实际退住日期", "预计退房时间"],
  actionTitle: ["actionTitle", "行动标题"],
  area: ["area", "区域"],
  bedNo: ["bedNo", "床位号", "床位"],
  buildingName: ["buildingName", "buildingId", "楼栋", "楼栋/地点"],
  chargeType: ["chargeType", "应收类型"],
  checkInDate: ["checkInDate", "plannedCheckInDate", "入住日期", "计划入住日期"],
  contactDate: ["contactDate", "联系日期"],
  expectedCheckInDate: ["expectedCheckInDate", "期望入住日期"],
  expenseAmount: ["expenseAmount", "支出金额"],
  expenseCategory: ["expenseCategory", "支出类别"],
  expenseDate: ["expenseDate", "支出日期"],
  guestName: ["guestName", "leadName", "residentName", "姓名", "线索姓名", "住客姓名"],
  leadName: ["leadName", "guestName", "residentName", "姓名", "线索姓名", "住客姓名"],
  paymentAmount: ["paymentAmount", "付款金额", "收款金额"],
  paymentTime: ["paymentTime", "付款时间"],
  periodNo: ["periodNo", "周期编号"],
  periodStart: ["periodStart", "计费开始日期"],
  periodStartAt: ["periodStartAt", "周期开始时间"],
  periodYear: ["periodYear", "周期年份"],
  phone: ["phone", "电话", "联系方式"],
  plannedCheckInDate: ["plannedCheckInDate", "checkInDate", "计划入住日期", "入住日期"],
  releaseAvailableAt: ["releaseAvailableAt", "恢复可售时间"],
  requiredDepositAmount: ["requiredDepositAmount", "应收押金金额", "应收押金"],
  reservedBedCount: ["reservedBedCount", "预订床位数", "预订人数"],
  reservedRoomId: ["reservedRoomId", "预留房间"],
  residentName: ["residentName", "guestName", "leadName", "住客姓名", "姓名", "线索姓名"],
  roomBed: ["roomBed", "房间床位", "预留房间/床位"],
  roomNo: ["roomNo", "房间号"],
  tariffType: ["tariffType", "计费方式"],
  tariffQuantity: ["tariffQuantity", "天数/周数/月数", "计费数量"],
  taskDate: ["taskDate", "任务日期"],
  taskType: ["taskType", "任务类型"],
  unitRate: ["unitRate", "单价"]
};

export function withSystemGeneratedOperationValues(workspace = {}, card = {}, values = {}, options = {}) {
  const contract = stepContextContract(card?.id);
  if (!contract) return { ...(values || {}) };
  const payloads = [values, ...(options.payloads || [])].filter(Boolean);
  const next = { ...(values || {}) };

  for (const entry of contract.inheritedFields || []) {
    if (hasValue(next[entry.fieldId])) continue;
    const carried = firstContextValue(entry.fieldId, payloads, { workspace, card });
    if (carried) next[entry.fieldId] = carried.value;
  }

  for (const entry of contract.derivedFields || []) {
    const fieldId = entry.fieldId;
    const merged = mergePayloads([...payloads, next]);
    const derived = generatedContextValue(fieldId, merged, {
      workspace,
      card,
      payloads,
      currentValues: next
    }, { preferDirect: false });
    if (hasValue(derived?.value)) {
      next[fieldId] = derived.value;
    }
  }

  return next;
}

export function generatedContextValue(fieldId = "", payload = {}, scope = {}, options = {}) {
  const merged = mergePayloads([payload]);
  const direct = readValue(merged, fieldId);
  if (options.preferDirect !== false && hasValue(direct)) {
    return { value: String(direct), displayValue: contextReferenceDisplayValue(fieldId, String(direct), merged) };
  }
  if (fieldId === "bedCount" && hasValue(readValue(merged, "capacity"))) {
    return { value: String(readValue(merged, "capacity")), displayValue: String(readValue(merged, "capacity")) };
  }
  if (fieldId === "refundAmount") {
    const refundAmount = derivedDepositRefundAmount(merged, scope);
    if (hasValue(refundAmount)) return { value: refundAmount, displayValue: refundAmount };
  }
  if (fieldId === "amount") {
    const amount = derivedChargeAmount(merged, scope);
    if (hasValue(amount)) return { value: amount, displayValue: amount };
  }

  const generated = generatedOperationId(fieldId, merged, scope);
  return generated
    ? { value: generated, displayValue: contextReferenceDisplayValue(fieldId, generated, merged) }
    : null;
}

function derivedChargeAmount(merged = {}, scope = {}) {
  const payloads = [
    scope.currentValues || {},
    merged,
    ...(scope.payloads || [])
  ];
  for (const payload of payloads) {
    const flat = flattenPayload(payload);
    const direct = readValue(flat, "amount");
    if (hasValue(direct)) return direct;
    const unitRate = decimal(readValue(flat, "unitRate"));
    const quantity = decimal(readValue(flat, "tariffQuantity"));
    if (unitRate > 0 && quantity > 0) {
      return String(unitRate * quantity);
    }
  }
  return "";
}

function derivedDepositRefundAmount(merged = {}, scope = {}) {
  const payloads = scope.payloads || [];
  let confirmed = 0;
  let deducted = 0;
  let applied = 0;
  let paid = 0;
  for (const payload of payloads) {
    const flat = flattenPayload(payload);
    const eventType = String(payload?.eventType || payload?.EventType || flat.eventType || flat.EventType || "");
    if (eventType === "Accommodation.DepositConfirmed") confirmed += decimal(readValue(flat, "confirmedAmount"));
    if (eventType === "Accommodation.DepositDeducted") deducted += decimal(readValue(flat, "deductionAmount"));
    if (eventType === "Accommodation.DepositAppliedToBalance") applied += decimal(readValue(flat, "applyToBalanceAmount"));
    if (eventType === "Accommodation.DepositRefundPaid") paid += decimal(readValue(flat, "refundAmount"));
  }

  confirmed = confirmed ||
    decimal(readValue(merged, "confirmedAmount")) ||
    decimal(readValue(merged, "receivedAmount")) ||
    decimal(readValue(merged, "requiredDepositAmount"));

  const current = scope.currentValues || {};
  const currentDeduction = decimal(readValue(current, "deductionAmount"));
  const currentApplyToBalance = decimal(readValue(current, "applyToBalanceAmount"));
  const available = confirmed - deducted - applied - paid - currentDeduction - currentApplyToBalance;
  return available > 0 ? String(available) : "";
}

export function contextReferenceDisplayValue(fieldId = "", value = "", payload = {}) {
  if (fieldId === "leadId") return leadDisplayValue(value, payload);
  if (fieldId === "reservationId") return reservationDisplayValue(value, payload);
  if (fieldId === "residentId") return personDisplayValue(value, payload);
  if (fieldId === "roomRef" || fieldId === "roomId") return roomDisplayValue(value, payload);
  if (fieldId === "bedId") return bedDisplayValue(value, payload);
  if (fieldId === "stayId") return stayDisplayValue(value, payload);
  if (fieldId === "taskId") return taskDisplayValue(value, payload);
  if (fieldId === "expenseId") return expenseDisplayValue(value, payload);
  if (fieldId === "periodId") return periodDisplayValue(value, payload);
  return value;
}

function firstContextValue(fieldId, payloads, scope) {
  for (const payload of payloads) {
    const value = generatedContextValue(fieldId, payload, scope);
    if (hasValue(value?.value)) return value;
  }
  return null;
}

function generatedOperationId(fieldId, payload = {}, scope = {}) {
  if (fieldId === "roomId") {
    const building = readValue(payload, "buildingName");
    const roomNo = readValue(payload, "roomNo");
    if (hasValue(roomNo)) return slug(["room", building, roomNo].filter(hasValue).join("-"));
  }
  if (fieldId === "bedId") {
    const roomId = readValue(payload, "roomId") || generatedOperationId("roomId", payload, scope);
    const bedNo = readValue(payload, "bedNo") || parseRoomBed(payload).bedNo;
    if (hasValue(roomId) && hasValue(bedNo)) return slug([roomId, "bed", bedNo].join("-"));
  }
  const rule = idGenerationRules[fieldId];
  if (!rule) return "";
  const parts = rule.sources
    .map((source) => readValue(payload, source))
    .filter(hasValue);
  if (!parts.length) return "";
  const scopePart = [scope.workspace?.id, scope.card?.id].filter(Boolean).join(":");
  return `${rule.prefix}-${stableHash([...parts, scopePart].join("|")).slice(0, 16)}`;
}

function parseRoomBed(payload = {}) {
  const raw = String(readValue(payload, "roomBed") || "");
  const parts = raw.split(/[\/·,，\s]+/).map((item) => item.trim()).filter(Boolean);
  return {
    roomNo: parts.find((item) => /[a-zA-Z]?\d{2,}/.test(item)) || "",
    bedNo: parts.reverse().find((item) => /^\d{1,2}$/.test(item)) || ""
  };
}

function roomDisplayValue(value, payload = {}) {
  const building = readValue(payload, "buildingName");
  const roomNo = readValue(payload, "roomNo") || parseRoomBed(payload).roomNo;
  return [building, roomNo].filter(hasValue).join(" / ") || value;
}

function bedDisplayValue(value, payload = {}) {
  const room = roomDisplayValue(readValue(payload, "roomId") || "", payload);
  const bedNo = readValue(payload, "bedNo") || parseRoomBed(payload).bedNo;
  return [room, bedNo].filter(hasValue).join(" / ") || value;
}

function personDisplayValue(value, payload = {}) {
  const name = readValue(payload, "residentName") || readValue(payload, "guestName") || readValue(payload, "leadName");
  const phone = readValue(payload, "phone");
  return [name, phone].filter(hasValue).join(" · ") || value;
}

function leadDisplayValue(value, payload = {}) {
  const name = readValue(payload, "leadName") || readValue(payload, "guestName") || readValue(payload, "residentName");
  const phone = readValue(payload, "phone");
  const status = businessStatusLabel(readValue(payload, "leadStatus"));
  return [name, phone, status].filter(hasValue).join(" · ") || value;
}

function reservationDisplayValue(value, payload = {}) {
  const name = readValue(payload, "leadName") || readValue(payload, "guestName");
  const date = readValue(payload, "plannedCheckInDate") || readValue(payload, "checkInDate");
  return [name, date].filter(hasValue).join(" · ") || value;
}

function stayDisplayValue(value, payload = {}) {
  const person = personDisplayValue("", payload);
  const bed = bedDisplayValue("", payload);
  return [person, bed].filter(hasValue).join(" · ") || value;
}

function taskDisplayValue(value, payload = {}) {
  const type = readValue(payload, "taskType");
  const area = readValue(payload, "area");
  const date = readValue(payload, "taskDate");
  return [type, area, date].filter(hasValue).join(" · ") || value;
}

function expenseDisplayValue(value, payload = {}) {
  const category = readValue(payload, "expenseCategory");
  const amount = readValue(payload, "expenseAmount");
  return [category, amount].filter(hasValue).join(" · ") || value;
}

function periodDisplayValue(value, payload = {}) {
  const year = readValue(payload, "periodYear");
  const no = readValue(payload, "periodNo");
  return [year, no].filter(hasValue).join(" / ") || value;
}

function mergePayloads(payloads = []) {
  return payloads.reduce((current, payload) => ({ ...current, ...flattenPayload(payload) }), {});
}

function flattenPayload(payload = {}) {
  const plain = isPlainObject(payload) ? payload : {};
  return {
    ...objectMap(plain.fieldValues),
    ...objectMap(plain.FieldValues),
    ...objectMap(plain.input?.fieldValues),
    ...objectMap(plain.Input?.fieldValues),
    ...objectMap(plain.payload),
    ...objectMap(plain.Payload),
    ...plain
  };
}

function objectMap(value) {
  return isPlainObject(value) ? value : {};
}

function readValue(payload = {}, key = "") {
  const aliases = [key, ...(valueAliases[key] || [])];
  for (const alias of aliases) {
    const value = payload[alias];
    if (hasValue(value)) return String(value);
  }
  return "";
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function decimal(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function slug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableHash(value = "") {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function businessStatusLabel(value = "") {
  const labels = {
    new: "新线索",
    contacted: "已联系",
    interested: "有意向",
    reserved: "已预订",
    converted: "已转入住",
    cancelled: "已取消",
    closed: "已关闭"
  };
  return labels[String(value || "").toLowerCase()] || value;
}
