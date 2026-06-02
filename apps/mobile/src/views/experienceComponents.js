import { loadDraft } from "../operationDrafts.js";
import { permissionDiagnosticCopy } from "../surfaceGuard.js";
import {
  DeviceTrustVM,
  OperationPanelVM,
  QueueStateVM,
  TrustedConfirmVM,
  WorkItemDecisionVM
} from "../viewModels/index.js";

export function WorkItemCard(item, ctx) {
  const model = workItemModel(item, ctx);
  const evidence = model.requiredEvidence.length ? model.requiredEvidence.join(" · ") : "-";
  const canHandle = model.canHandleLabel;
  const blocker = model.blocker;
  const workspaceButton = `<button data-work-item-id="${attr(model.workItemId, ctx)}" data-workspace-id="${attr(model.workspaceId, ctx)}" data-card-id="${attr(model.cardId, ctx)}">${text(ctx.tr("openWorkspace"), ctx)}</button>`;
  const debug = ctx.state?.debugSurface ? `<details class="debug-only"><summary>${text(ctx.tr("debugTrace"), ctx)}</summary><dl>
      ${field("workItemId", model.workItemId, ctx)}
      ${field("caseId", model.caseId, ctx)}
      ${field("traceRefs", model.traceRefs.join(" · ") || "-", ctx)}
    </dl></details>` : "";

  return `<article class="workitem-card action-decision-card risk-${attr(model.riskLevel, ctx)}" data-surface="action-decision-card">
    <div class="workitem-card-head">
      <div>
        <span>${text(canHandle, ctx)} · ${text(model.workItemType, ctx)}</span>
        <strong>${text(model.displayTitle, ctx)}</strong>
      </div>
      ${workspaceButton}
    </div>
    <dl class="workitem-card-grid">
      ${field(ctx.tr("decisionCanHandle"), canHandle, ctx)}
      ${field(ctx.tr("decisionBlocker"), blocker, ctx)}
      ${field(ctx.tr("decisionMissingEvidence"), evidence, ctx)}
      ${field(ctx.tr("decisionNextAction"), model.nextAction, ctx)}
      ${field(ctx.tr("decisionRisk"), model.riskLevel, ctx)}
      ${field(ctx.tr("decisionOwner"), model.ownerRoleLabel, ctx)}
      ${field(ctx.tr("decisionDueAt"), model.dueAt, ctx)}
      ${field(ctx.tr("decisionBusinessObject"), model.businessObject, ctx)}
    </dl>
    ${debug}
  </article>`;
}

export function LifecycleWorkspace(item, activeCard, ctx) {
  const model = workItemModel({ workspace: item, card: activeCard, workspaceId: item.id, cardId: activeCard.id }, ctx);
  const fields = activeCard.fields?.business || [];
  const evidence = activeCard.evidence || [];
  const blockers = activeCard.blockerRules?.length ? activeCard.blockerRules : item.blockers || [];
  return `<section class="lifecycle-workspace" data-surface="lifecycle-workspace">
    <article>
      <span>${text(ctx.tr("objectSummary"), ctx)}</span>
      <strong>${text(model.businessObject, ctx)}</strong>
      <p>${text(tx(item.summary, ctx), ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("currentState"), ctx)}</span>
      <strong>${text(ctx.tr(model.lifecycleState) || model.lifecycleState, ctx)}</strong>
      <p>${text(model.nextAction, ctx)}</p>
    </article>
    <article class="lifecycle-wide">
      <span>${text(ctx.tr("lifecycleTimeline"), ctx)}</span>
      <div class="lifecycle-timeline">${(item.cards || []).map((card) => `<span class="${attr(card.id === activeCard.id ? "current" : card.status, ctx)}">${text(tx(card.title, ctx), ctx)} · ${text(card.status, ctx)}</span>`).join("")}</div>
    </article>
    <article>
      <span>${text(ctx.tr("currentWorkItem"), ctx)}</span>
      <strong>${text(model.workItemType, ctx)}</strong>
      <p>${text(model.nextAction, ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("requiredFields"), ctx)}</span>
      <p>${fields.length ? fields.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : "-"}</p>
    </article>
    <article>
      <span>${text(ctx.tr("requiredEvidenceCopy"), ctx)}</span>
      <p>${evidence.length ? evidence.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : "-"}</p>
    </article>
    <article>
      <span>${text(ctx.tr("businessImpact"), ctx)}</span>
      <p>${text(item.domain, ctx)} · ${text(model.SLA, ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("riskAndBlockers"), ctx)}</span>
      <p>${blockers.length ? blockers.map((entry) => text(tx(entry.title || entry, ctx), ctx)).join(" · ") : text(ctx.tr("noCriticalBlocker"), ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("auditSummary"), ctx)}</span>
      <p>${model.traceRefs.length ? text(ctx.tr("traceBound"), ctx) : text(ctx.tr("traceWillBind"), ctx)}</p>
    </article>
    <article>
      <span>${text(ctx.tr("nextAction"), ctx)}</span>
      <p>${text(model.nextAction, ctx)}</p>
    </article>
  </section>`;
}

