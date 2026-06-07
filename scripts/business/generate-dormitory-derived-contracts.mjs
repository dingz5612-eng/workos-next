import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const kernelPath = "docs/business/domains/dormitory/dormitory-operating-kernel.json";
const kernelVersion = "oam.domain-operating-kernel.dormitory.v2";
const sourceKernel = kernelPath;
const generatedBy = "scripts/business/generate-dormitory-derived-contracts.mjs";

const trains = [
  {
    id: "train-1-business-mainline",
    nameZh: "第一列车：经营主链",
    goalZh: "资源准备、线索预订、入住、收款和押金形成可追溯主链。"
  },
  {
    id: "train-2-service-expense-checkout",
    nameZh: "第二列车：服务支出退住",
    goalZh: "服务任务、支出、验房和退住结算形成证据与财务边界闭环。"
  },
  {
    id: "train-3-governance-review-optimization",
    nameZh: "第三列车：治理复盘优化",
    goalZh: "延期、换床、取消、门禁、事件、周期复盘和纠错形成治理闭环。"
  }
];

const commonLockedFields = [
  "tenantId",
  "caseId",
  "definitionId",
  "workItemId",
  "sourceWorkItemId",
  "projectionVersion"
];

const objectFields = {
  Room: ["roomId", "roomNo", "floor", "readinessState", "capacity", "availableBedCount"],
  Bed: ["bedId", "roomId", "bedNo", "bedType", "bedState", "lastInspectionId"],
  RatePlan: ["ratePlanId", "name", "billingCycle", "amount", "currency", "effectiveFrom"],
  Lead: ["leadId", "name", "phone", "sourceChannel", "intentRoomType", "followUpState"],
  Reservation: ["reservationId", "leadId", "roomId", "bedId", "ratePlanId", "reservationState"],
  Resident: ["residentId", "name", "identityDocNo", "phone", "emergencyContact", "privacyState"],
  Stay: ["stayId", "residentId", "reservationId", "roomId", "bedId", "stayState"],
  Payment: ["paymentId", "stayId", "amount", "currency", "receivedAt", "basisType"],
  DepositAccount: ["depositId", "stayId", "liabilityAmount", "availableRefundAmount", "policyRef", "depositState"],
  ServiceTask: ["serviceTaskId", "roomId", "bedId", "taskType", "taskState", "verifiedAt"],
  Expense: ["expenseId", "serviceTaskId", "amount", "currency", "basisEvidenceRef", "approvalState"],
  ExpenseLink: ["expenseLinkId", "expenseId", "serviceTaskId", "linkReason", "linkedAt", "linkedBy"],
  MoneyBasis: ["basisId", "basisType", "amount", "currency", "sourceWorkItemId", "evidenceRefs"],
  CheckoutCase: ["checkoutCaseId", "stayId", "inspectionId", "settlementState", "refundPaymentId", "closedAt"],
  RoomInspection: ["inspectionId", "roomId", "bedId", "damageState", "evidenceRefs", "inspectionResult"],
  PeriodSnapshot: ["snapshotId", "periodStart", "periodEnd", "resourceKpi", "financeKpi", "frozenAt"],
  ActionPlan: ["actionPlanId", "snapshotId", "ownerRole", "targetMetric", "dueAt", "executionState"],
  ExceptionCase: ["exceptionCaseId", "sourceWorkItemId", "exceptionType", "severity", "resolutionState", "auditRefs"]
};

const metrics = [
  metric("resource.available_beds", "可售床位数", "资源", "Bed.bedState", "排除维修中和锁定床位", ["building", "roomType"], "daily", "低于阈值生成资源准备行动", "Dorm.ResourceReadinessConfirm"),
  metric("conversion.lead_to_checkin", "线索入住转化率", "转化", "Lead + Reservation + Stay", "排除取消和无效线索", ["channel", "ratePlan"], "weekly", "低于阈值生成转化行动", "Dorm.PeriodActionPlanExecute"),
  metric("revenue.received", "已确认普通收款", "收入", "LedgerEntry.payment", "排除押金和退款", ["period", "roomType"], "daily", "钻取到收款 WorkItem 和 Ledger", "Dorm.PaymentConfirm"),
  metric("deposit.liability", "押金负债余额", "押金", "LedgerEntry.deposit_liability", "押金不得进入收入", ["period", "stay"], "daily", "钻取到押金账户和证据", "Dorm.DepositConfirm"),
  metric("expense.approved_cost", "已审批支出成本", "支出", "LedgerEntry.expense", "排除无依据、未审批、服务预估金额", ["period", "taskType"], "daily", "钻取到支出审批和凭证", "Finance.ExpenseApprove"),
  metric("turnover.checkout_cycle", "退住周转时长", "周转", "CheckoutCase + RoomInspection", "排除未结算退住", ["roomType"], "weekly", "钻取到验房和结算", "Dorm.CheckoutSettlementApprove"),
  metric("governance.exception_resolution", "异常闭环率", "治理", "ExceptionCase", "排除未到期行动计划", ["severity"], "weekly", "钻取到异常和行动计划", "Dorm.ExceptionResolve")
];

