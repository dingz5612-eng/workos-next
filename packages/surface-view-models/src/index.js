const rawIdPattern = /^(q-|wi-|case:|cmd-|sub-|payload:|trace-|W-|T-)/i;

export function WorkItemDecisionVM(source = {}, ctx = {}) {
  const sourceRefs = sourceRefsFrom(source);
  const workspace = source.workspace || source;
  const card = source.card || workspace.card || firstActiveCard(workspace);
  const runtime = source.runtimeItem || source;
  const evidence = asArray(source.requiredEvidence || card?.evidence);
  const lifecycleState = source.lifecycleState || source.lifecycle_state || source.status || runtime.lifecycleState || card?.status || "ready";
  const evidenceState = source.evidenceState || (evidence.length ? "missing" : "not_required");
  const nextAction = readable(source.nextAction || source.reason || tx(workspace?.next, ctx) || tx(card?.title, ctx), ctx, "查看下一步");
  const businessObject = businessTitle(source.businessObject || source.title || workspace?.title || card?.title, source, ctx);
  const typeLabel = workItemTypeLabel(source.workItemType || source.work_item_type || card?.id || workspace?.domain, ctx);
  const ownerRole = source.ownerRole || source.owner_role || card?.confirmation?.requiredRole || "operator";
  const riskLevel = source.riskLevel || (lifecycleState === "blocked" ? "P0" : evidence.length ? "P1" : "P2");
  const canHandle = !["blocked", "notStarted", "waiting"].includes(lifecycleState) && evidenceState !== "rejected";
  const blocker = lifecycleState === "blocked"
    ? nextAction
    : evidenceState === "missing"
      ? tr(ctx, "missingEvidenceBlocks", "缺少可信证据，确认会被阻断")
      : tr(ctx, "noCriticalBlocker", "当前没有新的系统阻断，但关键动作仍需要人工确认。");

  return {
    kind: "WorkItemDecisionVM",
    sourceRefs,
    displayTitle: businessObject,
    businessObject,
    typeLabel,
    statusLabel: stateLabel(lifecycleState, ctx),
    canHandle,
    canHandleLabel: canHandle ? tr(ctx, "canHandleNow", "当前可处理") : tr(ctx, "cannotHandleNow", "暂不能处理"),
    blocker,
    requiredEvidenceLabels: evidence.map((item) => localTerm(item, ctx)).filter(Boolean),
    nextAction,
    ownerRoleLabel: roleLabel(ownerRole, ctx),
    slaLabel: readable(source.SLA || source.sla || source.due || source.dueAt, ctx, "今日内"),
    dueAtLabel: readable(source.dueAt || source.due || "today", ctx, "今日"),
    riskLabel: riskLevel,
    evidenceStateLabel: evidenceStateLabel(evidenceState, ctx),
    ledgerImpactLabel: source.ledgerImpact ? readable(source.ledgerImpact, ctx, "涉及账务") : "不直接产生账务影响",
    transferHint: source.transferable ? "可转交" : "需由当前责任角色处理",
    traceSummary: sourceRefs.traceRefs.length ? tr(ctx, "traceBound", "已绑定审计轨迹") : tr(ctx, "traceWillBind", "提交后绑定审计轨迹")
  };
}

