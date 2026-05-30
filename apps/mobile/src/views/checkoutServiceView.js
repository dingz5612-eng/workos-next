const checkoutWorkspaceIds = new Set(["W-STAY-CHECKOUT-SETTLEMENT", "W-STAY-CHECKOUT"]);
const serviceWorkspaceId = "W-STAY-SERVICE-TASK";

const timelinePhases = [
  {
    key: "checkoutStart",
    label: "退住开始",
    cards: ["checkoutStart"],
    events: ["Accommodation.CheckoutStarted", "Accommodation.ResidentCheckedOut"]
  },
  {
    key: "roomInspection",
    label: "查房",
    cards: ["roomInspection"],
    events: ["Accommodation.RoomInspectionStarted", "Accommodation.RoomInspected"]
  },
  {
    key: "depositSettlement",
    label: "押金处理",
    cards: ["depositSettlement"],
    events: ["Accommodation.DepositSettlementRequested", "Accommodation.DepositSettled"]
  },
  {
    key: "finalBalanceClose",
    label: "余额关闭",
    cards: ["finalBalanceClose"],
    events: ["Accommodation.BalanceCloseRequested", "Accommodation.BalanceClosed"]
  },
  {
    key: "service",
    label: "清洁/维修",
    cards: ["postCheckoutCleaning", "serviceTaskCreate", "serviceTaskComplete", "serviceTaskVerify"],
    events: ["Accommodation.ServiceTaskCreated", "Accommodation.ServiceTaskCompleted", "Accommodation.ServiceTaskVerified"]
  },
  {
    key: "release",
    label: "床位释放",
    cards: ["bedRelease", "roomReleaseAfterService"],
    events: ["Accommodation.ResourceReleaseRequested", "Accommodation.BedReleased", "Accommodation.RoomReleased"]
  },
  {
    key: "closed",
    label: "关闭",
    cards: [],
    events: ["Accommodation.CheckoutCaseClosed"]
  }
];

const resolveActionMap = {
  createBalanceCloseWorkItem: { workspaceId: "W-STAY-CHECKOUT-SETTLEMENT", cardId: "finalBalanceClose" },
  createDepositSettlementWorkItem: { workspaceId: "W-STAY-CHECKOUT-SETTLEMENT", cardId: "depositSettlement" },
  createCleaningServiceTask: { workspaceId: serviceWorkspaceId, cardId: "serviceTaskCreate" },
  createEvidenceUploadWorkItem: { workspaceId: "W-STAY-CHECKOUT-SETTLEMENT", cardId: "roomInspection" },
  createResourceReleaseWorkItem: { workspaceId: "W-STAY-CHECKOUT-SETTLEMENT", cardId: "bedRelease" }
};

export function isCheckoutServiceWorkspace(item) {
  return Boolean(item && (checkoutWorkspaceIds.has(item.id) || item.id === serviceWorkspaceId));
}

export function checkoutServiceMobilePanel(item, activeCard, ctx) {
  if (!isCheckoutServiceWorkspace(item)) return "";
  const checkout = checkoutWorkspace(ctx) || item;
  const serviceItems = serviceTaskItems(ctx);
  const blockers = blockerItems(item, activeCard, ctx);
  return `
    <section class="checkout-service mobile" data-checkout-service-mobile>
      <header>
        <span>Checkout / Service</span>
        <h2>退住与服务任务</h2>
      </header>
      <div class="checkout-actions">
        ${checkoutStartAction(checkout, ctx)}
        ${operationAction("W-STAY-SERVICE-TASK", "serviceTaskComplete", "ServiceTask complete / upload evidence", "data-service-task-complete", ctx)}
      </div>
      ${caseTimeline(checkout, activeCard, ctx, "mobile")}
      ${mobileCheckoutSummary(ctx)}
      ${serviceTaskCards(serviceItems, ctx)}
      ${blockerPanel(blockers, ctx, "mobile")}
    </section>
  `;
}