const workItems = [
  wi("Dorm.RoomSetupConfirm", "房间建档确认", "train-1-business-mainline", "宿舍经办人", "Accommodation.ResourceSetup", "RoomSetup.Confirm", "Room", ["roomNo", "floor", "capacity"], ["room-photo", "room-basic-info"], "ledger.none.v1", ["Dorm.BedSetupConfirm"], ["RoomReadyLens"]),
  wi("Dorm.BedSetupConfirm", "床位建档确认", "train-1-business-mainline", "宿舍经办人", "Accommodation.ResourceSetup", "BedSetup.Confirm", "Bed", ["roomId", "bedNo", "bedType"], ["bed-photo", "room-link-proof"], "ledger.none.v1", ["Dorm.RatePlanConfirm"], ["DormAvailabilityLens"]),
  wi("Dorm.RatePlanConfirm", "价格方案确认", "train-1-business-mainline", "宿舍负责人", "Accommodation.RatePlan", "RatePlan.Confirm", "RatePlan", ["ratePlanId", "amount", "billingCycle"], ["rate-policy"], "ledger.none.v1", ["Dorm.ResourceReadinessConfirm"], ["RatePlanLens"]),
  wi("Dorm.ResourceReadinessConfirm", "资源可售确认", "train-1-business-mainline", "宿舍经办人", "Accommodation.ResourceReadiness", "ResourceReadiness.Confirm", "Room", ["roomId", "bedId", "readinessState"], ["completion-photo", "verification-check"], "ledger.none.v1", ["Dorm.LeadCapture", "Dorm.CheckinConfirm"], ["DormAvailabilityLens", "RoomReadinessLens"]),
  wi("Dorm.LeadCapture", "线索录入", "train-1-business-mainline", "宿舍经办人", "Accommodation.Lead", "Lead.Capture", "Lead", ["name", "phone", "sourceChannel"], ["lead-consent"], "ledger.none.v1", ["Dorm.ReservationConfirm"], ["LeadFunnelLens"]),
  wi("Dorm.ReservationConfirm", "预订确认", "train-1-business-mainline", "宿舍负责人", "Accommodation.Reservation", "Reservation.Confirm", "Reservation", ["leadId", "roomId", "bedId", "ratePlanId"], ["reservation-acknowledgement", "bed-availability-proof"], "ledger.none.v1", ["Dorm.CheckinConfirm"], ["ReservationLens"]),
  wi("Dorm.CheckinConfirm", "入住确认", "train-1-business-mainline", "宿舍经办人", "Accommodation.CheckIn", "Checkin.Confirm", "Stay", ["residentId", "stayId", "roomId", "bedId"], ["identity-document", "checkin-confirmation", "reservation-acknowledgement", "bed-availability-proof"], "ledger.none.v1", ["Dorm.PaymentConfirm", "Dorm.DepositConfirm", "Dorm.AccessCredentialIssue"], ["StayOnboardingLens", "DormAvailabilityLens"]),
  wi("Dorm.PaymentConfirm", "普通收款确认", "train-1-business-mainline", "宿舍负责人", "finance-gate", "Payment.Confirm", "Payment", ["paymentId", "stayId", "amount", "basisType"], ["payment-receipt", "cashier-review"], "ledger.payment.balanced_allocation.v1", ["Finance.DebtFollowUp"], ["StayBalanceLens", "RevenueCollectionLens"]),
  wi("Dorm.DepositConfirm", "押金确认", "train-1-business-mainline", "宿舍负责人", "finance-gate", "Deposit.Confirm", "DepositAccount", ["depositId", "stayId", "liabilityAmount", "policyRef"], ["receipt-proof", "deposit-policy"], "ledger.deposit.liability.v1", ["Dorm.CheckoutSettlementApprove"], ["DepositLiabilityLens"]),
  wi("Dorm.ServiceTaskCreate", "服务任务创建", "train-2-service-expense-checkout", "宿舍经办人", "Accommodation.ServiceTask", "ServiceTask.Create", "ServiceTask", ["roomId", "bedId", "taskType"], ["service-request"], "ledger.none.v1", ["Dorm.ServiceTaskAssign"], ["ServiceTaskLens"]),
  wi("Dorm.ServiceTaskAssign", "服务任务派工", "train-2-service-expense-checkout", "宿舍负责人", "Accommodation.ServiceTask", "ServiceTask.Assign", "ServiceTask", ["serviceTaskId", "assigneeId", "dueAt"], ["assignment-record"], "ledger.none.v1", ["Dorm.ServiceTaskComplete"], ["ServiceTaskLens"]),
  wi("Dorm.ServiceTaskComplete", "服务任务完成", "train-2-service-expense-checkout", "宿舍经办人", "Accommodation.ServiceTask", "ServiceTask.Complete", "ServiceTask", ["serviceTaskId", "completionNote"], ["completion-photo", "completion-note"], "ledger.none.v1", ["Dorm.ServiceTaskVerify", "Finance.ExpenseRecord"], ["ServiceTaskLens"]),
  wi("Dorm.ServiceTaskVerify", "服务任务验收", "train-2-service-expense-checkout", "宿舍负责人", "Accommodation.ServiceTask", "ServiceTask.Verify", "ServiceTask", ["serviceTaskId", "verificationResult"], ["verification-check"], "ledger.none.v1", ["Dorm.ResourceReadinessConfirm"], ["RoomReadinessLens", "ServiceTaskLens"]),
  wi("Finance.ExpenseRecord", "支出凭证登记", "train-2-service-expense-checkout", "宿舍经办人", "finance-gate", "Expense.Record", "Expense", ["expenseId", "serviceTaskId", "amount", "basisEvidenceRef"], ["expense-invoice", "expense-basis"], "ledger.expense.pending_basis.v1", ["Finance.ExpenseApprove"], ["ExpenseControlLens"]),
  wi("Finance.ExpenseApprove", "支出审批", "train-2-service-expense-checkout", "宿舍负责人", "finance-gate", "Expense.Approve", "Expense", ["expenseId", "approvalState", "approvalReason"], ["expense-approval", "expense-invoice"], "ledger.expense.approved_cost.v1", ["Finance.ExpenseLink"], ["ExpenseControlLens"]),
  wi("Finance.ExpenseLink", "支出关联", "train-2-service-expense-checkout", "宿舍负责人", "finance-gate", "Expense.Link", "ExpenseLink", ["expenseId", "serviceTaskId", "linkReason"], ["expense-link-proof"], "ledger.expense.linked_cost.v1", ["Dorm.PeriodReview"], ["ExpenseControlLens", "ServiceTaskLens"]),
  wi("Dorm.RoomInspectionConfirm", "退住验房确认", "train-2-service-expense-checkout", "宿舍经办人", "Accommodation.Checkout", "RoomInspection.Confirm", "RoomInspection", ["inspectionId", "roomId", "bedId", "inspectionResult"], ["room-inspection", "damage-photo"], "ledger.none.v1", ["Dorm.CheckoutSettlementApprove"], ["CheckoutTurnoverLens"]),
  wi("Dorm.CheckoutSettlementApprove", "退住结算审批", "train-2-service-expense-checkout", "宿舍负责人", "finance-gate", "CheckoutSettlement.Approve", "CheckoutCase", ["checkoutCaseId", "stayId", "inspectionId", "refundPaymentId"], ["room-inspection", "settlement-review", "refund-approval"], "ledger.checkout.settlement.v1", ["Dorm.AccessCredentialRevoke", "Dorm.ResourceReadinessConfirm"], ["DepositSettlementLens", "RefundRiskLens", "CheckoutTurnoverLens"]),
  wi("Dorm.StayExtendApprove", "续住审批", "train-3-governance-review-optimization", "宿舍负责人", "Accommodation.Stay", "StayExtend.Approve", "Stay", ["stayId", "extendTo", "ratePlanId"], ["extend-application", "rate-policy"], "ledger.none.v1", ["Dorm.PaymentConfirm"], ["StayOnboardingLens"]),
  wi("Dorm.BedTransferApprove", "换床审批", "train-3-governance-review-optimization", "宿舍负责人", "Accommodation.Stay", "BedTransfer.Approve", "Stay", ["stayId", "fromBedId", "toBedId"], ["transfer-application", "bed-availability-proof"], "ledger.none.v1", ["Dorm.ResourceReadinessConfirm"], ["DormAvailabilityLens"]),
  wi("Dorm.ReservationCancelClose", "预订取消关闭", "train-3-governance-review-optimization", "宿舍经办人", "Accommodation.Reservation", "ReservationCancel.Close", "Reservation", ["reservationId", "cancelReason"], ["cancel-request"], "ledger.none.v1", ["Dorm.PeriodReview"], ["LeadFunnelLens"]),
  wi("Dorm.ReservationNoShowClose", "预订未到关闭", "train-3-governance-review-optimization", "宿舍经办人", "Accommodation.Reservation", "ReservationNoShow.Close", "Reservation", ["reservationId", "noShowReason"], ["no-show-record"], "ledger.none.v1", ["Dorm.PeriodReview"], ["LeadFunnelLens"]),
  wi("Finance.ChargeAdjustmentApprove", "费用调整审批", "train-3-governance-review-optimization", "宿舍负责人", "finance-gate", "ChargeAdjustment.Approve", "Payment", ["stayId", "amount", "adjustmentReason"], ["adjustment-approval", "charge-basis"], "ledger.charge.adjustment.v1", ["Finance.CorrectionApply"], ["StayBalanceLens"]),
  wi("Finance.DebtFollowUp", "欠费跟进", "train-3-governance-review-optimization", "宿舍经办人", "finance-gate", "Debt.FollowUp", "Payment", ["stayId", "followUpState", "nextContactAt"], ["debt-followup-record"], "ledger.none.v1", ["Dorm.PeriodReview"], ["RevenueCollectionLens"]),
  wi("Dorm.AccessCredentialIssue", "门禁凭证发放", "train-3-governance-review-optimization", "宿舍经办人", "identity-trust", "AccessCredential.Issue", "Resident", ["residentId", "stayId", "credentialId"], ["identity-document", "checkin-confirmation"], "ledger.none.v1", ["Dorm.AccessCredentialRevoke"], ["AccessTrustLens"]),
  wi("Dorm.AccessCredentialRevoke", "门禁凭证回收", "train-3-governance-review-optimization", "宿舍经办人", "identity-trust", "AccessCredential.Revoke", "Resident", ["residentId", "credentialId", "revokeReason"], ["checkout-close-proof"], "ledger.none.v1", ["Dorm.PeriodReview"], ["AccessTrustLens"]),
  wi("Dorm.IncidentRecord", "事件记录", "train-3-governance-review-optimization", "宿舍经办人", "Accommodation.Governance", "Incident.Record", "ExceptionCase", ["exceptionCaseId", "exceptionType", "severity"], ["incident-evidence", "audit-note"], "ledger.none.v1", ["Dorm.ExceptionResolve"], ["ExceptionRiskLens"]),
  wi("Dorm.PeriodReview", "周期复盘", "train-3-governance-review-optimization", "宿舍负责人", "Management.Review", "Period.Review", "PeriodSnapshot", ["snapshotId", "periodStart", "periodEnd"], ["period-review-pack"], "ledger.readonly.v1", ["Dorm.PeriodActionPlanExecute", "Dorm.ExceptionResolve"], ["ManagementDashboardLens"]),
  wi("Dorm.PeriodActionPlanExecute", "周期行动计划执行", "train-3-governance-review-optimization", "宿舍经办人", "Management.ActionPlan", "PeriodActionPlan.Execute", "ActionPlan", ["actionPlanId", "targetMetric", "executionState"], ["action-plan-evidence"], "ledger.none.v1", ["Dorm.PeriodReview"], ["ManagementDashboardLens"]),
  wi("Dorm.ExceptionResolve", "异常处理", "train-3-governance-review-optimization", "宿舍负责人", "Management.Exception", "Exception.Resolve", "ExceptionCase", ["exceptionCaseId", "resolutionState", "resolutionReason"], ["exception-audit", "resolution-evidence"], "ledger.none.v1", ["Finance.CorrectionApply", "Dorm.PeriodReview"], ["ExceptionRiskLens"]),
  wi("Finance.CorrectionApply", "财务纠错申请", "train-3-governance-review-optimization", "宿舍负责人", "finance-gate", "Correction.Apply", "Payment", ["correctionId", "basisType", "correctionReason"], ["correction-approval", "audit-note"], "ledger.finance.correction.v1", ["Dorm.PeriodReview"], ["StayBalanceLens", "ExceptionRiskLens"])
];

const aliases = [
  alias("Dorm.RoomReadinessCheck", "Dorm.ResourceReadinessConfirm", "旧房态检查名称被资源可售确认吸收。"),
  alias("Dorm.RefundApprove", "Dorm.CheckoutSettlementApprove", "旧退款审批名称被退住结算审批吸收。"),
  alias("Dorm.ExpenseRecord", "Finance.ExpenseRecord", "旧宿舍支出登记名称降级为 finance-gate alias。")
];

const byType = new Map(workItems.map((item) => [item.workItemType, item]));

writeJson(kernelPath, buildKernel());
writeWorkItemFiles();
writeJson("docs/business/domains/dormitory/handoff-contract.json", buildDormitoryHandoff());
writeJson("docs/business/domains/dormitory/dormitory-seed-data-pack.json", buildSeedData());
writeJson("docs/business/domains/dormitory/dormitory-observability-contract.json", buildObservability());
writeJson("docs/business/domains/dormitory/dormitory-pilot-go-no-go.json", buildPilotGoNoGo());
writeJsonAsYml("docs/business/domains/dormitory/dormitory-release-train.yml", buildReleaseTrain());
writeJsonAsYml("docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml", buildPilotScenarioPack());
writeText("docs/business/domains/dormitory/dormitory-operator-playbook.md", buildPlaybook());
writeSourceDerivedViews();
patchRegistries();
patchLanguageCatalog();
patchDbOwnershipMap();
patchAuthorityIndex();
patchSystemDerivedContractsTargetList();
patchGraph();

console.log(`Dormitory derived contracts generated from ${kernelPath}`);
console.log(`workItems=${workItems.length}`);