export function OperationPanelView(innerHtml, item, activeCard, ctx) {
  const workspace = item.workspace || item;
  const model = workItemModel({ ...item, workspace, card: activeCard, workspaceId: item.workspaceId || workspace.id, cardId: item.cardId || activeCard.id }, ctx);
  const vm = OperationPanelVM({ ...item, workspace, card: activeCard }, ctx);
  return `<section class="operation-panel-view" data-surface="operation-panel-runtime">
    <div class="operation-panel-head">
      <span>${text(ctx.tr("operationPanel"), ctx)}</span>
      <strong>${text(vm.subtitle, ctx)}</strong>
      <small>${text(vm.title, ctx)} · ${text(vm.trace.status, ctx)}</small>
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
      <p>${text(ctx.tr("policyRef"), ctx)} ${text(vm.evidenceAndPermission.policyRef, ctx)} · ${text(ctx.tr("decisionRisk"), ctx)} ${text(vm.evidenceAndPermission.risk, ctx)}</p>
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

export function ActionResult(result = {}, ctx) {
  if (!result.status && !result.message) return "";
  if (result.status === "committed_projection_pending") return ProjectionPendingState(result, ctx);
  if (result.status === "committed_projection_failed") return FailedSyncState(result, ctx);
  if (result.status === "permission_blocked_403") return PermissionDiagnostic(result.permissionDiagnostic || result, ctx);
  const status = result.status || "network_unknown";
  return `<section class="action-result ${attr(status, ctx)}" data-surface="action-result">
    <b>${text(ctx.tr("actionResult"), ctx)}</b>
    <p>${text(result.message || status, ctx)}</p>
    ${result.commandSubmissionId ? `<small>${ctx.tr("submissionRecord")}: ${ctx.tr("traceAvailable")}</small>` : ""}
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
  const selected = saved ? "selected attached" : "missing";
  const evidenceDraftId = saved?.evidenceId ? `data-evidence-draft-id="${attr(saved.evidenceId, ctx)}"` : "";
  return `<button type="button" class="evidence-tile ${selected}" data-surface="evidence-tile" data-evidence-id="${attr(field.id, ctx)}" ${evidenceDraftId} ${disabled}>
    <span>${text(ctx.localTerm(field), ctx)}</span>
    <small>${saved ? "已生成证据草稿，待上传真实附件并完成可信校验" : "证据需求未满足，缺少证据时提交会被阻断"}</small>
  </button>`;
}

export function EvidenceSheet(card, draft, ctx) {
  const evidence = card.evidence || [];
  const attached = (draft.evidenceDrafts || []).length;
  return `<section class="evidence-sheet" data-surface="evidence-sheet">
    <b>${text(ctx.tr("trustedEvidence"), ctx)}</b>
    <p>${evidence.length ? evidence.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : text(ctx.tr("noRequiredEvidence"), ctx)}</p>
    <small>${attached}/${evidence.length} ${text(attached >= evidence.length && evidence.length ? ctx.tr("evidenceReady") : ctx.tr("evidenceNeedReview"), ctx)}</small>
  </section>`;
}