export function OperationPanelVM(source = {}, ctx = {}) {
  const decision = WorkItemDecisionVM(source, ctx);
  const persistedWorkItemId = decision.sourceRefs.workItemId;
  const compatibilityWorkItemKey = decision.sourceRefs.compatibilityWorkItemKey;
  return {
    kind: "OperationPanelVM",
    sourceRefs: decision.sourceRefs,
    persistedWorkItemId,
    compatibilityWorkItemKey,
    title: decision.typeLabel,
    subtitle: `${decision.businessObject} · ${decision.nextAction}`,
    prepare: {
      title: tr(ctx, "prepareContract", "预检合同"),
      status: tr(ctx, "prepareContractReady", "将按运行时合同预检"),
      body: tr(ctx, "prepareContractHelp", "系统会校验字段、证据、角色、设备和内测范围。")
    },
    confirm: {
      title: tr(ctx, "confirmCommit", "确认写入"),
      status: tr(ctx, "confirmCommitReady", "只通过运行时确认"),
      body: tr(ctx, "confirmCommitHelp", "确认后由 Operations Runtime 写入提交、事件、账务和轨迹。")
    },
    trace: {
      title: tr(ctx, "trace", "轨迹"),
      status: decision.traceSummary,
      body: tr(ctx, "traceHelp", "可追到 case、WorkItem、提交、事件、证据和投影。")
    },
    projection: {
      title: tr(ctx, "projection", "投影"),
      body: tr(ctx, "projectionPendingBody", "提交已经完成，投影同步中；这不是失败。")
    },
    localDraftFingerprintLabel: tr(ctx, "localDraftFingerprint", "本地草稿指纹已记录")
  };
}

export function EvidenceTrustVM(source = {}, ctx = {}) {
  const status = source.status || source.evidenceState || (source.attached ? "attached" : "required");
  return {
    kind: "EvidenceTrustVM",
    sourceRefs: sourceRefsFrom(source),
    title: localTerm(source.requirement || source.field || source, ctx) || "可信证据",
    status,
    statusLabel: evidenceStateLabel(status, ctx),
    nextAction: evidenceNextAction(status),
    trustBody: evidenceTrustBody(status)
  };
}

export function TrustedConfirmVM(source = {}, ctx = {}) {
  const decision = WorkItemDecisionVM(source, ctx);
  return {
    kind: "TrustedConfirmVM",
    sourceRefs: decision.sourceRefs,
    businessCommitment: {
      title: tr(ctx, "businessCommitment", "业务承诺"),
      body: `${decision.nextAction}；影响 ${decision.businessObject}。`,
      ledgerImpact: decision.ledgerImpactLabel,
      irreversible: "确认后只能通过补偿、纠错或回滚指令处理。"
    },
    evidenceAndPermission: {
      title: tr(ctx, "evidenceAndPermission", "证据与权限"),
      body: decision.requiredEvidenceLabels.length ? decision.requiredEvidenceLabels.join(" · ") : tr(ctx, "noRequiredEvidence", "当前动作无必需证据"),
      policyRef: source.policyRef || source.card?.policyRef || source.card?.confirmation?.policyRef || "operations-runtime-policy",
      risk: decision.riskLabel
    },
    auditAndRollback: {
      title: tr(ctx, "auditAndRollback", "审计与回滚"),
      body: `${decision.traceSummary}；${tr(ctx, "rollbackCompensationReady", "必要时只能通过补偿或回滚指令处理。")}`
    }
  };
}

export function SearchResultVM(source = {}, ctx = {}) {
  const type = source.type || source.kind || inferSearchType(source);
  const title = friendlySearchTitle(source, type, ctx);
  return {
    kind: "SearchResultVM",
    type,
    sourceRefs: sourceRefsFrom(source),
    localizedTitle: title,
    localizedSubtitle: localized(source.localizedSubtitle ?? source.subtitle, ctx) || subtitleForType(type),
    localizedStatus: stateLabel(source.localizedStatus ?? source.status ?? source.lifecycleState ?? "ready", ctx),
    localizedNextAction: localized(source.localizedNextAction ?? source.nextAction, ctx) || nextActionForType(type),
    cta: ctaForType(type)
  };
}