function wi(workItemType, nameZh, trainId, ownerRole, systemOwner, commandType, objectId, editableFields, evidenceRefs, ledgerPolicyRef, downstreamWorkItems, lensOutputs) {
  const local = workItemType.split(".").slice(1).join(".");
  const camel = local.charAt(0).toLowerCase() + local.slice(1).replace(/\.([A-Z])/g, (_, c) => c);
  const definitionId = `definition.${workItemType.startsWith("Finance.") ? "finance" : "dormitory"}.${camel}.v1`;
  const sourceCardId = `cert.${camel}`;
  const surfaceId = `mobile.work.${slug(workItemType)}`;
  const financeOwned = systemOwner === "finance-gate";
  return {
    workItemType,
    nameZh,
    trainId,
    canonicalOwner: financeOwned ? "finance-gate" : "dormitory",
    ownerRole,
    allowedHumanRoles: ["宿舍经办人", "宿舍负责人"],
    systemOwner,
    definitionId,
    commandType,
    sourceCardId,
    workspaceId: workspaceFor(trainId),
    surfaceId,
    objectId,
    ownerSlice: systemOwner,
    allowedFacts: allowedFactsFor(objectId, financeOwned),
    forbiddenFacts: forbiddenFactsFor(financeOwned),
    admissionPolicyRef: admissionFor(workItemType, financeOwned, ownerRole),
    evidencePolicyRef: `evidence.${slug(workItemType)}.v1`,
    ledgerPolicyRef,
    riskPolicyRef: financeOwned ? "risk.finance.high.v1" : "risk.dormitory.standard.v1",
    surfacePolicyRef: `surface.${surfaceId}`,
    dbTableGroups: dbGroupsFor(systemOwner, ledgerPolicyRef),
    upstreamLockedFields: commonLockedFields,
    currentEditableFields: editableFields,
    readonlyFields: commonLockedFields.concat(["createdAt", "confirmedAt", "ledgerEntryId", "domainEventId"]),
    requiredEvidence: evidenceRefs,
    ledgerImpact: ledgerImpactFor(ledgerPolicyRef),
    lensOutputs,
    downstreamWorkItems,
    failureRoutes: [
      "Dorm.ExceptionResolve",
      "append_only_correction_work_item",
      financeOwned ? "Finance.CorrectionApply" : "blocked_with_missing_fields"
    ],
    tests: [
      "tests/WorkOS.RuntimeIntegrationTests",
      "tests/WorkOS.RuntimeContractTests",
      "apps/mobile/src/__tests__"
    ],
    goNoGo: "definition_resolved_and_admission_confirm_allowed",
    operationZh: `${ownerRole}只补本环节缺失字段，系统自动带入并锁定上游确认字段；提交后写入 CommandSubmission、DomainEvent、Evidence/FactTrace，并刷新 Lens/Search。`
  };
}

function alias(workItemType, canonicalWorkItemType, reasonZh) {
  return {
    workItemType,
    decision: "alias",
    keepInDormitoryCatalog: false,
    definitionRequired: false,
    canonicalWorkItemType,
    absorbedBy: canonicalWorkItemType,
    reasonZh
  };
}

function buildKernel() {
  return {
    version: kernelVersion,
    status: "authoritative",
    architecture: "oam.current",
    domainId: "dormitory",
    graphBinding: "domain.dormitory",
    uniqueSourcePolicy: {
      sourcePath: kernelPath,
      currentAuthorityIndexEntryRequired: true,
      oldCatalogsMustBeDerived: true,
      forbiddenParallelSources: [
        "旧 7 个 WorkItem 口径",
        "旧 24 个 WorkItem 口径",
        "多角色模型",
        "只读报表冒充 WorkItem",
        "绕过 finance-gate 的账务事实"
      ]
    },
    humanRoles: [
      {
        roleId: "dormitory.operator",
        nameZh: "宿舍经办人",
        responsibilityZh: "录入、办理、补证、执行当前环节；不得审批高风险财务和例外放行。"
      },
      {
        roleId: "dormitory.lead",
        nameZh: "宿舍负责人",
        responsibilityZh: "审批、财务确认、纠错、周期复盘、例外放行；不得绕过 finance-gate 直接入账。"
      }
    ],
    systemOwners: [
      "finance-gate",
      "Evidence Kernel",
      "Admission Kernel",
      "Projection/Search/Lens Kernel",
      "Runtime Kernel",
      "identity-trust"
    ],
    capabilities: [
      "资源准备",
      "线索预订",
      "入住办理",
      "普通收款",
      "押金负债",
      "服务任务",
      "支出治理",
      "退住结算",
      "门禁信任",
      "周期复盘",
      "异常纠错"
    ],
    businessObjects: Object.keys(objectFields),
    fieldsSource: "docs/contracts/business/oam-business-object-field-registry.json",
    workflowStateSource: "docs/contracts/business/oam-workflow-state-registry.json",
    definitionRegistry: "docs/contracts/definition/workitem-definition-registry.json",
    handoffContract: "docs/business/domains/dormitory/handoff-contract.json",
    releaseTrains: trains,
    workItems,
    aliases,
    realSystemOperations: workItems.map(operationFor),
    handoffContext: handoffFields(),
    stateFlow: {
      ordinary: ["ready", "admission_checked", "confirmed", "projecting", "completed", "blocked", "correction_requested"],
      highRiskFinance: ["ready", "admission_checked", "trusted_device_checked", "lead_approved", "confirmed", "ledger_posted", "completed", "blocked"],
      reviewOnly: ["ready", "snapshot_frozen", "action_plan_generated", "completed", "blocked"]
    },
    evidence: {
      policySource: "docs/business/dormitory/evidence-policy.yml",
      missingEvidenceBlocksConfirm: true,
      rejectedEvidenceBlocksConfirm: true,
      wrongScopeEvidenceBlocksConfirm: true,
      requiredEvidenceRefs: [...new Set(workItems.flatMap((item) => item.requiredEvidence))]
    },
    ledger: {
      policySource: "docs/business/dormitory/ledger-posting-contract.yml",
      financeGateOnly: true,
      rulesZh: [
        "普通收款、押金、退款、扣减、支出、费用调整、财务纠错只通过 finance-gate / Money Kernel 形成账务事实。",
        "押金不是收入，押金退款不是支出。",
        "服务任务金额不是成本真值，无依据支出必须拒绝，支出审批通过后才能进入成本统计。"
      ]
    },
    lensAndMetrics: {
      sources: [
        "docs/business/dormitory/metrics-tree.yml",
        "docs/business/dormitory/metric-formula-contract.yml",
        "docs/business/dormitory/lens-map.yml",
        "docs/contracts/accommodation-lens-contract.json",
        "docs/contracts/period-analytics-contract.json"
      ],
      categories: ["资源", "转化", "收入", "押金", "支出", "周转", "治理"],
      metrics
    },
    slaAndRaci: {
      source: "docs/business/dormitory/workitem-sla.yml",
      raciSource: "docs/business/dormitory/workitem-raci.yml",
      roleModel: ["宿舍经办人", "宿舍负责人"]
    },
    goNoGo: {
      productionAllowed: false,
      l1PilotAllowed: true,
      criteria: [
        "31 个 WorkItem 都有 Definition、Command、证据、账务策略、状态和下游。",
        "所有金额路径通过 finance-gate。",
        "所有上游确认字段自动带入且只读。",
        "Lens 指标可钻取到 WorkItem / Event / Ledger / Evidence / Lens snapshot。"
      ]
    },
    absorbedOrRemovedActions: aliases,
    derivedContracts: [
      "docs/business/domains/dormitory/workitems/*.json",
      "docs/business/domains/dormitory/dormitory-release-train.yml",
      "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
      "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
      "docs/business/domains/dormitory/dormitory-observability-contract.json",
      "docs/business/domains/dormitory/dormitory-operator-playbook.md",
      "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json"
    ],
    gates: [
      "scripts/business/check-dormitory-operating-kernel.mjs",
      "scripts/business/check-dormitory-derived-contracts.mjs",
      "scripts/business/check-dormitory-release-train.mjs",
      "scripts/business/check-dormitory-pilot-scenario-pack.mjs",
      "scripts/business/check-dormitory-metrics-lens-contract.mjs"
    ],
    evidenceBinding: "artifacts/oam/evidence/evidence-graph.json"
  };
}

function operationFor(item) {
  return {
    workItemType: item.workItemType,
    entryFrom: entryFromFor(item),
    systemAutoFilled: item.upstreamLockedFields,
    operatorFills: item.ownerRole === "宿舍经办人" ? item.currentEditableFields : ["补充说明", "evidenceRefs"],
    leadApproves: item.ownerRole === "宿舍负责人" ? item.currentEditableFields.concat(["approvalReason"]) : ["仅在例外或升级时审批"],
    readonlyFields: item.readonlyFields,
    editableFields: item.currentEditableFields,
    evidenceRequired: item.requiredEvidence,
    submittedEvent: eventFor(item),
    ledgerImpact: item.ledgerImpact,
    lensUpdates: item.lensOutputs,
    downstreamWorkItems: item.downstreamWorkItems,
    failureRoutes: item.failureRoutes
  };
}

function writeWorkItemFiles() {
  const dir = "docs/business/domains/dormitory/workitems";
  fs.mkdirSync(abs(dir), { recursive: true });
  for (const item of workItems) {
    writeJson(`${dir}/${slug(item.workItemType)}.json`, {
      version: "oam.dormitory.workitem-operation.v1",
      status: "derived",
      derivedFrom: [kernelPath],
      generatedBy,
      sourceKernelVersion: kernelVersion,
      manualEditAllowed: false,
      graphBinding: `workitem.${item.workItemType}`,
      ...operationFor(item),
      definitionId: item.definitionId,
      commandType: item.commandType,
      allowedFacts: item.allowedFacts,
      forbiddenFacts: item.forbiddenFacts,
      admissionPolicyRef: item.admissionPolicyRef,
      evidencePolicyRef: item.evidencePolicyRef,
      ledgerPolicyRef: item.ledgerPolicyRef,
      dbTableGroups: item.dbTableGroups,
      tests: item.tests
    });
  }
}

