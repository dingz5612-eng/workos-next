import { loadDraft } from "../operationDrafts.js";
import { permissionDiagnosticCopy } from "../surfaceGuard.js";

export function WorkItemCard(item, ctx) {
  const model = workItemModel(item, ctx);
  const traceRefs = model.traceRefs.length ? model.traceRefs.join(" · ") : "-";
  const evidence = model.requiredEvidence.length ? model.requiredEvidence.join(" · ") : "-";
  const workspaceButton = model.workspaceId
    ? `<button data-workspace="${attr(model.workspaceId, ctx)}" data-card-id="${attr(model.cardId, ctx)}">${text(ctx.tr("openWorkspace"), ctx)}</button>`
    : `<button data-work-item-id="${attr(model.workItemId, ctx)}">${text(ctx.tr("openWorkspace"), ctx)}</button>`;

  return `<article class="workitem-card risk-${attr(model.riskLevel, ctx)}" data-component="WorkItemCard">
    <div class="workitem-card-head">
      <div>
        <span>${text(model.workItemType, ctx)} · ${text(model.lifecycleState, ctx)} · ${text(model.ownerRole, ctx)}</span>
        <strong>${text(model.businessObject, ctx)}</strong>
      </div>
      ${workspaceButton}
    </div>
    <dl class="workitem-card-grid">
      ${field("workItemId", model.workItemId, ctx)}
      ${field("caseId", model.caseId, ctx)}
      ${field("workItemType", model.workItemType, ctx)}
      ${field("lifecycleState", model.lifecycleState, ctx)}
      ${field("ownerRole", model.ownerRole, ctx)}
      ${field("SLA", model.SLA, ctx)}
      ${field("requiredEvidence", evidence, ctx)}
      ${field("nextAction", model.nextAction, ctx)}
      ${field("traceRefs", traceRefs, ctx)}
      ${field("riskLevel", model.riskLevel, ctx)}
      ${field("evidenceState", model.evidenceState, ctx)}
      ${field("dueAt", model.dueAt, ctx)}
      ${field("businessObject", model.businessObject, ctx)}
    </dl>
  </article>`;
}

export function LifecycleWorkspace(item, activeCard, ctx) {
  const model = workItemModel({ workspace: item, card: activeCard, workspaceId: item.id, cardId: activeCard.id }, ctx);
  const fields = activeCard.fields?.business || [];
  const evidence = activeCard.evidence || [];
  const blockers = activeCard.blockerRules?.length ? activeCard.blockerRules : item.blockers || [];
  return `<section class="lifecycle-workspace" data-component="LifecycleWorkspace">
    <article>
      <span>Object summary</span>
      <strong>${text(model.businessObject, ctx)}</strong>
      <p>${text(tx(item.summary, ctx), ctx)}</p>
    </article>
    <article>
      <span>Current state</span>
      <strong>${text(model.lifecycleState, ctx)}</strong>
      <p>${text(model.workItemId, ctx)} · ${text(model.caseId, ctx)}</p>
    </article>
    <article class="lifecycle-wide">
      <span>Lifecycle timeline</span>
      <div class="lifecycle-timeline">${(item.cards || []).map((card) => `<span class="${attr(card.id === activeCard.id ? "current" : card.status, ctx)}">${text(tx(card.title, ctx), ctx)} · ${text(card.status, ctx)}</span>`).join("")}</div>
    </article>
    <article>
      <span>Current WorkItem</span>
      <strong>${text(model.workItemType, ctx)}</strong>
      <p>${text(model.nextAction, ctx)}</p>
    </article>
    <article>
      <span>Required fields</span>
      <p>${fields.length ? fields.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : "-"}</p>
    </article>
    <article>
      <span>Required evidence</span>
      <p>${evidence.length ? evidence.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : "-"}</p>
    </article>
    <article>
      <span>Business impact</span>
      <p>${text(item.domain, ctx)} · ${text(model.SLA, ctx)}</p>
    </article>
    <article>
      <span>Risk and blockers</span>
      <p>${blockers.length ? blockers.map((entry) => text(tx(entry.title || entry, ctx), ctx)).join(" · ") : "No active blocker"}</p>
    </article>
    <article>
      <span>Audit summary</span>
      <p>${model.traceRefs.length ? model.traceRefs.map((entry) => text(entry, ctx)).join(" · ") : "Trace will bind after submission"}</p>
    </article>
    <article>
      <span>Next step</span>
      <p>${text(model.nextAction, ctx)}</p>
    </article>
  </section>`;
}