export function QueueStateVM(state = {}, ctx = {}) {
  const uploadCount = asArray(state.uploadQueue).length;
  const submitCount = asArray(state.submitQueue).length;
  return {
    kind: "QueueStateVM",
    sourceRefs: { aggregateRef: "surfaceQueue" },
    upload: {
      title: tr(ctx, "evidenceUpload", "证据上传"),
      count: uploadCount,
      message: uploadCount ? tr(ctx, "evidenceUploadWaiting", "证据等待上传") : tr(ctx, "noPendingEvidenceUpload", "没有待上传证据")
    },
    submit: {
      title: tr(ctx, "submissionQueue", "提交队列"),
      count: submitCount,
      message: submitCount ? tr(ctx, "submissionWaiting", "办理等待提交") : tr(ctx, "noPendingSubmission", "没有待提交办理")
    }
  };
}

export function DeviceTrustVM(state = {}, ctx = {}) {
  const device = state.currentDevice || {};
  const surface = device.surface || "mobile";
  const deviceId = device.deviceId || "mobile-current";
  const trustState = device.deviceTrustStatus || device.trustState || "unknown";
  const contextMismatch = surface !== "mobile" || String(deviceId).startsWith("pc-");
  return {
    kind: "DeviceTrustVM",
    sourceRefs: { aggregateRef: "device-session", deviceId, surface },
    title: tr(ctx, "currentDevice", "当前设备"),
    contextMismatch,
    statusLabel: contextMismatch
      ? tr(ctx, "deviceContextIssue", "设备上下文异常")
      : trustState === "trusted"
        ? tr(ctx, "deviceTrusted", "设备已验证")
        : tr(ctx, "deviceUnknown", "设备状态待确认"),
    body: contextMismatch
      ? tr(ctx, "deviceContextIssueBody", "当前移动端读到了 PC 设备上下文，请刷新或重新登录以绑定当前移动设备。")
      : ""
  };
}

export function LearningRecommendationVM(source = {}, ctx = {}) {
  return {
    kind: "LearningRecommendationVM",
    sourceRefs: { aggregateRef: "learning-content", topic: source.topic || source.status || "" },
    title: localized(source.title, ctx) || source.titleKey && tr(ctx, source.titleKey, source.titleKey) || "学习内容",
    subtitle: localized(source.subtitle, ctx) || source.bodyKey && tr(ctx, source.bodyKey, source.bodyKey) || "查看当前角色的办理说明。",
    status: localized(source.status, ctx) || "learning",
    nextAction: localized(source.nextAction, ctx) || tr(ctx, "learningCenter", "学习中心")
  };
}

export function PcFinanceCaseVM(source = {}, ctx = {}) {
  return pcVm("PcFinanceCaseVM", source, ctx, "财务工作台", "待确认收款、押金负债、退款申请、银行流水异常和日清状态。");
}

export function PcManagerTowerVM(source = {}, ctx = {}) {
  return pcVm("PcManagerTowerVM", source, ctx, "经理控制塔", "聚焦今日风险、超时办理项、证据缺口、等待财务和支持工单。");
}

export function GovernanceTraceVM(source = {}, ctx = {}) {
  return pcVm("GovernanceTraceVM", source, ctx, "治理轨迹", "查看 Gate、Invariant、ShadowCompare、Evidence Graph、Audit 和 Capability。");
}

export function ReleaseControlVM(source = {}, ctx = {}) {
  return pcVm("ReleaseControlVM", source, ctx, "发布工作台", "暂停内测、恢复内测、回滚演练、ReleaseManifest、FeatureFlag 与 L1/L2 readiness。");
}

export function AuditTraceVM(source = {}, ctx = {}) {
  return pcVm("AuditTraceVM", source, ctx, "审计探索器", "追踪 WorkItem、CommandSubmission、Evidence、Ledger、Device、actor 与 role。");
}