function buildDormitoryHandoff() {
  return {
    version: "oam.dormitory.handoff-contract.v1",
    status: "authoritative",
    architecture: "oam.current",
    derivedFrom: [kernelPath, "docs/oam/system-handoff-contract.json"],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "contract.dormitory.handoff",
    fields: handoffFields().map((fieldId) => ({
      fieldId,
      source: handoffSource(fieldId),
      lockedWhenConfirmed: ["caseId", "sourceWorkItemId", "leadId", "reservationId", "stayId", "roomId", "bedId", "ratePlanId", "depositId", "paymentId", "serviceTaskId", "expenseId", "projectionVersion"].includes(fieldId),
      requiredForNextWorkItem: ["caseId", "sourceWorkItemId", "evidenceRefs", "projectionVersion", "lockedFields", "missingFields", "nextWorkItemHints"].includes(fieldId),
      failureRoute: "Dorm.ExceptionResolve"
    })),
    invariantZh: "上游已确认字段必须由系统自动带入且只读；用户只补当前环节缺失信息；受控变更必须生成新的 WorkItem。"
  };
}

function buildReleaseTrain() {
  return {
    version: "oam.dormitory.release-train.v1",
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.release-train",
    trains: trains.map((train) => ({
      ...train,
      workItems: workItems.filter((item) => item.trainId === train.id).map((item) => item.workItemType),
      sequenceZh: "内核定义 -> 派生合同 -> 运行实现 -> 操作界面 -> 测试门禁 -> 种子数据 -> 试运行场景 -> 问题反馈 -> 内核修正"
    }))
  };
}

function buildPilotScenarioPack() {
  const scenarioSpecs = [
    ["入住", 10, "Dorm.CheckinConfirm"],
    ["普通收款", 5, "Dorm.PaymentConfirm"],
    ["押金", 5, "Dorm.DepositConfirm"],
    ["服务任务", 3, "Dorm.ServiceTaskVerify"],
    ["支出", 3, "Finance.ExpenseApprove"],
    ["退住", 3, "Dorm.CheckoutSettlementApprove"],
    ["周期复盘", 1, "Dorm.PeriodReview"]
  ];
  const scenarios = [];
  for (const [categoryZh, count, workItemType] of scenarioSpecs) {
    for (let index = 1; index <= count; index += 1) {
      const item = byType.get(workItemType);
      scenarios.push({
        scenarioId: `dorm-pilot-${slug(categoryZh)}-${String(index).padStart(2, "0")}`,
        categoryZh,
        workItemType,
        definitionId: item.definitionId,
        traceRequired: ["WorkItem", "CommandSubmission", "DomainEvent", "LedgerEntry", "Evidence", "Projection", "Lens", "NextWorkItemOrDecision"],
        goNoGo: "trace_complete_and_no_bypass"
      });
    }
  }
  return {
    version: "oam.dormitory.pilot-scenario-pack.v1",
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.pilot-scenario-pack",
    scenarioCount: scenarios.length,
    scenarios
  };
}

function buildSeedData() {
  return {
    version: "oam.dormitory.seed-data-pack.v1",
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.seed-data",
    seeds: {
      rooms: 8,
      beds: 24,
      ratePlans: 3,
      leads: 12,
      reservations: 8,
      stays: 8,
      serviceTasks: 5,
      expenses: 4,
      checkoutCases: 3
    },
    invariantZh: "种子数据只服务 L1 试运行和测试，不定义生产事实。"
  };
}

function buildObservability() {
  return {
    version: "oam.dormitory.observability-contract.v1",
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.observability",
    signals: [
      "workitem.created",
      "command.submitted",
      "admission.blocked",
      "evidence.missing",
      "ledger.rejected",
      "projection.pending",
      "lens.stale",
      "next_workitem.generated"
    ],
    metrics: metrics.map((item) => item.metricId),
    alertRoutes: {
      evidenceMissing: "Dorm.ExceptionResolve",
      financeImbalance: "Finance.CorrectionApply",
      lensStale: "Dorm.PeriodReview"
    }
  };
}

function buildPilotGoNoGo() {
  return {
    version: "oam.dormitory.pilot-go-no-go.v1",
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.pilot-go-no-go",
    productionAllowed: false,
    l1PilotAllowed: true,
    goCriteria: [
      "31 个 WorkItem 通过内核检查。",
      "试运行场景可追溯到 WorkItem / CommandSubmission / Event / Ledger / Evidence / Lens。",
      "金额路径全部通过 finance-gate。",
      "上游字段自动带入且只读。"
    ],
    noGoCriteria: [
      "任何 Definition 缺失或未解析。",
      "任何支出无依据通过。",
      "任何押金进入收入。",
      "任何 Surface 直接改业务身份字段。"
    ]
  };
}

function buildPlaybook() {
  return `# 宿舍操作手册\n\n> 派生自 ${kernelPath}，不得作为第二权威。\n\n## 两个角色\n\n- 宿舍经办人：录入、办理、补证、执行。\n- 宿舍负责人：审批、财务确认、纠错、周期复盘、例外放行。\n\n## 操作原则\n\n系统自动带入上游已确认字段并锁定；当前环节只补缺失字段、证据和原因。金额事实只由 finance-gate / Money Kernel 生成。周期复盘只读业务事实、财务事实、证据事实和 Lens 快照，只生成行动计划或异常处理。\n\n## 当前 WorkItem\n\n${workItems.map((item) => `- ${item.workItemType}：${item.nameZh}，${item.ownerRole}，${item.ledgerImpact}`).join("\n")}\n`;
}

function writeSourceDerivedViews() {
  const decisions = {
    version: "oam.dormitory.workitem-decision-table.v2",
    status: "derived",
    domain: "dormitory",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: "domain.dormitory.workitem-decisions",
    productionAllowed: false,
    currentCatalogPolicy: {
      catalogKeepsOnly: "currentExecutableWorkItem",
      canonicalSource: kernelPath,
      oldSevenOrTwentyFourDenied: true
    },
    decisions: workItems.map((item) => ({
      workItemType: item.workItemType,
      decision: item.canonicalOwner === "finance-gate" ? "externalFinanceGovernance" : "currentExecutableWorkItem",
      keepInDormitoryCatalog: item.canonicalOwner !== "finance-gate",
      definitionRequired: true,
      definitionId: item.definitionId,
      commandType: item.commandType,
      workspaceId: item.workspaceId,
      surfaceId: item.surfaceId,
      ownerSlice: item.ownerSlice,
      dbTableGroups: item.dbTableGroups,
      tests: item.tests,
      reasonZh: item.canonicalOwner === "finance-gate" ? "财务真值由 finance-gate 拥有，宿舍只发起或引用。" : "当前宿舍内核可执行 WorkItem。"
    })).concat(aliases)
  };
  writeJson("docs/business/dormitory/workitem-decision-table.json", decisions);

  writeJsonAsYml("docs/business/dormitory/workitem-catalog.yml", derivedView("oam.dormitory.workitem-catalog.v2", {
    domainId: "dormitory",
    catalogPolicy: "Only dormitory-owned currentExecutableWorkItem from dormitory-operating-kernel can appear here.",
    workItems: workItems.filter((item) => item.canonicalOwner === "dormitory").map(catalogItem),
    productionAllowed: false
  }));

  writeJsonAsYml("docs/business/dormitory/value-streams.yml", derivedView("oam.dormitory.value-streams.v2", {
    domainId: "dormitory",
    valueStreams: trains.map((train) => ({
      id: train.id,
      name: train.nameZh,
      中文名称: train.nameZh,
      startEvent: eventFor(workItems.find((item) => item.trainId === train.id)),
      endState: `${train.id}.closed`,
      businessObjects: [...new Set(workItems.filter((item) => item.trainId === train.id).map((item) => item.objectId))],
      factOwners: [...new Set(workItems.filter((item) => item.trainId === train.id).map((item) => item.ownerSlice))],
      workItemTypes: workItems.filter((item) => item.trainId === train.id && item.canonicalOwner === "dormitory").map((item) => item.workItemType),
      externalFinanceWorkItemTypes: workItems.filter((item) => item.trainId === train.id && item.canonicalOwner === "finance-gate").map((item) => item.workItemType),
      absorbedActionTypes: aliases.map((item) => item.workItemType),
      requiredEvidence: [...new Set(workItems.filter((item) => item.trainId === train.id).flatMap((item) => item.requiredEvidence))],
      ledgerImpact: "金额事实必须经 finance-gate / Money Kernel。",
      lensOutputs: [...new Set(workItems.filter((item) => item.trainId === train.id).flatMap((item) => item.lensOutputs))],
      risks: ["重复录入上游字段", "绕过 Admission", "金额绕过 finance-gate"],
      SLA: "见 workitem-sla 派生文件",
      ownerRole: "宿舍负责人",
      certificationScenario: train.id,
      goNoGoCriteria: ["Definition resolved", "Admission passed", "Evidence complete", "No finance bypass"]
    })),
    productionAllowed: false
  }));

  writeJsonAsYml("docs/business/dormitory/workitem-sla.yml", derivedView("oam.dormitory.workitem-sla.v2", {
    workItemSlaRefs: workItems.filter((item) => item.canonicalOwner === "dormitory").map((item) => ({
      workItemType: item.workItemType,
      sla: slaFor(item),
      breachRoute: "Dorm.ExceptionResolve"
    }))
  }));

  writeJsonAsYml("docs/business/dormitory/workitem-raci.yml", derivedView("oam.dormitory.workitem-raci.v2", {
    roleModel: ["宿舍经办人", "宿舍负责人"],
    assignments: workItems.map((item) => ({
      workItemType: item.workItemType,
      responsible: item.ownerRole,
      accountable: item.ownerRole === "宿舍负责人" ? "宿舍负责人" : "宿舍经办人",
      consulted: item.canonicalOwner === "finance-gate" ? ["finance-gate", "Evidence Kernel"] : ["Admission Kernel", "Evidence Kernel"],
      informed: ["Projection/Search/Lens Kernel"]
    }))
  }));

  writeJsonAsYml("docs/business/dormitory/go-no-go.yml", derivedView("oam.dormitory.go-no-go.v2", buildPilotGoNoGo()));
  writeJsonAsYml("docs/business/dormitory/metrics-tree.yml", derivedView("oam.dormitory.metrics-tree.v2", { categories: groupMetricsByCategory() }));
  writeJsonAsYml("docs/business/dormitory/metric-formula-contract.yml", derivedView("oam.dormitory.metric-formula-contract.v2", { metrics }));
  writeJsonAsYml("docs/business/dormitory/lens-map.yml", derivedView("oam.dormitory.lens-map.v2", {
    lenses: [...new Set(workItems.flatMap((item) => item.lensOutputs))].map((lensId) => ({
      lensId,
      derivedFromFacts: workItems.filter((item) => item.lensOutputs.includes(lensId)).map((item) => item.workItemType),
      readonly: true,
      drilldown: ["WorkItem", "DomainEvent", "LedgerEntry", "Evidence", "LensSnapshot"]
    }))
  }));

  updateGoldenPilot();
  updateCanonicalScenarioMap();
  updateScenarioFieldContract();
  updateEvidenceAndLedgerContracts();
}