export function PermissionDiagnostic(decision = {}, ctx) {
  const copy = permissionDiagnosticCopy(decision);
  return `<section class="permission-diagnostic" data-surface="permission-diagnostic">
    <span>${ctx.tr("permissionDiagnostic")}</span>
    <h1>${text(copy.reason, ctx)}</h1>
    <dl>
      ${field(ctx.tr("permissionWhy"), copy.reason, ctx)}
      ${field(ctx.tr("permissionOwner"), copy.owner, ctx)}
      ${field(ctx.tr("requiredPermission"), copy.requiredPermission, ctx)}
      ${field(ctx.tr("permissionNextAction"), copy.nextAction, ctx)}
    </dl>
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
  const vm = WorkItemDecisionVM({ ...item, workspace, card }, ctx);
  return {
    ...vm,
    workspaceId: item.workspaceId || workspace?.id || "",
    cardId: item.cardId || card?.id || "",
    workItemId: vm.sourceRefs.workItemId || runtimeItem?.workItemId || runtimeItem?.work_item_id || persistedWorkItemIdFor(workspace, card) || persistedCandidate(item.workItemId || item.work_item_id) || item.queueItemId || "",
    caseId: vm.sourceRefs.caseId || item.caseId || item.case_id || runtimeItem?.caseId || runtimeItem?.case_id || workspace?.caseId || workspace?.id || "",
    workItemType: vm.typeLabel,
    lifecycleState: item.lifecycleState || item.lifecycle_state || item.status || runtimeItem?.lifecycleState || runtimeItem?.lifecycle_state || runtimeItem?.status || card?.status || "ready",
    ownerRole: item.ownerRole || item.owner_role || runtimeItem?.ownerRole || runtimeItem?.owner_role || card?.confirmation?.requiredRole || card?.Confirmation?.requiredRole || "operator",
    SLA: vm.slaLabel,
    requiredEvidence: vm.requiredEvidenceLabels,
    nextAction: vm.nextAction,
    traceRefs: array(item.traceRefs || item.trace_refs || item.commandSubmissionId || item.command_submission_id || workspace?.traceRefs),
    riskLevel: vm.riskLabel,
    evidenceState: item.evidenceState || ((drafts.evidenceDrafts || []).length >= evidence.length && evidence.length ? "attached" : evidence.length ? "missing" : "not_required"),
    dueAt: vm.dueAtLabel,
    businessObject: vm.businessObject
  };
}

function persistedCandidate(value) {
  return isPersistedWorkItemId(value) ? value : "";
}

function runtimeWorkItemFor(item, workspace, card, ctx) {
  const selectedWorkItemId = ctx?.state?.selectedWorkItemId || item.workItemId || item.work_item_id || "";
  const runtimeItems = [
    ...(ctx?.state?.runtimeStore?.operationWorkItems || []),
    ...(ctx?.state?.runtimeStore?.workQueue || [])
  ];
  return runtimeItems.find((entry) =>
    [entry.workItemId, entry.work_item_id].includes(selectedWorkItemId)) ||
    runtimeItems.find((entry) =>
      (entry.workspaceId || entry.workspace_id) === workspace?.id &&
      (!(entry.cardId || entry.card_id) || (entry.cardId || entry.card_id) === card?.id) &&
      (entry.workItemId || entry.work_item_id));
}

function persistedWorkItemIdFor(workspace, card) {
  if (workspace?.runtimeWorkItemId) return workspace.runtimeWorkItemId;
  if (card?.runtimeWorkItemId) return card.runtimeWorkItemId;
  if (workspace?.workItemId && isPersistedWorkItemId(workspace.workItemId)) return workspace.workItemId;
  if (card?.workItemId && isPersistedWorkItemId(card.workItemId)) return card.workItemId;
  if (workspace?.id && card?.id) return `${workspace.id}:${card.id}`;
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
  return workspace?.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || workspace?.cards?.[0] || {};
}

function roleLabel(role, ctx) {
  const labels = {
    frontdesk: ctx.tr("operatorRole"),
    operator: ctx.tr("operatorRole"),
    housekeeping: ctx.tr("operatorRole"),
    finance: ctx.tr("financeRole"),
    manager: ctx.tr("managerRole"),
    admin: "admin",
    releaseOwner: "releaseOwner"
  };
  return labels[role] || role;
}

function field(label, value, ctx) {
  return `<dt>${text(label, ctx)}</dt><dd>${text(value || "-", ctx)}</dd>`;
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

function text(value, ctx) {
  return ctx.escapeHtml ? ctx.escapeHtml(String(value ?? "")) : String(value ?? "");
}

function attr(value, ctx) {
  return ctx.escapeAttr ? ctx.escapeAttr(String(value ?? "")) : text(value, ctx);
}
