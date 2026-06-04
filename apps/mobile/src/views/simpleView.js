export function simpleView(titleKey, bodyKey, ctx) {
  const state = ctx.state || {};
  const view = state.view || "";
  const rows = supportRows(view, ctx);
  return ctx.shell(`
    <section class="profile-card personal-runtime-head">
      <span>${ctx.tr("personalOpsCenter")}</span>
      <h1>${ctx.tr(titleKey)}</h1>
      <p>${ctx.tr(bodyKey)}</p>
    </section>
    <section class="personal-runtime-surface" data-surface="personal-runtime-support">
      <p data-boundary-rule="does not write business facts">${ctx.tr("personalSurfaceBoundary")}</p>
      <div class="personal-runtime-list">
        ${rows.length ? rows.map((row) => supportRow(row, ctx)).join("") : supportRow({
          label: ctx.tr("systemDerived"),
          value: ctx.tr("noRuntimeItems"),
          body: ctx.tr("noManualInputNeeded")
        }, ctx)}
      </div>
      <div class="empty-actions">
        <button data-view="workbench">${ctx.tr("openWorkbenchAction")}</button>
        <button class="secondary" data-view="search">${ctx.tr("openSearchAction")}</button>
      </div>
    </section>
  `);
}

export function confirmPageView(ctx) {
  const item = ctx.task?.();
  return ctx.shell(`
    <section class="confirm-panel" data-surface="runtime-confirmation">
      <span>${ctx.tr("confirmAction")}</span>
      <h1>${displayTaskTitle(item, ctx)}</h1>
      <p>${ctx.tr("confirmRuntimeBody")}</p>
      <dl class="confirm-runtime-list">
        <dt>${ctx.tr("systemDerived")}</dt>
        <dd>${ctx.tr("confirmReadyCheck")}</dd>
        <dt>${ctx.tr("cardNext")}</dt>
        <dd>${ctx.tr("confirmCommitEffect")}</dd>
      </dl>
      <div class="empty-actions">
        <button id="finish">${ctx.tr("finish")}</button>
        <button class="secondary" data-view="workbench">${ctx.tr("returnWorkbench")}</button>
      </div>
    </section>
  `);
}

export function resultView(ctx) {
  return ctx.shell(`<section class="confirm-panel"><span>${ctx.tr("submissionRecord")}</span><h1>${ctx.tr("evidenceDone")}</h1><p>${ctx.tr("actionBoundary")}</p><button data-view="workbench">${ctx.tr("workbench")}</button></section>`);
}