function patchRegistries() {
  const registryPath = "docs/contracts/definition/workitem-definition-registry.json";
  const registry = readJson(registryPath);
  registry.generatedBy = generatedBy;
  const existing = new Map((registry.definitions ?? []).map((item) => [item.workItemType, item]));
  const aliasTypes = new Set(aliases.map((item) => item.workItemType));
  const definitions = [...(registry.definitions ?? []).filter((item) => !byType.has(item.workItemType) && !aliasTypes.has(item.workItemType))];
  for (const item of workItems) {
    const current = existing.get(item.workItemType) ?? {};
    definitions.push({
      ...current,
      definitionId: item.definitionId,
      businessLineId: item.workItemType.startsWith("Finance.") ? "finance" : "dormitory",
      sliceId: item.ownerSlice,
      workspaceId: item.workspaceId,
      sourceCardId: item.sourceCardId,
      workItemType: item.workItemType,
      commandType: item.commandType,
      ownerSlice: item.ownerSlice,
      allowedFacts: item.allowedFacts,
      forbiddenFacts: item.forbiddenFacts,
      fieldContractRef: `field.${slug(item.workItemType)}.v1`,
      evidencePolicyRef: item.evidencePolicyRef,
      riskPolicyRef: item.riskPolicyRef,
      ledgerPolicyRef: item.ledgerPolicyRef,
      admissionPolicyRef: item.admissionPolicyRef,
      surfacePolicyRef: item.surfacePolicyRef,
      productionConfirmAllowed: false,
      removalImpact: "Current OAM dormitory operating kernel canonical definition.",
      definitionMode: "oam-certification-current"
    });
  }
  for (const item of aliases) {
    const current = existing.get(item.workItemType);
    if (!current) continue;
    definitions.push({
      ...current,
      productionConfirmAllowed: false,
      removalImpact: `${item.workItemType} 已由 ${item.canonicalWorkItemType} 吸收，只允许作为 surface input adapter。`,
      definitionMode: "surface-input-adapter"
    });
  }
  registry.definitions = definitions.sort((a, b) => a.workItemType.localeCompare(b.workItemType));
  writeJson(registryPath, registry);

  patchFieldRegistry();
  patchWorkflowRegistry();
}

function patchFieldRegistry() {
  const file = "docs/contracts/business/oam-business-object-field-registry.json";
  const registry = readJson(file);
  registry.generatedBy = generatedBy;
  const objects = new Map((registry.objects ?? []).map((item) => [item.objectId, item]));
  for (const [objectId, fields] of Object.entries(objectFields)) {
    const existing = objects.get(objectId) ?? {
      objectId,
      module: moduleForObject(objectId),
      ownerCapability: ownerCapabilityForObject(objectId),
      truthOwnerRef: objectId,
      fields: []
    };
    existing.module = moduleForObject(objectId);
    existing.ownerCapability = ownerCapabilityForObject(objectId);
    const fieldMap = new Map((existing.fields ?? []).map((field) => [field.fieldId, field]));
    for (const fieldId of fields) {
      const current = fieldMap.get(fieldId) ?? {};
      fieldMap.set(fieldId, {
        fieldId,
        nameZh: current.nameZh ?? nameZhForField(fieldId),
        owner: ["accommodation", "finance-gate", "identity", "maintenance"].includes(current.owner) ? current.owner : ownerForObject(objectId),
        visibleScope: current.visibleScope ?? ["mobile", "pc", "search"],
        editableWhen: current.editableWhen ?? `${objectId}.${fieldId}.current_workitem_before_confirm`,
        auditRequired: current.auditRequired ?? true,
        languageKey: current.languageKey ?? fieldId,
        source: current.source ?? "Dormitory operating kernel",
        searchable: current.searchable ?? !fieldId.toLowerCase().includes("amount"),
        ledgerRelevant: current.ledgerRelevant ?? ownerForObject(objectId) === "finance-gate"
      });
    }
    existing.fields = [...fieldMap.values()];
    objects.set(objectId, existing);
  }
  for (const object of objects.values()) {
    for (const field of object.fields ?? []) {
      field.nameZh ??= nameZhForField(field.fieldId);
      if (!["accommodation", "finance-gate", "identity", "maintenance"].includes(field.owner)) field.owner = ownerForObject(object.objectId);
      field.source ??= "Current OAM field registry";
      field.editableWhen ??= "current_workitem_before_confirm";
      field.visibleScope ??= ["mobile", "pc", "search"];
      field.auditRequired ??= true;
      field.searchable ??= false;
      if (field.owner !== "finance-gate" && !String(field.source).includes("Money/Ledger Kernel")) field.ledgerRelevant = false;
      field.ledgerRelevant ??= false;
    }
  }
  registry.objects = [...objects.values()].sort((a, b) => a.objectId.localeCompare(b.objectId));
  writeJson(file, registry);
}

function patchLanguageCatalog() {
  const file = "docs/contracts/language/field-label-catalog.json";
  const catalog = readJson(file);
  const fields = new Map((catalog.fields ?? []).map((item) => [item.fieldId, item]));
  for (const fieldIds of Object.values(objectFields)) {
    for (const fieldId of fieldIds) {
      if (!fields.has(fieldId)) {
        fields.set(fieldId, {
          fieldId,
          label: {
            "zh-CN": nameZhForField(fieldId),
            "ru-RU": fieldId,
            "ky-KG": fieldId
          }
        });
      }
    }
  }
  catalog.fields = [...fields.values()].sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  writeJson(file, catalog);
}

function patchWorkflowRegistry() {
  const file = "docs/contracts/business/oam-workflow-state-registry.json";
  const registry = readJson(file);
  registry.generatedBy = generatedBy;
  registry.decisionTable = "docs/business/dormitory/workitem-decision-table.json";
  const workflows = workItems.map((item) => ({
    workflowId: `workflow.${item.workItemType.replace(/\./g, ".").replace(/^Finance/, "finance").replace(/^Dorm/, "dormitory")}.v1`,
    workItemType: item.workItemType,
    definitionId: item.definitionId,
    sourceCardId: item.sourceCardId,
    initialState: "ready",
    allowedStates: item.ledgerPolicyRef === "ledger.readonly.v1"
      ? ["ready", "snapshot_frozen", "action_plan_generated", "completed", "blocked"]
      : ["ready", "admission_checked", "trusted_device_checked", "confirmed", "projecting", "completed", "blocked", "correction_requested"],
    forbiddenStates: ["production_confirmed", "direct_db_written", "direct_ledger_write", "card_fallback_confirmed"],
    actions: [
      {
        actionId: `${slug(item.workItemType)}.confirm`,
        from: ["ready"],
        to: item.ledgerPolicyRef === "ledger.readonly.v1" ? "snapshot_frozen" : "confirmed",
        preconditions: [
          "definition_resolved",
          "required_fields_present",
          "idempotency_key_present",
          "evidence_refs_present",
          "admission_decision_ref_present"
        ],
        admissionMatrixEntry: item.admissionPolicyRef,
        evidenceRequired: item.requiredEvidence,
        visibleRoles: item.allowedHumanRoles,
        mobileVisible: true,
        pcGovernanceAction: item.ownerRole === "宿舍负责人",
        revokePath: "append_only_correction_work_item",
        correctionPath: item.canonicalOwner === "finance-gate" ? "Finance.CorrectionApply" : "Dorm.ExceptionResolve"
      }
    ]
  }));
  registry.workflows = workflows;
  registry.invariants = [
    "Every current dormitory WorkItem must require definition_resolved.",
    "Visible roles are limited to 宿舍经办人 and 宿舍负责人.",
    "No workflow may use cardId as business identity.",
    "Finance work items route to finance-gate and append-only correction."
  ];
  writeJson(file, registry);
}

function patchDbOwnershipMap() {
  const file = "docs/contracts/database/oam-db-ownership-map.json";
  const db = readJson(file);
  db.executionMappings = workItems.map((item) => ({
    businessAction: item.workItemType,
    decision: item.canonicalOwner === "finance-gate" ? "externalFinanceGovernance" : "currentExecutableWorkItem",
    definitionId: item.definitionId,
    commandType: item.commandType,
    unitOfWork: "OperationsUnitOfWork",
    ownerSlice: item.ownerSlice,
    tableGroups: item.dbTableGroups,
    domainEvent: {
      required: item.allowedFacts.includes("DomainEvent"),
      tableGroup: "operations-runtime",
      eventType: eventFor(item)
    },
    ledgerEntry: {
      required: item.allowedFacts.includes("LedgerEntry"),
      tableGroup: item.allowedFacts.includes("LedgerEntry") ? "finance-ledger" : null,
      policyRef: item.ledgerPolicyRef,
      appendOnly: item.allowedFacts.includes("LedgerEntry"),
      mutationPolicy: item.allowedFacts.includes("LedgerEntry") ? "no_update_no_delete" : "not_applicable"
    },
    searchProjectionLens: {
      readOnly: true,
      tableGroup: "projection-read-side",
      lenses: item.lensOutputs
    },
    tests: [
      "tests/WorkOS.RuntimeIntegrationTests",
      "tests/WorkOS.RuntimeContractTests",
      "tests/WorkOS.DatabaseSecurityTests"
    ]
  }));
  writeJson(file, db);
}

