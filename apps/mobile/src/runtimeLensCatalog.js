const workspaceLensIds = {
  "W-STAY-RESOURCE": ["room-readiness", "bed-inventory", "rate-plan", "room-revenue-potential"],
  "W-STAY-CHECKIN": ["today-operations", "active-stay", "deposit-liability", "payment-risk", "stay-balance"],
  "W-STAY-LEAD-RESERVATION": ["lead-funnel"],
  "W-STAY-LIFECYCLE": ["active-stay", "stay-balance"],
  "W-STAY-DEPOSIT-LEDGER": ["deposit-liability"],
  "W-STAY-PAYMENT-LEDGER": ["payment-risk", "stay-balance"],
  "W-STAY-CHECKOUT-SETTLEMENT": ["checkout-queue"],
  "W-STAY-SERVICE-TASK": ["service-task-queue"],
  "W-STAY-EXPENSE-LEDGER": ["expense-analytics"],
  "W-STAY-PERIOD-ANALYTICS": ["period-performance", "risk-command"]
};

export const defaultAccommodationLensIds = Array.from(new Set(Object.values(workspaceLensIds).flat()));

const lensTitles = {
  "room-readiness": { "zh-CN": "房间可售", "ru-RU": "Готовность комнат" },
  "bed-inventory": { "zh-CN": "床位库存", "ru-RU": "Инвентарь коек" },
  "rate-plan": { "zh-CN": "价格规则", "ru-RU": "Тарифы" },
  "room-revenue-potential": { "zh-CN": "房间潜在收入", "ru-RU": "Потенциал комнат" },
  "today-operations": { "zh-CN": "今日经营", "ru-RU": "Операции сегодня" },
  "active-stay": { "zh-CN": "在住入住单", "ru-RU": "Активные проживания" },
  "deposit-liability": { "zh-CN": "押金负债", "ru-RU": "Депозитные обязательства" },
  "payment-risk": { "zh-CN": "收款风险", "ru-RU": "Риски оплат" },
  "stay-balance": { "zh-CN": "入住余额", "ru-RU": "Балансы проживания" },
  "lead-funnel": { "zh-CN": "线索漏斗", "ru-RU": "Воронка лидов" },
  "checkout-queue": { "zh-CN": "退住队列", "ru-RU": "Очередь выселения" },
  "service-task-queue": { "zh-CN": "服务任务", "ru-RU": "Сервисные задачи" },
  "expense-analytics": { "zh-CN": "成本分析", "ru-RU": "Аналитика расходов" },
  "period-performance": { "zh-CN": "周期表现", "ru-RU": "Итоги периода" },
  "risk-command": { "zh-CN": "风险驾驶舱", "ru-RU": "Пульт рисков" }
};

const previewFields = {
  "room-readiness": ["roomNo", "status", "capacity"],
  "bed-inventory": ["bedNo", "status", "roomId"],
  "rate-plan": ["roomId", "monthlyRatePerBed", "currency"],
  "room-revenue-potential": ["roomNo", "monthlyRevenuePotential", "currency"],
  "today-operations": ["todayCheckIns", "pendingPayments", "openDeposits"],
  "active-stay": ["residentName", "roomBed", "status"],
  "deposit-liability": ["depositId", "liabilityBalance", "currency"],
  "payment-risk": ["paymentId", "amount", "status"],
  "stay-balance": ["stayId", "balance", "currency"],
  "lead-funnel": ["sourceChannel", "leadCount", "reservationRate"],
  "checkout-queue": ["checkoutId", "currentBalance", "status"],
  "service-task-queue": ["taskId", "taskType", "status"],
  "expense-analytics": ["expenseCategory", "approvedAmount", "currency"],
  "period-performance": ["periodId", "periodNetCashFlow", "status"],
  "risk-command": ["riskType", "severity", "amount", "count", "resolveAction"]
};

export function lensIdsForWorkspace(workspaceId) {
  return workspaceLensIds[workspaceId] || [];
}

export function lensTitle(lensId, lang = "zh-CN") {
  return lensTitles[lensId]?.[lang] || lensTitles[lensId]?.["zh-CN"] || lensId;
}

export function lensPreview(lensId, items) {
  const first = Array.isArray(items) ? items[0] : null;
  if (!first) return "";
  return (previewFields[lensId] || Object.keys(first).slice(1, 4))
    .map((key) => first[key])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .join(" · ");
}