export function checkoutServiceOperationAddon(card, item, ctx) {
  if (!isCheckoutServiceWorkspace(item)) return "";
  const blockers = blockerItems(item, card, ctx);
  const damageFields = damageAssessmentFields(card, ctx);
  const serviceCopy = serviceOperationCopy(card);
  return `
    <section class="checkout-operation-addon" data-checkout-operation-addon>
      <b>Checkout / Service guardrail</b>
      <p>所有 action 仍走当前 WorkItem 的 Operations Confirm；这里不提供 page-specific checkout API。</p>
      ${damageFields.length ? `
        <div class="damage-fields" data-damage-assessment-fields>
          <strong>DamageAssessment fields</strong>
          ${damageFields.map((field) => `<span data-damage-assessment-field="${ctx.escapeAttr(field.id)}">${ctx.localTerm(field)}</span>`).join("")}
        </div>
      ` : ""}
      ${serviceCopy ? `<p data-service-task-operation>${serviceCopy}</p>` : ""}
      ${blockers.length ? blockerPanel(blockers, ctx, "inline") : ""}
    </section>
  `;
}

export function pcManagerLiteView(ctx) {
  const checkout = checkoutWorkspace(ctx);
  const activeCard = checkout?.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || checkout?.cards?.[0];
  const blockers = blockerItems(checkout, activeCard, ctx);
  const serviceItems = serviceTaskItems(ctx);
  const overdue = overdueWorkItems(ctx);
  const checks = caseClosureChecks(ctx);
  return ctx.shell(`
    <section class="pc-manager-lite" data-pc-manager-lite>
      <header>
        <span>PC Manager Lite</span>
        <h1>Checkout Manager</h1>
      </header>
      ${caseTimeline(checkout, activeCard, ctx, "pc")}
      ${blockerTable(blockers, ctx)}
      ${serviceTaskTable(serviceItems, ctx)}
      ${overduePanel(overdue, ctx)}
      ${caseClosureCheckDetail(checks, ctx)}
    </section>
  `);
}

export function caseTimeline(item, activeCard, ctx, mode = "mobile") {
  const events = ctx.state.projectionEvents || ctx.state.runtimeStore?.events || [];
  const cards = item?.cards || [];
  return `
    <section class="checkout-timeline ${mode}" data-checkout-case-timeline>
      <b>Checkout Case Timeline</b>
      <ol>
        ${timelinePhases.map((phase) => timelineStep(phase, cards, activeCard, events, ctx)).join("")}
      </ol>
    </section>
  `;
}

function timelineStep(phase, cards, activeCard, events, ctx) {
  const status = phaseStatus(phase, cards, activeCard, events);
  return `
    <li class="${status}" data-timeline-phase="${phase.key}">
      <span>${escape(ctx, phase.label)}</span>
      <small>${escape(ctx, statusLabel(status))}</small>
    </li>
  `;
}

function phaseStatus(phase, cards, activeCard, events) {
  if (phase.events.some((eventType) => events.some((event) => event.eventType === eventType))) return "done";
  const matchedCards = cards.filter((card) => phase.cards.includes(card.id));
  if (matchedCards.some((card) => card.status === "done")) return "done";
  if (matchedCards.some((card) => card.status === "blocked")) return "blocked";
  if (activeCard && phase.cards.includes(activeCard.id)) return "current";
  if (matchedCards.some((card) => ["ready", "inProgress"].includes(card.status))) return "current";
  return "pending";
}

function statusLabel(status) {
  return {
    done: "已完成",
    blocked: "被阻断",
    current: "当前",
    pending: "待处理"
  }[status] || status;
}

function checkoutStartAction(checkout, ctx) {
  const checkoutStart = checkout?.cards?.find((card) => card.id === "checkoutStart");
  if (!checkoutStart) return "";
  return operationAction(checkout.id, "checkoutStart", "发起退住 action", "data-checkout-start-action", ctx);
}