function patchAuthorityIndex() {
  const file = "docs/oam/current-authority-index.json";
  const index = readJson(file);
  const entries = new Map((index.entries ?? []).map((entry) => [entry.path, entry]));
  const requiredEntries = [
    [kernelPath, "current_domain_kernel", "domain-owner", "scripts/business/check-dormitory-operating-kernel.mjs", true, "宿舍业务唯一运行内核。"],
    ["docs/business/domains/dormitory/handoff-contract.json", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-derived-contracts.mjs", true, "宿舍 handoff 合同。"],
    ["docs/business/domains/dormitory/dormitory-release-train.yml", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-release-train.mjs", false, "宿舍发布列车派生视图。"],
    ["docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-pilot-scenario-pack.mjs", false, "宿舍试运行场景派生包。"],
    ["docs/business/domains/dormitory/dormitory-seed-data-pack.json", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-derived-contracts.mjs", false, "宿舍试运行种子数据派生包。"],
    ["docs/business/domains/dormitory/dormitory-observability-contract.json", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-derived-contracts.mjs", false, "宿舍可观测合同派生视图。"],
    ["docs/business/domains/dormitory/dormitory-pilot-go-no-go.json", "current_business_contract", "domain-owner", "scripts/business/check-dormitory-derived-contracts.mjs", false, "宿舍试运行 Go/No-Go 派生视图。"],
    ["docs/business/domains/dormitory/dormitory-operator-playbook.md", "current_manual", "domain-owner", "scripts/business/check-dormitory-derived-contracts.mjs", false, "宿舍操作手册，人读但不定义当前事实。"]
  ];
  for (const [entryPath, identity, owner, checker, currentTruthAllowed, notesZh] of requiredEntries) {
    entries.set(entryPath, {
      path: entryPath,
      identity,
      owner,
      checker,
      evidence: "artifacts/oam/evidence/evidence-graph.json",
      currentTruthAllowed,
      notesZh
    });
  }
  index.entries = [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
  writeJson(file, index);
}

function patchSystemDerivedContractsTargetList() {
  const file = "docs/oam/system-derived-contracts.json";
  if (!fs.existsSync(abs(file))) return;
  const doc = readJson(file);
  const existing = new Map((doc.contracts ?? []).map((item) => [item.targetPath, item]));
  for (const targetPath of derivedTargetPaths()) {
    existing.set(targetPath, {
      targetPath,
      derivedFrom: [kernelPath],
      generatedBy,
      sourceKernelVersion: kernelVersion,
      sourceGraphVersion: "oam.kernel-graph.v1",
      manualEditAllowed: false,
      graphBinding: graphBindingForPath(targetPath),
      checker: checkerForPath(targetPath)
    });
  }
  doc.contracts = [...existing.values()].sort((a, b) => a.targetPath.localeCompare(b.targetPath));
  writeJson(file, doc);
}

function patchGraph() {
  const file = "docs/oam/oam-kernel-graph.json";
  const graph = readJson(file);
  graph.requiredEdgeTypes = [...new Set([...(graph.requiredEdgeTypes ?? []), "absorbedBy", "replacedBy", "referenceBlockedBy", "deletionProvenBy", "mustNotBeReferencedBy"])];
  const nodes = new Map((graph.nodes ?? []).map((node) => [node.nodeId, node]));
  const addNode = (node) => nodes.set(node.nodeId, { ...(nodes.get(node.nodeId) ?? {}), ...node });

  addNode(node("domain.dormitory", "domainKernel", "domain-owner", kernelPath, true, "kernel.domain", "scripts/business/check-dormitory-operating-kernel.mjs"));
  for (const item of workItems) {
    addNode(node(`workitem.${item.workItemType}`, "WorkItem", item.ownerSlice, kernelPath, true, item.commandType, "scripts/business/check-dormitory-operating-kernel.mjs", item.tests));
    addNode(node(`definition.${item.definitionId}`, "Definition", item.ownerSlice, "docs/contracts/definition/workitem-definition-registry.json", true, item.commandType, "scripts/business/check-dormitory-operating-kernel.mjs", item.tests));
    addNode(node(`command.${item.commandType}`, "Command", item.ownerSlice, kernelPath, true, item.commandType, "scripts/business/check-dormitory-operating-kernel.mjs", item.tests));
  }
  for (const item of aliases) {
    addNode(node(`workitem.${item.workItemType}`, "WorkItem", "domain-owner", kernelPath, false, "source-alias", "scripts/business/check-dormitory-operating-kernel.mjs"));
  }
  for (const objectId of Object.keys(objectFields)) {
    addNode(node(`object.${objectId}`, "BusinessObject", ownerForObject(objectId), "docs/contracts/business/oam-business-object-field-registry.json", true, "business-object-field-registry", "scripts/oam/check-business-object-field-registry.mjs"));
  }
  for (const metricItem of metrics) {
    addNode(node(`lens.metric.${metricItem.metricId}`, "Lens", metricItem.owner, "docs/business/dormitory/metric-formula-contract.yml", false, "Projection/Search/Lens Kernel", "scripts/business/check-dormitory-derived-contracts.mjs"));
  }
  for (const filePath of allNewAndDerivedFiles()) {
    addNode(fileNode(filePath));
  }
  for (const scriptPath of [
    "scripts/business/generate-dormitory-derived-contracts.mjs",
    "scripts/business/check-dormitory-operating-kernel.mjs",
    "scripts/business/check-dormitory-derived-contracts.mjs",
    "scripts/business/check-dormitory-release-train.mjs",
    "scripts/business/check-dormitory-pilot-scenario-pack.mjs",
    "scripts/business/check-dormitory-metrics-lens-contract.mjs"
  ]) {
    if (fs.existsSync(abs(scriptPath))) addNode(fileNode(scriptPath, "active_validation", "oam-release-owner", "scripts/oam/run-control-plane-checks.ps1"));
  }

  const edges = graph.edges ?? [];
  const edgeKey = new Set(edges.map((edge) => `${edge.from}|${edge.to}|${edge.edgeType}`));
  const addEdge = (from, to, edgeType, checker = "scripts/business/check-dormitory-operating-kernel.mjs") => {
    const key = `${from}|${to}|${edgeType}`;
    if (edgeKey.has(key)) return;
    edgeKey.add(key);
    edges.push({
      from,
      to,
      edgeType,
      allowedDirection: `${from} -> ${to}`,
      forbiddenDirection: `${to} 不得反向覆盖 ${from}`,
      checker,
      evidence: "artifacts/oam/evidence/evidence-graph.json"
    });
  };
  for (const item of workItems) {
    addEdge("domain.dormitory", `workitem.${item.workItemType}`, "owns");
    addEdge(`workitem.${item.workItemType}`, `definition.${item.definitionId}`, "requires");
    addEdge(`definition.${item.definitionId}`, `command.${item.commandType}`, "emits");
  }
  for (const filePath of allNewAndDerivedFiles()) {
    addEdge("domain.dormitory", `file.${filePath}`, "derivedFrom", "scripts/business/check-dormitory-derived-contracts.mjs");
  }
  for (const item of aliases) {
    addEdge(`workitem.${item.workItemType}`, `workitem.${item.canonicalWorkItemType}`, "absorbedBy");
    addEdge(`workitem.${item.workItemType}`, `workitem.${item.canonicalWorkItemType}`, "replacedBy");
    addEdge(`workitem.${item.workItemType}`, "domain.dormitory", "referenceBlockedBy");
  }
  graph.nodes = [...nodes.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  graph.edges = edges.sort((a, b) => `${a.from}|${a.to}|${a.edgeType}`.localeCompare(`${b.from}|${b.to}|${b.edgeType}`));
  writeJson(file, graph);
}

function node(nodeId, nodeType, owner, sourceFile, currentTruthAllowed, runtimeBinding, checker, tests = ["scripts/business/check-dormitory-operating-kernel.mjs"]) {
  return {
    nodeId,
    nodeType,
    owner,
    sourceFile,
    runtimeBinding,
    testBinding: tests,
    gateBinding: [checker],
    evidenceBinding: "artifacts/oam/evidence/evidence-graph.json",
    currentTruthAllowed,
    deletionCondition: "当上游当前权威删除且消费者、门禁、证据同步删除时删除。"
  };
}

function fileNode(filePath, state = lifecycleForPath(filePath), owner = ownerForPath(filePath), checker = checkerForPath(filePath)) {
  const derived = state === "derived_view";
  return {
    nodeId: `file.${filePath}`,
    nodeType: "File",
    owner,
    sourceFile: filePath,
    runtimeBinding: derived ? "derived-view" : "kernel.domain",
    testBinding: [checker, "docs/oam/oam-kernel-graph.json"],
    gateBinding: [checker],
    evidenceBinding: "artifacts/oam/evidence/evidence-graph.json",
    currentTruthAllowed: state === "active_contract" || state === "active_authority",
    deletionCondition: "当内容被当前权威吸收且无消费者、无门禁、无证据引用时删除。",
    lifecycleState: state,
    manualEditAllowed: !derived,
    ciReferenceAllowed: true,
    sourceKernel: "domain.dormitory",
    checker,
    evidence: "artifacts/oam/evidence/evidence-graph.json",
    replacementPath: filePath,
    absorbedBy: filePath,
    removalProofGate: checker,
    deletionConditionZh: "当内容被当前权威吸收且无消费者、无门禁、无证据引用时删除。",
    consumers: [checker, "docs/oam/oam-kernel-graph.json"],
    ...(derived ? {
      derivedFrom: kernelPath,
      generatedBy,
      sourceKernelVersion: kernelVersion,
      graphBinding: graphBindingForPath(filePath)
    } : {})
  };
}

function patchArrayByPath(file, updater) {
  const doc = readJson(file);
  updater(doc);
  writeJson(file, doc);
}

function updateGoldenPilot() {
  const file = "docs/scenarios/dormitory/golden-pilot.yml";
  const doc = readJson(file);
  for (const scenario of doc.scenarios ?? []) {
    if (scenario.workItemType === "Dorm.RoomReadinessCheck") scenario.workItemType = "Dorm.ResourceReadinessConfirm";
    if (scenario.workItemType === "Dorm.RefundApprove") scenario.workItemType = "Dorm.CheckoutSettlementApprove";
    const item = byType.get(scenario.workItemType);
    if (item) {
      scenario.definitionId = item.definitionId;
      scenario.commandType = item.commandType;
      scenario.sourceCardId = item.sourceCardId;
      scenario.requiredEvidence = scenario.requiredEvidence?.length ? scenario.requiredEvidence : item.requiredEvidence;
    }
  }
  doc.derivedFrom = [kernelPath];
  doc.generatedBy = generatedBy;
  doc.sourceKernelVersion = kernelVersion;
  doc.manualEditAllowed = false;
  doc.graphBinding = "domain.dormitory.golden-pilot";
  writeJson(file, doc);
}

function updateCanonicalScenarioMap() {
  const file = "docs/business/dormitory/canonical-scenario-map.json";
  const doc = readJson(file);
  for (const mapping of doc.mappings ?? []) {
    if (mapping.workItemType === "Dorm.RoomReadinessCheck") mapping.workItemType = "Dorm.ResourceReadinessConfirm";
    if (mapping.workItemType === "Dorm.RefundApprove") mapping.workItemType = "Dorm.CheckoutSettlementApprove";
    const item = byType.get(mapping.workItemType);
    if (item) {
      mapping.definitionId = item.definitionId;
      mapping.sourceCardId = item.sourceCardId;
      mapping.surfaceId = item.surfaceId;
      mapping.ownerDomain = item.canonicalOwner;
    }
  }
  doc.derivedFrom = [kernelPath];
  doc.generatedBy = generatedBy;
  doc.sourceKernelVersion = kernelVersion;
  doc.manualEditAllowed = false;
  doc.graphBinding = "domain.dormitory.canonical-scenario-map";
  writeJson(file, doc);
}

function updateScenarioFieldContract() {
  const file = "docs/business/dormitory/scenario-field-contract.yml";
  const doc = readJson(file);
  for (const fieldSet of doc.fieldSets ?? []) {
    if (fieldSet.workItemType === "Dorm.RoomReadinessCheck") fieldSet.workItemType = "Dorm.ResourceReadinessConfirm";
    if (fieldSet.workItemType === "Dorm.RefundApprove") fieldSet.workItemType = "Dorm.CheckoutSettlementApprove";
  }
  doc.derivedFrom = [kernelPath];
  doc.generatedBy = generatedBy;
  doc.sourceKernelVersion = kernelVersion;
  doc.manualEditAllowed = false;
  doc.graphBinding = "domain.dormitory.scenario-field-contract";
  writeJson(file, doc);
}

function updateEvidenceAndLedgerContracts() {
  const requirementsFile = "docs/business/dormitory/evidence-requirements.yml";
  const requirementsDoc = readJson(requirementsFile);
  const evidenceRequirementMap = new Map((requirementsDoc.evidenceRequirements ?? []).map((item) => [item.requirementId, item]));
  for (const item of workItems) {
    for (const requirementId of item.requiredEvidence) {
      const requirement = evidenceRequirementMap.get(requirementId) ?? {
        requirementId,
        nameZh: nameZhForField(requirementId),
        scope: "workItem",
        requiredFields: ["evidenceRef", "evidenceType", "tenantId", "capturedAt", "capturedBy"],
        auditRequired: true,
        wrongScopeBlocksConfirm: true,
        missingBlocksConfirm: true
      };
      requirement.requiredFields = [...new Set([...(requirement.requiredFields ?? []), "evidenceRef", "evidenceType", "tenantId", "capturedAt", "capturedBy"])];
      requirement.auditRequired = true;
      requirement.wrongScopeBlocksConfirm = true;
      requirement.missingBlocksConfirm = true;
      evidenceRequirementMap.set(requirementId, requirement);
    }
  }
  requirementsDoc.evidenceRequirements = [...evidenceRequirementMap.values()].sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  requirementsDoc.derivedFrom = [kernelPath];
  requirementsDoc.generatedBy = generatedBy;
  requirementsDoc.sourceKernelVersion = kernelVersion;
  requirementsDoc.manualEditAllowed = false;
  requirementsDoc.graphBinding = "domain.dormitory.evidence-requirements";
  writeJson(requirementsFile, requirementsDoc);

  const evidenceFile = "docs/business/dormitory/evidence-policy.yml";
  const evidence = readJson(evidenceFile);
  const requirementMap = new Map((evidence.requirements ?? []).map((item) => [item.requirementId, item]));
  for (const item of workItems) {
    for (const requirementId of item.requiredEvidence) {
      const requirement = requirementMap.get(requirementId) ?? {
        requirementId,
        requirementNameZh: nameZhForField(requirementId),
        scope: "workItem",
        evidenceType: requirementId,
        workItemTypes: [],
        blocksConfirmWhenMissing: true
      };
      requirement.workItemTypes = [...new Set([...(requirement.workItemTypes ?? []).filter((type) => byType.has(type) || type.startsWith("Gate.")), item.workItemType])];
      requirementMap.set(requirementId, requirement);
    }
  }
  evidence.requirements = [...requirementMap.values()].sort((a, b) => a.requirementId.localeCompare(b.requirementId));
  evidence.derivedFrom = [kernelPath];
  evidence.generatedBy = generatedBy;
  evidence.sourceKernelVersion = kernelVersion;
  evidence.manualEditAllowed = false;
  evidence.graphBinding = "domain.dormitory.evidence-policy";
  writeJson(evidenceFile, evidence);

  const ledgerFile = "docs/business/dormitory/ledger-posting-contract.yml";
  const ledger = readJson(ledgerFile);
  const postingMap = new Map((ledger.postings ?? []).map((item) => [item.basisType ?? item.ledgerPolicyRef, item]));
  for (const posting of postingMap.values()) {
    posting.workItemTypes = (posting.workItemTypes ?? [])
      .map((type) => type === "Dorm.RefundApprove" ? "Dorm.CheckoutSettlementApprove" : type)
      .map((type) => type === "Dorm.ExpenseRecord" ? "Finance.ExpenseRecord" : type)
      .filter((type) => byType.has(type));
  }
  for (const item of workItems.filter((entry) => entry.ledgerPolicyRef !== "ledger.none.v1")) {
    const posting = postingMap.get(item.ledgerPolicyRef) ?? {
      basisType: item.ledgerPolicyRef,
      workItemTypes: [],
      owner: "finance-gate",
      appendOnly: true,
      balanced: true,
      ledgerImpact: item.ledgerImpact
    };
    posting.workItemTypes = [...new Set([...(posting.workItemTypes ?? []).filter((type) => byType.has(type)), item.workItemType])];
    posting.owner = "finance-gate";
    posting.appendOnly = true;
    posting.balanced = true;
    posting.ledgerImpact = item.ledgerImpact;
    postingMap.set(item.ledgerPolicyRef, posting);
  }
  ledger.postings = [...postingMap.values()].sort((a, b) => String(a.basisType).localeCompare(String(b.basisType)));
  ledger.financeGateOnly = true;
  ledger.depositIsNotRevenue = true;
  ledger.depositRefundIsNotExpense = true;
  ledger.serviceTaskAmountIsNotCostTruth = true;
  ledger.expenseRequiresBasisAndApproval = true;
  ledger.derivedFrom = [kernelPath];
  ledger.generatedBy = generatedBy;
  ledger.sourceKernelVersion = kernelVersion;
  ledger.manualEditAllowed = false;
  ledger.graphBinding = "domain.dormitory.ledger-posting-contract";
  writeJson(ledgerFile, ledger);
}

function catalogItem(item) {
  return {
    workItemType: item.workItemType,
    decisionRef: item.workItemType,
    中文名称: item.nameZh,
    ownerRole: item.ownerRole,
    backupOwner: item.ownerRole === "宿舍经办人" ? "宿舍负责人" : "宿舍经办人",
    escalationOwner: "宿舍负责人",
    SLA: slaFor(item),
    requiredEvidence: item.requiredEvidence,
    affectedFacts: item.allowedFacts,
    ledgerImpact: item.ledgerImpact,
    confirmationPolicy: item.admissionPolicyRef,
    riskLevel: item.canonicalOwner === "finance-gate" ? "critical" : "medium",
    idempotencyScope: `tenant:${slug(item.workItemType)}:confirm`,
    factTraceRequired: true,
    lensOutputs: item.lensOutputs,
    certificationScenario: item.trainId
  };
}

function derivedView(version, body) {
  return {
    version,
    status: "derived",
    derivedFrom: [kernelPath],
    generatedBy,
    sourceKernelVersion: kernelVersion,
    manualEditAllowed: false,
    graphBinding: `domain.dormitory.${version.split(".").slice(-2, -1)[0] ?? "derived"}`,
    ...body
  };
}

function metric(metricId, nameZh, categoryZh, sourceFacts, exclusionsZh, dimensions, window, correctionStrategyZh, drilldownWorkItemType) {
  return {
    metricId,
    nameZh,
    categoryZh,
    owner: categoryZh === "支出" || categoryZh === "收入" || categoryZh === "押金" ? "finance-gate" : "dormitory",
    formula: `${sourceFacts} over ${window}`,
    sourceFacts,
    exclusionsZh,
    dimensions,
    window,
    threshold: "defined_by_period_review",
    drilldown: ["WorkItem", "DomainEvent", "LedgerEntry", "Evidence", "LensSnapshot"],
    drilldownWorkItemType,
    refreshPolicy: "projection_event_or_period_snapshot",
    correctionStrategyZh
  };
}

function groupMetricsByCategory() {
  return metrics.reduce((acc, item) => {
    const group = acc.find((entry) => entry.categoryZh === item.categoryZh) ?? { categoryZh: item.categoryZh, metrics: [] };
    if (!acc.includes(group)) acc.push(group);
    group.metrics.push(item.metricId);
    return acc;
  }, []);
}

function allNewAndDerivedFiles() {
  return [
    kernelPath,
    "docs/business/domains/dormitory/handoff-contract.json",
    "docs/business/domains/dormitory/dormitory-release-train.yml",
    "docs/business/domains/dormitory/dormitory-pilot-scenario-pack.yml",
    "docs/business/domains/dormitory/dormitory-seed-data-pack.json",
    "docs/business/domains/dormitory/dormitory-observability-contract.json",
    "docs/business/domains/dormitory/dormitory-operator-playbook.md",
    "docs/business/domains/dormitory/dormitory-pilot-go-no-go.json",
    ...workItems.map((item) => `docs/business/domains/dormitory/workitems/${slug(item.workItemType)}.json`),
    "docs/business/dormitory/workitem-catalog.yml",
    "docs/business/dormitory/workitem-decision-table.json",
    "docs/business/dormitory/value-streams.yml",
    "docs/business/dormitory/workitem-sla.yml",
    "docs/business/dormitory/workitem-raci.yml",
    "docs/business/dormitory/go-no-go.yml",
    "docs/business/dormitory/metrics-tree.yml",
    "docs/business/dormitory/metric-formula-contract.yml",
    "docs/business/dormitory/lens-map.yml",
    "docs/scenarios/dormitory/golden-pilot.yml",
    "docs/business/dormitory/canonical-scenario-map.json",
    "docs/business/dormitory/scenario-field-contract.yml",
    "docs/business/dormitory/evidence-policy.yml",
    "docs/business/dormitory/evidence-requirements.yml",
    "docs/business/dormitory/ledger-posting-contract.yml",
    "docs/contracts/definition/workitem-definition-registry.json",
    "docs/contracts/business/oam-business-object-field-registry.json",
    "docs/contracts/business/oam-workflow-state-registry.json"
  ];
}

function derivedTargetPaths() {
  return allNewAndDerivedFiles().filter((filePath) => filePath.startsWith("docs/business/") || filePath.startsWith("docs/scenarios/"));
}

function graphBindingForPath(filePath) {
  if (filePath.includes("/workitems/")) {
    const fileName = path.basename(filePath, ".json");
    const item = workItems.find((entry) => slug(entry.workItemType) === fileName);
    return item ? `workitem.${item.workItemType}` : "domain.dormitory.workitems";
  }
  return `file.${filePath}`;
}

function checkerForPath(filePath) {
  if (filePath.includes("release-train")) return "scripts/business/check-dormitory-release-train.mjs";
  if (filePath.includes("pilot-scenario")) return "scripts/business/check-dormitory-pilot-scenario-pack.mjs";
  if (filePath.includes("dormitory-operating-kernel")) return "scripts/business/check-dormitory-operating-kernel.mjs";
  return "scripts/business/check-dormitory-derived-contracts.mjs";
}

function lifecycleForPath(filePath) {
  if (filePath === kernelPath || filePath.endsWith("handoff-contract.json")) return "active_contract";
  if (filePath.endsWith("operator-playbook.md")) return "human_manual";
  if (filePath.startsWith("docs/business/domains/dormitory/workitems/")) return "derived_view";
  if (filePath.includes("dormitory-release-train") || filePath.includes("pilot-scenario") || filePath.includes("seed-data") || filePath.includes("observability") || filePath.includes("pilot-go-no-go")) return "derived_view";
  if (filePath.startsWith("scripts/")) return "active_validation";
  return "active_contract";
}

function ownerForPath(filePath) {
  if (filePath.startsWith("scripts/")) return "oam-release-owner";
  if (filePath.includes("finance") || filePath.includes("ledger")) return "finance-gate";
  return "domain-owner";
}

function workspaceFor(trainId) {
  if (trainId === "train-1-business-mainline") return "W-DORM-MAINLINE";
  if (trainId === "train-2-service-expense-checkout") return "W-DORM-SERVICE-CHECKOUT";
  return "W-DORM-GOVERNANCE";
}

function dbGroupsFor(systemOwner, ledgerPolicyRef) {
  const groups = ["operations-runtime", "evidence-audit", "projection-read-side"];
  if (systemOwner === "finance-gate" || ledgerPolicyRef !== "ledger.none.v1") groups.push("finance-ledger");
  if (systemOwner === "identity-trust") groups.push("identity-trust");
  if (systemOwner.includes("ServiceTask")) groups.push("maintenance-facts");
  if (!groups.includes("accommodation-facts") && !systemOwner.includes("finance") && systemOwner !== "finance-gate") groups.push("accommodation-facts");
  return [...new Set(groups)];
}

function allowedFactsFor(objectId, financeOwned) {
  const facts = [objectId, "EvidenceObject", "DomainEvent", "CommandSubmission"];
  if (financeOwned) facts.push("LedgerEntry", "MoneyBasis");
  return facts;
}

function forbiddenFactsFor(financeOwned) {
  return financeOwned
    ? ["Room", "Bed", "Stay", "RoomInspection", "ServiceTask"]
    : ["Payment", "PaymentAllocation", "DepositEntry", "LedgerEntry", "Refund"];
}

function ledgerImpactFor(policy) {
  if (policy === "ledger.none.v1") return "无账务影响";
  if (policy === "ledger.readonly.v1") return "只读业务事实、财务事实、证据事实和 Lens，不写账";
  if (policy.includes("deposit")) return "通过 finance-gate 生成押金负债或结算账务；押金不是收入";
  if (policy.includes("expense")) return "支出必须有依据和审批，通过 finance-gate 进入成本统计";
  if (policy.includes("payment")) return "通过 finance-gate 生成平衡普通收款分配";
  if (policy.includes("correction")) return "通过 finance-gate 生成追加纠错或反转，不原地修改旧分录";
  return "通过 finance-gate 形成追加式账务事实";
}

function ownerForObject(objectId) {
  if (["Payment", "DepositAccount", "Expense", "ExpenseLink", "MoneyBasis"].includes(objectId)) return "finance-gate";
  if (objectId === "Resident") return "identity";
  if (objectId === "ServiceTask") return "maintenance";
  return "accommodation";
}

function ownerCapabilityForObject(objectId) {
  if (objectId === "Payment") return "finance.payment";
  if (objectId === "DepositAccount") return "finance.deposit";
  if (["Expense", "ExpenseLink", "MoneyBasis"].includes(objectId)) return "finance.expense";
  if (objectId === "Resident") return "identity.account-actor";
  if (objectId === "ServiceTask") return "accommodation.service-task";
  if (["CheckoutCase", "RoomInspection"].includes(objectId)) return "accommodation.checkout";
  if (["Lead", "Reservation"].includes(objectId)) return "accommodation.lead-reservation";
  if (["Stay", "PeriodSnapshot", "ActionPlan", "ExceptionCase"].includes(objectId)) return "accommodation.lifecycle";
  return "accommodation.resource";
}

function moduleForObject(objectId) {
  if (["Payment", "DepositAccount", "Expense", "ExpenseLink", "MoneyBasis"].includes(objectId)) return "finance-gate";
  if (objectId === "Resident") return "identity";
  if (objectId === "ServiceTask") return "maintenance";
  return "accommodation";
}

function admissionFor(workItemType, financeOwned, ownerRole) {
  if (workItemType.includes("CheckoutSettlement")) return "deposit_refund";
  if (workItemType.includes("PeriodReview")) return "period_close";
  if (financeOwned || ownerRole === "宿舍负责人") return "payment_confirmation";
  return "dormitory_l1_internal_pilot_observation";
}

function entryFromFor(item) {
  if (item.workItemType.includes("Period")) return "PC Governance Surface 或周期调度生成";
  if (item.workItemType.startsWith("Finance.")) return "宿舍 WorkItem 提交后由 finance-gate 生成";
  return "Mobile Surface 工作台、Search 只读跳转或上游 WorkItem 下游提示";
}

function eventFor(item) {
  return `${item.commandType.replace(/\./g, "")}Submitted`;
}

function handoffFields() {
  return [
    "caseId",
    "sourceWorkItemId",
    "leadId",
    "reservationId",
    "stayId",
    "roomId",
    "bedId",
    "ratePlanId",
    "depositId",
    "paymentId",
    "serviceTaskId",
    "expenseId",
    "evidenceRefs",
    "projectionVersion",
    "lockedFields",
    "missingFields",
    "nextWorkItemHints"
  ];
}

function handoffSource(fieldId) {
  if (fieldId === "evidenceRefs") return "Evidence Kernel";
  if (fieldId === "projectionVersion") return "Projection/Search/Lens Kernel";
  if (["lockedFields", "missingFields", "nextWorkItemHints"].includes(fieldId)) return "Runtime Kernel";
  if (fieldId.endsWith("Id")) return "Upstream confirmed WorkItem or DomainEvent";
  return "OperationCase";
}

function slaFor(item) {
  if (item.workItemType.includes("Payment") || item.workItemType.includes("Deposit")) return "15m";
  if (item.workItemType.includes("Period")) return "weekly";
  if (item.workItemType.includes("Expense") || item.workItemType.includes("Checkout")) return "1d";
  return "1h";
}

function nameZhForField(fieldId) {
  const dict = {
    roomId: "房间ID",
    bedId: "床位ID",
    ratePlanId: "价格方案ID",
    leadId: "线索ID",
    reservationId: "预订ID",
    residentId: "入住人ID",
    stayId: "入住ID",
    paymentId: "收款ID",
    depositId: "押金账户ID",
    serviceTaskId: "服务任务ID",
    expenseId: "支出ID",
    evidenceRefs: "证据引用",
    amount: "金额",
    currency: "币种"
  };
  return dict[fieldId] ?? fieldId;
}

function slug(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\./g, "-")
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function writeJson(file, value) {
  const full = abs(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeJsonAsYml(file, value) {
  writeJson(file, value);
}

function writeText(file, value) {
  const full = abs(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, value, "utf8");
}

function abs(file) {
  return path.join(root, file);
}