export function OperationPanelView(innerHtml, item, activeCard, ctx) {
  const model = workItemModel({ workspace: item, card: activeCard, workspaceId: item.id, cardId: activeCard.id }, ctx);
  return `<section class="operation-panel-view" data-component="OperationPanelView">
    <div class="operation-panel-head">
      <span>OperationPanelView</span>
      <strong>${text(model.workItemId, ctx)}</strong>
      <small>${text(model.caseId, ctx)} · ${text(model.workItemType, ctx)}</small>
    </div>
    ${innerHtml}
    ${TrustedConfirmSheet(item, activeCard, ctx)}
    ${ActionResult(ctx.state.lastActionResult || { status: statusFromMessage(ctx.state.operationMessage), message: ctx.state.operationMessage }, ctx)}
  </section>`;
}

export function TrustedConfirmSheet(item, card, ctx) {
  const model = workItemModel({ workspace: item, card, workspaceId: item.id, cardId: card.id }, ctx);
  return `<section class="trusted-confirm-sheet" data-component="TrustedConfirmSheet">
    <b>TrustedConfirmSheet</b>
    <dl>
      ${field("workItemId", model.workItemId, ctx)}
      ${field("caseId", model.caseId, ctx)}
      ${field("requiredEvidence", model.requiredEvidence.join(" · ") || "-", ctx)}
      ${field("policyRef", card.policyRef || card.confirmation?.policyRef || "operations-runtime-policy", ctx)}
      ${field("risk", model.riskLevel, ctx)}
      ${field("nextAction", model.nextAction, ctx)}
    </dl>
  </section>`;
}

export function ActionResult(result = {}, ctx) {
  if (!result.status && !result.message) return "";
  if (result.status === "committed_projection_pending") return ProjectionPendingState(result, ctx);
  if (result.status === "committed_projection_failed") return FailedSyncState(result, ctx);
  if (result.status === "permission_blocked_403") return PermissionDiagnostic(result.permissionDiagnostic || result, ctx);
  const status = result.status || "network_unknown";
  return `<section class="action-result ${attr(status, ctx)}" data-component="ActionResult">
    <b>ActionResult</b>
    <p>${text(result.message || status, ctx)}</p>
    ${result.commandSubmissionId ? `<small>commandSubmissionId: ${text(result.commandSubmissionId, ctx)}</small>` : ""}
  </section>`;
}

export function ProjectionPendingState(result = {}, ctx) {
  return `<section class="projection-pending-state" data-component="ProjectionPendingState">
    <b>ProjectionPendingState</b>
    <p>${text(result.message || "Committed. Projection is pending and must not be shown as failed.", ctx)}</p>
  </section>`;
}

export function FailedSyncState(result = {}, ctx) {
  return `<section class="failed-sync-state" data-component="FailedSyncState">
    <b>FailedSyncState</b>
    <p>${text(result.message || "Committed, but read-side sync requires support follow-up.", ctx)}</p>
  </section>`;
}

export function EvidenceTile(field, draft, disabled, ctx) {
  const saved = (draft.evidenceDrafts || []).find((item) => item.requirementId === field.id);
  const selected = saved ? "selected attached" : "missing";
  const evidenceDraftId = saved?.evidenceId ? `data-evidence-draft-id="${attr(saved.evidenceId, ctx)}"` : "";
  return `<button type="button" class="evidence-tile ${selected}" data-component="EvidenceTile" data-evidence-id="${attr(field.id, ctx)}" ${evidenceDraftId} ${disabled}>
    <span>${text(ctx.localTerm(field), ctx)}</span>
    <small>${saved ? "attached" : "missing"}</small>
  </button>`;
}