export function sourceRefsFrom(source = {}) {
  const workspace = source.workspace || source;
  const card = source.card || workspace.card || {};
  const workItemId = source.workItemId || source.work_item_id || workspace.workItemId || card.runtimeWorkItemId || "";
  const workspaceId = source.workspaceId || source.workspace_id || workspace.id || "";
  const cardId = source.cardId || source.card_id || card.id || "";
  return {
    workspaceId,
    cardId,
    workItemId: isPersistedWorkItemId(workItemId) ? workItemId : "",
    compatibilityWorkItemKey: workspaceId && cardId ? `${workspaceId}:${cardId}` : !isPersistedWorkItemId(workItemId) ? workItemId : "",
    caseId: source.caseId || source.case_id || workspace.caseId || "",
    aggregateRef: source.aggregateRef || workspace.aggregateRef || workspace.id || workItemId || "",
    traceRefs: asArray(source.traceRefs || source.trace_refs || source.commandSubmissionId || source.command_submission_id)
  };
}

function pcVm(kind, source, ctx, title, body) {
  return {
    kind,
    sourceRefs: sourceRefsFrom(source),
    title: localized(source.title, ctx) || title,
    body: localized(source.body, ctx) || body,
    status: localized(source.status, ctx) || "只读治理",
    nextAction: localized(source.nextAction, ctx) || "查看详情"
  };
}

function friendlySearchTitle(source, type, ctx) {
  const explicit = localized(source.localizedTitle ?? source.title, ctx);
  if (explicit && !looksRaw(explicit)) return explicit;
  const objectTitle = businessTitle(source.businessObject || source.workspace?.title || source.title, source, ctx);
  const labels = {
    workItem: "办理项",
    operationCase: "业务案件",
    room: "房间",
    bed: "床位",
    stay: "入住",
    evidence: "证据",
    trace: "提交轨迹",
    learning: "学习内容"
  };
  return `${labels[type] || "结果"} · ${objectTitle}`;
}

function inferSearchType(source) {
  if (source.commandSubmissionId || source.command_submission_id || asArray(source.traceRefs).length) return "trace";
  if (source.caseId || source.case_id) return "operationCase";
  if (source.evidenceId || source.requirementId) return "evidence";
  if (source.topic || source.titleKey) return "learning";
  if (String(source.domain || source.workItemType || "").includes("stay")) return "stay";
  return source.workItemId || source.work_item_id || source.queueItemId ? "workItem" : "workItem";
}

function subtitleForType(type) {
  return {
    workItem: "一线办理",
    operationCase: "案件与办理项",
    room: "房间资源",
    bed: "床位资源",
    stay: "入住对象",
    evidence: "可信证据",
    trace: "提交与轨迹",
    learning: "学习中心"
  }[type] || "业务对象";
}

function nextActionForType(type) {
  return {
    workItem: "打开办理",
    operationCase: "查看案件",
    room: "查看房间",
    bed: "查看床位",
    stay: "查看入住",
    evidence: "查看证据",
    trace: "查看轨迹",
    learning: "开始学习"
  }[type] || "查看详情";
}

function ctaForType(type) {
  return {
    workItem: "operationPanel",
    operationCase: "caseWorkspace",
    room: "objectWorkspace",
    bed: "objectWorkspace",
    stay: "objectWorkspace",
    evidence: "evidence",
    trace: "recentTraces",
    learning: "learning"
  }[type] || "search";
}

function workItemTypeLabel(value, ctx) {
  const raw = String(localized(value, ctx) || "");
  const lower = raw.toLowerCase();
  if (lower.includes("room")) return "房间床位配置";
  if (lower.includes("checkin") || lower.includes("check-in")) return "入住办理";
  if (lower.includes("deposit")) return "押金办理";
  if (lower.includes("payment")) return "收款办理";
  if (lower.includes("checkout")) return "退住办理";
  if (lower.includes("service")) return "服务任务";
  if (lower.includes("finance")) return "财务办理";
  if (lower.includes("stay")) return "住宿办理";
  return raw && !looksRaw(raw) ? raw : "业务办理";
}