function supportRows(view, ctx) {
  const state = ctx.state || {};
  const drafts = operationDrafts();
  const result = state.lastActionResult || {};
  const events = state.projectionEvents || state.runtimeStore?.events || [];
  const queue = state.runtimeStore?.workQueue || [];
  if (view === "notes") {
    return [{
      label: ctx.tr("systemDerived"),
      value: ctx.tr("noteTitle"),
      body: ctx.tr("noteRuntimeBody")
    }];
  }
  if (view === "reminders") {
    const dueItems = queue.filter((item) => item.dueAtUtc || item.due_at_utc || item.dueAt).slice(0, 3);
    return dueItems.length ? dueItems.map((item) => ({
      label: ctx.tr("decisionDueAt"),
      value: ctx.escapeHtml(item.dueAtUtc || item.due_at_utc || item.dueAt),
      body: item.reason || ctx.tr("reminderRuntimeBody")
    })) : [{
      label: ctx.tr("systemDerived"),
      value: ctx.tr("reminderTitle"),
      body: ctx.tr("reminderRuntimeBody")
    }];
  }
  if (view === "drafts") {
    return drafts.length ? drafts.map((draft, index) => ({
      label: `${ctx.tr("localDraft")} ${index + 1}`,
      value: draft.savedAt ? ctx.tr("traceWillBind") : ctx.tr("noRuntimeItems"),
      body: `${ctx.tr("savedAt")}: ${draft.savedAt || ctx.tr("notSubmitted")}`
    })) : emptyRows(ctx);
  }
  if (view === "uploadQueue") {
    const evidence = drafts.flatMap((draft) => draft.evidenceDrafts || []);
    return evidence.length ? evidence.map((item, index) => ({
      label: `${ctx.tr("evidenceUpload")} ${index + 1}`,
      value: ctx.tr(item.status || item.verificationStatus || "evidenceTrustedDraft"),
      body: ctx.tr("uploadQueueBody")
    })) : [{
      label: ctx.tr("evidenceUpload"),
      value: ctx.tr("noPendingEvidenceUpload"),
      body: ctx.tr("uploadQueueBody")
    }];
  }
  if (view === "submitQueue") {
    return result.status ? [{
      label: ctx.tr("submissionStatus"),
      value: ctx.tr(result.status),
      body: result.message || ctx.tr("submitQueueBody")
    }] : [{
      label: ctx.tr("submissionQueue"),
      value: ctx.tr("noPendingSubmission"),
      body: ctx.tr("submitQueueBody")
    }];
  }
  if (view === "failedSync") {
    const failed = ["committed_projection_failed", "network_unknown"].includes(result.status);
    return [{
      label: ctx.tr("failedSyncItems"),
      value: failed ? ctx.tr(result.status) : ctx.tr("noRuntimeItems"),
      body: failed ? (result.message || ctx.tr("failedSyncBody")) : ctx.tr("failedSyncItemsBody")
    }];
  }
  if (view === "recentSubmissions") {
    return result.status ? [{
      label: ctx.tr("recentSubmissions"),
      value: ctx.tr(result.status),
      body: result.commandSubmissionId ? ctx.tr("submissionRecordHelp") : ctx.tr("traceWillBind")
    }] : [{
      label: ctx.tr("recentSubmissions"),
      value: ctx.tr("noRuntimeItems"),
      body: ctx.tr("recentSubmissionsBody")
    }];
  }
  if (view === "recentTraces") {
    return [{
      label: ctx.tr("recentTraces"),
      value: events.length ? `${events.length}` : ctx.tr("noRuntimeItems"),
      body: events.length ? ctx.tr("traceBound") : ctx.tr("recentTracesBody")
    }];
  }
  if (view === "permissions") {
    return [{
      label: ctx.tr("currentRole"),
      value: roleLabel(state.currentActor?.role, ctx),
      body: ctx.tr("myPermissionsBody")
    }];
  }
  if (view === "deviceTrust") {
    const device = state.currentDevice || {};
    return [{
      label: ctx.tr("currentDevice"),
      value: ctx.tr(device.deviceTrustStatus === "trusted" ? "deviceTrusted" : "deviceUnknown"),
      body: ctx.tr("deviceTrustStatusBody")
    }];
  }
  return emptyRows(ctx);
}

function emptyRows(ctx) {
  return [{
    label: ctx.tr("systemDerived"),
    value: ctx.tr("noRuntimeItems"),
    body: ctx.tr("noManualInputNeeded")
  }];
}

function supportRow(row, ctx) {
  return `<article class="personal-runtime-row">
    <span>${ctx.escapeHtml(row.label)}</span>
    <strong>${ctx.escapeHtml(row.value)}</strong>
    <p>${ctx.escapeHtml(row.body)}</p>
  </article>`;
}

function displayTaskTitle(item, ctx) {
  const title = item?.title || item?.businessObject || item?.workItemType;
  if (!title) return ctx.tr("confirmFallbackTitle");
  if (typeof title === "object") return ctx.tx ? ctx.tx(title) : ctx.escapeHtml(title["zh-CN"] || title["ru-RU"] || title.id || ctx.tr("confirmFallbackTitle"));
  const translated = ctx.tr(title);
  return translated === title ? ctx.escapeHtml(title) : translated;
}

function operationDrafts() {
  if (typeof localStorage === "undefined") return [];
  const drafts = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("workosnext.operationDraft.")) continue;
      const draft = JSON.parse(localStorage.getItem(key) || "{}");
      drafts.push(draft);
    }
  } catch {
    return [];
  }
  return drafts.sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
}

function roleLabel(role, ctx) {
  const key = `${role || "operator"}Role`;
  const label = ctx.tr(key);
  return label === key ? ctx.tr("operatorRole") : label;
}