function operationAction(workspaceId, cardId, label, dataAttr, ctx) {
  return `<button ${dataAttr} data-workspace="${ctx.escapeAttr(workspaceId)}" data-card-id="${ctx.escapeAttr(cardId)}">${escape(ctx, label)}</button>`;
}

function mobileCheckoutSummary(ctx) {
  const checkoutRows = lensItems(ctx, "checkout-queue");
  const first = checkoutRows[0] || {};
  return `
    <section class="checkout-summary" data-checkout-summary>
      <b>摘要</b>
      <dl>
        ${summaryField("checkoutId", first.checkoutId || first.caseId || "pending", ctx)}
        ${summaryField("currentBalance", first.currentBalance ?? first.outstandingBalance ?? "summary only", ctx)}
        ${summaryField("status", first.status || "open", ctx)}
      </dl>
    </section>
  `;
}

function summaryField(label, value, ctx) {
  return `<div><dt>${escape(ctx, label)}</dt><dd>${escape(ctx, value)}</dd></div>`;
}

function serviceTaskCards(items, ctx) {
  return `
    <section class="service-task-cards" data-service-task-cards>
      <b>ServiceTask card</b>
      ${items.length ? items.map((item) => `
        <article data-service-task-card>
          <strong>${escape(ctx, item.taskType || item.title || item.taskId || "service task")}</strong>
          <span>${escape(ctx, item.status || "pending")} · ${escape(ctx, item.assignedRole || item.ownerRole || "operator")}</span>
          <small>${escape(ctx, item.dueAt || item.dueAtUtc || item.targetDate || "no due date")}</small>
          <button data-workspace="${serviceWorkspaceId}" data-card-id="serviceTaskComplete" data-service-task-complete>${escape(ctx, "完成 / 上传凭证")}</button>
        </article>
      `).join("") : `<p>${escape(ctx, "暂无服务任务")}</p>`}
    </section>
  `;
}

function blockerPanel(blockers, ctx, mode) {
  return `
    <section class="blocker-panel ${mode}" data-checkout-blockers>
      <b>Blocker display</b>
      ${blockers.length ? blockers.map((blocker) => blockerCard(blocker, ctx)).join("") : `<p>${escape(ctx, "当前没有阻断")}</p>`}
    </section>
  `;
}

function blockerCard(blocker, ctx) {
  const target = targetForBlocker(blocker);
  return `
    <article class="blocker-card" data-blocker-code="${ctx.escapeAttr(blocker.code)}">
      <strong>${escape(ctx, blocker.message)}</strong>
      <dl>
        ${summaryField("阻断原因", blocker.message, ctx)}
        ${summaryField("责任角色", blocker.ownerRole, ctx)}
        ${summaryField("处理动作", blocker.resolveAction, ctx)}
        ${summaryField("相关对象", blocker.relatedObject, ctx)}
        ${summaryField("截止时间", blocker.dueAt || "未设置", ctx)}
      </dl>
      <button data-blocker-resolve data-resolve-action="${ctx.escapeAttr(blocker.resolveAction)}" data-workspace="${ctx.escapeAttr(target.workspaceId)}" data-card-id="${ctx.escapeAttr(target.cardId)}">${escape(ctx, "处理动作")}</button>
    </article>
  `;
}