function businessTitle(value, source, ctx) {
  const explicit = localized(value, ctx);
  if (explicit && !looksRaw(explicit)) return explicit;
  const workspace = source.workspace || source;
  const workspaceTitle = localized(workspace.title, ctx);
  if (workspaceTitle && !looksRaw(workspaceTitle)) return workspaceTitle;
  return workItemTypeLabel(source.workItemType || source.cardId || source.domain, ctx);
}

function stateLabel(value, ctx) {
  const raw = String(localized(value, ctx) || "");
  const labels = {
    ready: "可办理",
    blocked: "已阻断",
    inProgress: "办理中",
    notStarted: "未开始",
    done: "已完成",
    waiting: "等待他人",
    pending: "等待同步",
    failed: "需要支持"
  };
  return labels[raw] || tr(ctx, raw, raw || "未知");
}

function evidenceStateLabel(value, ctx) {
  const labels = {
    required: "需要补证据",
    draft: "证据草稿",
    attaching: "正在绑定证据",
    attached: "已选择证据",
    hash_verified: "哈希已校验",
    verified: "证据可信",
    rejected: "证据被拒绝",
    scope_mismatch: "证据不属于当前办理",
    already_used: "证据已被使用",
    used: "证据已使用",
    upload_failed: "上传失败",
    audit_available: "可查看审计",
    expired: "证据已过期",
    locked: "证据已锁定",
    missing: "缺少证据",
    not_required: "无需证据"
  };
  return labels[value] || tr(ctx, value, value || "证据状态待确认");
}

function evidenceNextAction(status) {
  return {
    required: "请补齐后再确认",
    missing: "请补齐后再确认",
    rejected: "查看拒绝原因并重新提交",
    scope_mismatch: "选择属于当前办理的证据",
    upload_failed: "重新上传或联系支持",
    verified: "可以用于确认"
  }[status] || "查看证据状态";
}

function evidenceTrustBody(status) {
  return {
    required: "还缺少当前办理要求的可信证据。",
    missing: "还缺少当前办理要求的可信证据。",
    rejected: "证据未通过复核，不能用于确认。",
    scope_mismatch: "证据不属于当前办理，不能复用。",
    verified: "证据已通过可信校验。"
  }[status] || "证据状态会影响是否允许确认。";
}

function roleLabel(role, ctx) {
  const labels = {
    frontdesk: tr(ctx, "operatorRole", "住宿经办人"),
    operator: tr(ctx, "operatorRole", "住宿经办人"),
    housekeeping: "保洁经办人",
    finance: tr(ctx, "financeRole", "财务确认人"),
    manager: tr(ctx, "managerRole", "经理"),
    admin: "管理员",
    releaseOwner: "发布负责人"
  };
  return labels[role] || role || "责任人";
}

function readable(value, ctx, fallback) {
  const text = localized(value, ctx);
  return text && !looksRaw(text) ? text : fallback;
}

function localized(value, ctx) {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((entry) => localized(entry, ctx)).filter(Boolean).join(" · ");
  if (ctx?.tx) return ctx.tx(value);
  return value["zh-CN"] || value["ru-RU"] || value.title || value.label || "";
}

function localTerm(value, ctx) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (ctx?.localTerm) return ctx.localTerm(value);
  return localized(value.label || value.title || value.id, ctx);
}

function tx(value, ctx) {
  return localized(value, ctx);
}

function tr(ctx, key, fallback) {
  const value = ctx?.tr ? ctx.tr(key) : "";
  return value && value !== key ? value : fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function firstActiveCard(workspace = {}) {
  return asArray(workspace.cards).find((card) => ["ready", "blocked", "inProgress"].includes(card.status)) || asArray(workspace.cards)[0] || {};
}

function isPersistedWorkItemId(value) {
  const text = String(value || "");
  return text.includes(":") || /^wi-/i.test(text);
}

function looksRaw(value) {
  return rawIdPattern.test(String(value || "")) || /\b(workItemId|caseId|payloadHash|commandSubmissionId|lifecycleState|ownerRole)\b/.test(String(value || ""));
}