export function EvidenceSheet(card, draft, ctx) {
  const evidence = card.evidence || [];
  return `<section class="evidence-sheet" data-component="EvidenceSheet">
    <b>EvidenceSheet</b>
    <p>${evidence.length ? evidence.map((field) => text(ctx.localTerm(field), ctx)).join(" · ") : "No required evidence"}</p>
    <small>${(draft.evidenceDrafts || []).length}/${evidence.length} attached</small>
  </section>`;
}

export function PermissionDiagnostic(decision = {}, ctx) {
  const copy = permissionDiagnosticCopy(decision);
  return `<section class="permission-diagnostic" data-component="PermissionDiagnostic">
    <span>PermissionDiagnostic</span>
    <h1>${text(copy.reason, ctx)}</h1>
    <dl>
      ${field("why", copy.reason, ctx)}
      ${field("owner", copy.owner, ctx)}
      ${field("requiredPermission", copy.requiredPermission, ctx)}
      ${field("nextAction", copy.nextAction, ctx)}
    </dl>
  </section>`;
}

export function UploadQueue(state = {}, ctx) {
  const count = state.uploadQueue?.length || 0;
  return queuePanel("UploadQueue", count, count ? "Evidence upload waiting" : "No pending evidence upload", ctx);
}

export function SubmitQueue(state = {}, ctx) {
  const count = state.submitQueue?.length || 0;
  return queuePanel("SubmitQueue", count, count ? "Submissions waiting" : "No pending submission", ctx);
}

export function DeviceTrustPanel(state = {}, ctx) {
  const device = state.pcGovernance?.currentDevice || state.currentDevice || {};
  return `<section class="device-trust-panel" data-component="DeviceTrustPanel">
    <b>DeviceTrustPanel</b>
    <dl>
      ${field("deviceId", device.deviceId || "mobile-current", ctx)}
      ${field("trustState", device.deviceTrustStatus || "unknown", ctx)}
      ${field("surface", device.surface || "mobile", ctx)}
    </dl>
  </section>`;
}

export function workItemModel(item = {}, ctx) {
  const workspace = item.workspace || item;
  const card = item.card || workspace.card || activeCard(workspace);
  const evidence = card?.evidence || item.requiredEvidence || [];
  const drafts = workspace?.id && card?.id ? loadDraft(workspace.id, card.id) : { evidenceDrafts: [] };
  const title = item.title || workspace?.title || card?.title || item.workItemId || "";
  return {
    workspaceId: item.workspaceId || workspace?.id || "",
    cardId: item.cardId || card?.id || "",
    workItemId: item.workItemId || card?.workItemId || workspace?.workItemId || workspace?.taskId || item.queueItemId || "",
    caseId: item.caseId || workspace?.caseId || (workspace?.id ? `case:${workspace.id}` : ""),
    workItemType: item.workItemType || card?.id || workspace?.domain || "operations",
    lifecycleState: item.lifecycleState || item.status || card?.status || "ready",
    ownerRole: item.ownerRole || card?.confirmation?.requiredRole || card?.Confirmation?.requiredRole || "operator",
    SLA: item.SLA || item.sla || item.due || item.dueAt || "same-day",
    requiredEvidence: evidence.map((field) => typeof field === "string" ? field : (ctx.localTerm ? ctx.localTerm(field) : field.id)).filter(Boolean),
    nextAction: item.nextAction || item.reason || tx(workspace?.next, ctx) || tx(card?.title, ctx) || "-",
    traceRefs: array(item.traceRefs || item.trace_refs || item.commandSubmissionId || item.command_submission_id || workspace?.traceRefs),
    riskLevel: item.riskLevel || (card?.status === "blocked" ? "P0" : evidence.length ? "P1" : "P2"),
    evidenceState: item.evidenceState || ((drafts.evidenceDrafts || []).length >= evidence.length && evidence.length ? "attached" : evidence.length ? "missing" : "not_required"),
    dueAt: item.dueAt || item.due || "today",
    businessObject: tx(title, ctx) || item.businessObject || "-"
  };
}

function queuePanel(component, count, message, ctx) {
  return `<section class="personal-ops-panel" data-component="${component}">
    <b>${component}</b>
    <strong>${count}</strong>
    <p>${text(message, ctx)}</p>
  </section>`;
}

function activeCard(workspace) {
  return workspace?.cards?.find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || workspace?.cards?.[0] || {};
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