function blockerTable(blockers, ctx) {
  return `
    <section class="manager-panel" data-pc-blocker-list>
      <h2>Blocker List</h2>
      ${blockers.length ? `
      <table>
        <thead><tr><th>阻断原因</th><th>责任角色</th><th>处理动作</th><th>相关对象</th><th>截止时间</th></tr></thead>
        <tbody>
          ${blockers.map((blocker) => `<tr>
            <td>${escape(ctx, blocker.message)}</td>
            <td>${escape(ctx, blocker.ownerRole)}</td>
            <td>${escape(ctx, blocker.resolveAction)}</td>
            <td>${escape(ctx, blocker.relatedObject)}</td>
            <td>${escape(ctx, blocker.dueAt || "未设置")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      ` : `<p>${escape(ctx, "暂无 open blocker")}</p>`}
    </section>
  `;
}

function serviceTaskTable(items, ctx) {
  return `
    <section class="manager-panel" data-pc-service-task-table>
      <h2>ServiceTask Table</h2>
      ${items.length ? `
      <table>
        <thead><tr><th>taskId</th><th>type</th><th>status</th><th>owner</th><th>due</th></tr></thead>
        <tbody>
          ${items.map((item) => `<tr>
            <td>${escape(ctx, item.taskId || item.serviceTaskId || "-")}</td>
            <td>${escape(ctx, item.taskType || item.title || "-")}</td>
            <td>${escape(ctx, item.status || "-")}</td>
            <td>${escape(ctx, item.assignedRole || item.ownerRole || "-")}</td>
            <td>${escape(ctx, item.dueAt || item.dueAtUtc || item.targetDate || "-")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      ` : `<p>${escape(ctx, "暂无服务任务")}</p>`}
    </section>
  `;
}

function overduePanel(items, ctx) {
  return `
    <section class="manager-panel" data-pc-overdue-workitems>
      <h2>Overdue WorkItems</h2>
      ${items.length ? items.map((item) => `<article><strong>${escape(ctx, item.workItemId || item.queueItemId || item.cardId || "workItem")}</strong><span>${escape(ctx, item.dueAt || item.dueAtUtc || "overdue")}</span></article>`).join("") : `<p>${escape(ctx, "暂无超时 WorkItem")}</p>`}
    </section>
  `;
}

function caseClosureCheckDetail(checks, ctx) {
  return `
    <section class="manager-panel" data-case-closure-check-detail>
      <h2>CaseClosureCheck detail</h2>
      ${checks.length ? checks.map((check) => `
        <article>
          <strong>${escape(ctx, check.checkId || check.caseClosureCheckId || check.eventId || "closure-check")}</strong>
          <span>canClose=${escape(ctx, check.canClose ?? false)} · blockers=${escape(ctx, check.blockerCount ?? check.blockers?.length ?? 0)} · ${escape(ctx, check.status || "recorded")}</span>
        </article>
      `).join("") : `<p>${escape(ctx, "暂无 CaseClosureCheck")}</p>`}
    </section>
  `;
}

function blockerItems(item, activeCard, ctx) {
  const fromCard = activeCard?.blockerRules || [];
  const fromWorkspace = item?.blockers || [];
  const fromState = ctx.state.checkoutManager?.blockers || ctx.state.pcManager?.blockers || [];
  const fromEvents = blockerEvents(ctx);
  const seen = new Set();
  return [...fromState, ...fromEvents, ...fromCard, ...fromWorkspace]
    .map((entry) => normalizeBlocker(entry, ctx))
    .filter((entry) => {
      const key = `${entry.code}:${entry.relatedObject}:${entry.resolveAction}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeBlocker(entry, ctx) {
  const code = entry.blockerCode || entry.blockerKey || entry.id || "CASE_BLOCKER";
  const message = entry.message || txValue(entry.title, ctx) || code;
  const ownerRole = entry.ownerRole || entry.owner || "manager";
  const resolveAction = entry.resolveAction || txValue(entry.unblockAction, ctx) || "createResolutionWorkItem";
  const relatedObject = entry.relatedObject || [entry.relatedObjectType, entry.relatedObjectId].filter(Boolean).join(":") || entry.caseId || "checkout";
  return {
    code,
    message,
    ownerRole,
    resolveAction,
    relatedObject,
    dueAt: entry.dueAt || entry.dueAtUtc || entry.slaDueAtUtc || entry.deadline || "",
    targetWorkspaceId: entry.resolutionWorkspaceId || entry.targetWorkspaceId,
    targetCardId: entry.resolutionCardId || entry.targetCardId
  };
}

function blockerEvents(ctx) {
  return (ctx.state.projectionEvents || [])
    .filter((event) => event.eventType === "Accommodation.CaseClosurePolicyFailed" || event.eventType === "Accommodation.CaseBlockerCreated")
    .map((event) => ({
      eventId: event.eventId,
      ...(event.payload || {}),
      message: event.payload?.message || event.payload?.blockerMessage,
      dueAt: event.payload?.dueAtUtc,
      relatedObject: [event.payload?.relatedObjectType, event.payload?.relatedObjectId].filter(Boolean).join(":")
    }));
}

function targetForBlocker(blocker) {
  if (blocker.targetWorkspaceId && blocker.targetCardId) {
    return { workspaceId: blocker.targetWorkspaceId, cardId: blocker.targetCardId };
  }
  return resolveActionMap[blocker.resolveAction] || { workspaceId: "W-STAY-CHECKOUT-SETTLEMENT", cardId: "roomInspection" };
}

function damageAssessmentFields(card, ctx) {
  return (card?.fields?.business || []).filter((field) => {
    const label = txValue(field.label, ctx);
    return field.id?.toLocaleLowerCase().includes("damage") || label.includes("损坏") || label.includes("Damage");
  });
}

function serviceOperationCopy(card) {
  if (!card?.id?.startsWith("serviceTask") && card?.id !== "roomReleaseAfterService" && card?.id !== "postCheckoutCleaning") return "";
  if (card.id === "serviceTaskComplete") return "ServiceTask complete / upload evidence：完成动作需保留凭证，提交仍由 Operations Confirm 写入。";
  if (card.id === "serviceTaskVerify") return "ServiceTask verify：验收后只请求 ResourceInventory 释放，不直接改床位。";
  return "ServiceTask card：创建、分派、完成、验收都保留 WorkItem / Submission / Event 链路。";
}

function checkoutWorkspace(ctx) {
  return (ctx.state.runtimeStore?.workspaces || []).find((workspace) => workspace.id === "W-STAY-CHECKOUT-SETTLEMENT")
    || (ctx.state.runtimeStore?.workspaces || []).find((workspace) => checkoutWorkspaceIds.has(workspace.id));
}

function serviceTaskItems(ctx) {
  return lensItems(ctx, "service-task-queue");
}

function lensItems(ctx, lensId) {
  return ctx.state.accommodationLenses?.[lensId]
    || ctx.state.runtimeStore?.accommodationLenses?.[lensId]
    || [];
}

function overdueWorkItems(ctx) {
  const now = Date.now();
  return (ctx.state.runtimeStore?.workQueue || [])
    .filter((item) => {
      const due = item.dueAt || item.dueAtUtc;
      return item.status === "overdue" || item.badges?.includes("overdue") || (due && Date.parse(due) < now);
    });
}

function caseClosureChecks(ctx) {
  const configured = ctx.state.checkoutManager?.caseClosureChecks || ctx.state.pcManager?.caseClosureChecks || [];
  const eventChecks = (ctx.state.projectionEvents || [])
    .filter((event) => event.eventType === "Accommodation.CaseClosurePolicyEvaluationRequested" || event.eventType === "Accommodation.CaseClosurePolicyFailed")
    .map((event) => ({
      checkId: event.payload?.caseClosureCheckId || event.eventId,
      canClose: event.eventType !== "Accommodation.CaseClosurePolicyFailed",
      blockerCount: Number(event.payload?.blockerCount || (event.eventType === "Accommodation.CaseClosurePolicyFailed" ? 1 : 0)),
      status: event.eventType
    }));
  return [...configured, ...eventChecks];
}

function txValue(value, ctx) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[ctx.state.lang] || value["zh-CN"] || Object.values(value)[0] || "";
}

function escape(ctx, value) {
  return ctx.escapeHtml(String(value ?? ""));
}
