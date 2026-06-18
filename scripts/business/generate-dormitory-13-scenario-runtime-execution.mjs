import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_13_RUNTIME_EXECUTION_OUTPUT_ROOT || root;
const generatedBy = "scripts/business/generate-dormitory-13-scenario-runtime-execution.mjs";
const generatorVersion = "oam.dormitory-13-scenario-runtime-execution-generator.v1";
const outputPath = "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeExecution.generated.json";
const registryPath = "docs/contracts/definition/workitem-definition-registry.json";
const visibleBusinessCopyContractPath = "docs/oam/visible-business-copy-contract.json";
const FIELD_LABEL_ALIASES_BY_COMMAND = {
  "Dorm.PaymentReceiptSubmit": {
    "备注": "paymentRemark"
  },
  "Dorm.DepositGuaranteeSubmit": {
    "备注": "paymentRemark"
  },
  "Dorm.FinanceGateConfirm": {
    "确认备注": "financeConfirmRemark"
  }
};
const FIELD_LABEL_TO_STABLE_ID = {
  "对应收款项目": "paymentItem",
  "收款项目": "paymentItem",
  "是否分笔": "splitPayment",
  "是否需要押金": "depositRequired",
  "是否需要担保": "guaranteeRequired",
  "付款人": "payerName",
  "实收金额": "receivedAmount",
  "收款时间": "paymentTime",
  "收款方式": "paymentMethod",
  "押金金额": "depositAmount",
  "押金": "depositOption",
  "押金方式": "depositMethod",
  "担保": "guaranteeOption",
  "预授权": "preAuthorizationOption",
  "担保人/担保方式": "guaranteeMethod",
  "担保有效期": "guaranteeValidUntil",
  "退回原因": "financeReturnReason",
  "确认": "financeConfirm",
  "退回补证": "financeReturnForEvidence",
  "部分确认": "financePartialConfirm",
  "标记异常": "financeMarkException"
};

const scenarioSpecs = [
  spec(3, "product-and-pricing", "DormitoryScenario3ProductAndPricing.generated.json"),
  spec(4, "inquiry-and-quote", "DormitoryScenario4InquiryAndQuote.generated.json"),
  spec(5, "reservation-and-inventory-hold", "DormitoryScenario5ReservationAndInventoryHold.generated.json"),
  spec(6, "payment-deposit-and-guarantee", "DormitoryScenario6PaymentDepositAndGuarantee.generated.json"),
  spec(7, "check-in-processing", "DormitoryScenario7CheckInProcessing.generated.json"),
  spec(8, "in-stay-management", "DormitoryScenario8InStayManagement.generated.json"),
  spec(9, "checkout-settlement", "DormitoryScenario9CheckoutSettlement.generated.json"),
  spec(10, "cancel-noshow-refund", "DormitoryScenario10CancelNoShowRefund.generated.json"),
  spec(11, "housekeeping-maintenance-outofservice", "DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json"),
  spec(12, "channel-corporate-customer", "DormitoryScenario12ChannelCorporateCustomer.generated.json"),
  spec(13, "reporting-audit-review", "DormitoryScenario13ReportingAuditReview.generated.json")
];

const inputFiles = [
  "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json",
  visibleBusinessCopyContractPath,
  "docs/contracts/generated/dormitory/13-scenario-handoff-summaries.generated.json",
  ...scenarioSpecs.flatMap((item) => [
    item.runtimeMirrorPath,
    item.stepsFieldsPath,
    item.surfaceNavigationPath,
    item.handoffPath
  ])
];
const inputDigests = inputFiles.map((file) => ({ path: file, digest: fileDigest(file) }));
const sourceContentDigest = fileDigest("docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json");
const inputDigest = digestObject({ version: "oam.dormitory-13-runtime-execution-input.v1", inputDigests });
const visibleBusinessCopyContract = readJson(visibleBusinessCopyContractPath);
const scenarios = scenarioSpecs.map(buildScenarioExecution);

const output = {
  generated: true,
  doNotEdit: true,
  kind: "dormitory-13-scenario-runtime-execution.generated",
  version: "oam.dormitory-13-scenario-runtime-execution.generated.v1",
  generatorVersion,
  generatedBy,
  generatedFrom: inputFiles,
  inputDigest,
  inputDigests,
  sourceContentDigest,
  outputContentDigest: "sha256:pending",
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  runtimeExecutionPolicy: {
    currentMainline: "Dormitory.13ScenarioMainline",
    status: "runtime-test-admitted",
    generatedExecutionMode: "scenario-source-authority-to-runtime-projection",
    searchListReportReadonly: true,
    writesThroughOperationsRuntimeOnly: true,
    generatedOnlyConsumption: true
  },
  scenarios
};
const finalized = {
  ...output,
  outputContentDigest: digestObject(output)
};

writeJson(outputPath, finalized);
patchDefinitionRegistry(finalized);

console.log("Dormitory 13 scenario runtime execution generated.");
console.log(outputPath);
console.log(registryPath);

function spec(packageNo, slug, runtimeFile) {
  return {
    packageNo,
    slug,
    runtimeMirrorPath: `services/core-api/WorkOS.Api/Runtime/${runtimeFile}`,
    stepsFieldsPath: `docs/contracts/generated/dormitory/scenario${packageNo}-steps-fields.generated.json`,
    surfaceNavigationPath: `docs/contracts/generated/dormitory/scenario${packageNo}-surface-navigation.generated.json`,
    handoffPath: `docs/contracts/generated/dormitory/scenario${packageNo}-handoff.generated.json`
  };
}

function buildScenarioExecution(item) {
  const runtimeMirror = readJson(item.runtimeMirrorPath);
  const stepsFields = readJson(item.stepsFieldsPath);
  const surfaceNavigation = readJson(item.surfaceNavigationPath);
  const handoff = readJson(item.handoffPath);
  const workspaceId = `W-DORM-SCENARIO${item.packageNo}-${kebabToUpper(item.slug)}`;
  const sliceId = runtimeMirror.authorityId;
  const steps = (stepsFields.steps ?? []).map((step, index) =>
    runtimeStep(item, runtimeMirror, step, index));
  const transitions = steps.slice(0, -1).map((step, index) => ({
    policyId: `generated-transition.dormitory.scenario${item.packageNo}.${step.stepId}-to-${steps[index + 1].stepId}.v1`,
    fromDefinitionId: step.definitionId,
    toDefinitionId: steps[index + 1].definitionId,
    sourceContract: outputPath
  }));
  const startAdapterDefinitionIds = Object.fromEntries(
    steps.map((step) => [`${workspaceId}:${step.cardId}`, step.definitionId])
  );
  return {
    scenarioPackageNo: item.packageNo,
    scenarioId: runtimeMirror.scenarioId,
    authorityId: runtimeMirror.authorityId,
    nameZh: runtimeMirror.nameZh,
    workspaceId,
    sliceId,
    taskId: `T-DORM-SCENARIO${item.packageNo}-${kebabToUpper(item.slug)}`,
    title: localized(runtimeMirror.nameZh),
    summary: localized(runtimeMirror.businessGoalZh || runtimeMirror.nameZh),
    next: localized("按页面顺序完成当前办理；只读上游摘要由系统带入。"),
    status: "runtime-test-admitted",
    sourceRefs: {
      runtimeMirror: item.runtimeMirrorPath,
      stepsFields: item.stepsFieldsPath,
      surfaceNavigation: item.surfaceNavigationPath,
      handoff: item.handoffPath
    },
    startAdapterDefinitionIds,
    searchCommands: [
      {
        templateWorkspaceId: workspaceId,
        firstCardId: steps[0]?.cardId ?? "",
        title: localized(runtimeMirror.nameZh),
        subtitle: localized(surfaceNavigation.surfaceNavigation?.workbenchZh || runtimeMirror.businessGoalZh || runtimeMirror.nameZh),
        nextAction: localized(`开始${runtimeMirror.nameZh}`),
        keywords: keywordsFor(item, runtimeMirror, stepsFields, surfaceNavigation)
      }
    ],
    optionSets: optionSetsFor(runtimeMirror, stepsFields),
    startContext: startContextFor(item.packageNo, runtimeMirror, handoff),
    steps,
    transitions,
    definitions: steps.map((step) => definitionForRuntimeStep(item.packageNo, workspaceId, sliceId, step, runtimeMirror))
  };
}

function runtimeStep(item, runtimeMirror, step, index) {
  const cardId = `cert.${camelFromKebab(step.stepId)}`;
  const workItemType = step.commandId;
  const commandSuffix = workItemType.split(".").pop() ?? step.stepId;
  const definitionId = `definition.dormitory.scenario${item.packageNo}.${pascalToCamel(commandSuffix)}.v1`;
  const fields = runtimeFieldsForStep(step, runtimeMirror);
  const readOnlySummary = runtimeReadOnlySummaryForStep(step, runtimeMirror, item.packageNo);
  const legalActions = runtimeLegalActionsForStep(step, item.packageNo);
  const sourceEvidence = (step.userUploadedOrBoundEvidence ?? []).map((label) => ({
    evidenceId: evidenceIdFor(label),
    labelZh: label,
    required: true,
    source: "source-authority"
  }));
  const runtimeEvidenceMarker = {
    evidenceId: `evidence.dormitory.scenario${item.packageNo}.${step.stepId}.runtime`,
    labelZh: `${step.nameZh || step.commandBusinessNameZh || step.stepId}办理证据`,
    required: false,
    source: "generated-runtime-execution"
  };
  const stepEvidence = uniqueEvidence([
    ...sourceEvidence,
    runtimeEvidenceMarker
  ]);
  return {
    stepNo: step.stepNo,
    stepId: step.stepId,
    cardId,
    status: index === 0 ? "ready" : "notStarted",
    workItemType,
    definitionId,
    commandType: `Dormitory.Scenario${item.packageNo}.${commandSuffix}`,
    eventType: `${workItemType}.confirmed`,
    title: localized(step.commandBusinessNameZh || step.nameZh || commandSuffix),
    confirmationLabel: localized(`提交：${step.nameZh || step.commandBusinessNameZh || commandSuffix}`),
    fields: fields.map((field) => runtimeField(field, runtimeMirror)),
    readOnlySummary,
    legalActions,
    primaryBusinessObject: step.primaryBusinessObject || "",
    requiredReadContext: step.requiredReadContext ?? [],
    financialContext: step.financialContext ?? { applies: false },
    handoffSummary: step.handoffSummary ?? null,
    searchReadModel: step.searchReadModel ?? [],
    evidence: stepEvidence.map((evidence) => runtimeEvidence(evidence)),
    evidenceIds: stepEvidence.map((evidence) => evidence.evidenceId),
    projectionTargets: projectionTargetsFor(runtimeMirror, step),
    sourceStep: {
      nameZh: step.nameZh,
      commandBusinessNameZh: step.commandBusinessNameZh,
      userSees: step.userSees ?? [],
      requiredReadContext: step.requiredReadContext ?? [],
      editableInputs: step.editableInputs ?? step.userFilledFields ?? [],
      fixedSelections: step.fixedSelections ?? step.userSelectedFields ?? [],
      legalActions: step.legalActions ?? [],
      outputs: step.outputs ?? [],
      validations: step.validations ?? []
    }
  };
}

function runtimeFieldsForStep(step, runtimeMirror) {
  const selected = (step.fixedSelections ?? step.userSelectedFields ?? [])
    .filter((label) => !isLegalActionLike(label))
    .map((label) => runtimeFieldDescriptor(label, "selected", step, runtimeMirror));
  const filled = (step.editableInputs ?? step.userFilledFields ?? [])
    .filter((label) => !isLegalActionLike(label))
    .map((label) => runtimeFieldDescriptor(label, "filled", step, runtimeMirror));
  return uniqueByFieldId([...selected, ...filled]);
}

function runtimeReadOnlySummaryForStep(step, runtimeMirror, packageNo) {
  const authoritySummaries = runtimeMirror.fields?.fieldAuthority?.readOnlySummary ?? [];
  const byLabelOrId = new Map();
  for (const item of authoritySummaries) {
    byLabelOrId.set(String(item.labelZh || item.fieldId || "").trim(), item);
    byLabelOrId.set(String(item.fieldId || "").trim(), item);
  }
  const contexts = unique([
    ...(step.requiredReadContext ?? []),
    ...(step.userSees ?? [])
  ]);
  return contexts.map((label) => {
    const authority = byLabelOrId.get(String(label).trim());
    const fieldId = stableRuntimeFieldId(authority?.fieldId || label, step, runtimeMirror);
    const labelZh = labelForField(fieldId, authority?.labelZh || label);
    return {
      fieldId,
      label: localized(labelZh),
      layer: "system",
      type: typeFor(fieldId),
      required: false,
      source: "readOnlySummary",
      userSubmitted: false,
      visibleToUser: true,
      ui: {
        control: "readonly",
        optionSet: "",
        options: [],
        defaultValue: readOnlyDefaultValueFor(fieldId, labelZh, packageNo),
        derivedFrom: authority?.sourceScenario || "requiredReadContext",
        readonly: true
      },
      help: localized("系统带出的业务摘要，只读展示，不需要重复填写。")
    };
  });
}

function runtimeLegalActionsForStep(step, packageNo) {
  const actions = (step.legalActions ?? [])
    .map((action) => typeof action === "string" ? { labelZh: action } : action)
    .filter((action) => action?.labelZh || action?.actionId || action?.labelKey);
  return uniqueByActionId(actions.map((action) => {
    const labelZh = action.labelZh || action.actionId || action.labelKey;
    const actionId = action.actionId || stableValue(labelZh);
    return {
      actionId,
      label: localized(labelZh),
      legalActionRef: action.legalActionRef || `legalAction.dormitory.scenario${packageNo}.${actionId}.v1`,
      admissionRequired: action.admissionRequired !== false,
      writeBusinessFact: action.writeBusinessFact === true,
      source: "source-authority"
    };
  }));
}

function runtimeFieldDescriptor(label, mode, step, runtimeMirror) {
  const fieldId = stableRuntimeFieldId(label, step, runtimeMirror);
  return {
    fieldId,
    labelZh: labelForField(fieldId, label),
    selected: mode === "selected"
  };
}

function stableRuntimeFieldId(label, step, runtimeMirror) {
  const value = String(label || "").trim();
  if (!value) return value;
  const stableFields = new Set([
    ...(runtimeMirror.fields?.userFilled ?? []),
    ...(runtimeMirror.fields?.userSelected ?? [])
  ].filter((item) => !hasCjk(item)));

  const commandAlias = FIELD_LABEL_ALIASES_BY_COMMAND[step.commandId]?.[value];
  if (commandAlias && stableFields.has(commandAlias)) return commandAlias;

  const genericAlias = FIELD_LABEL_TO_STABLE_ID[value];
  if (genericAlias && stableFields.has(genericAlias)) return genericAlias;

  if (genericAlias) return genericAlias;

  if (!hasCjk(value)) return value;

  return `${commandSuffix(step.commandId)}_${stableValue(value)}`;
}

function runtimeField(field, runtimeMirror) {
  const { fieldId, labelZh, selected } = field;
  const control = selected ? "select" : controlFor(fieldId);
  const optionSet = selected ? optionSetForField(fieldId, runtimeMirror) : "";
  return {
    fieldId,
    label: localized(labelZh),
    layer: "business",
    type: typeFor(fieldId),
    required: false,
    source: selected ? "clientSelected" : "clientSubmitted",
    userSubmitted: true,
    visibleToUser: true,
    ui: {
      control,
      optionSet,
      options: optionSet ? optionSetEntries(optionSet, runtimeMirror, labelZh) : [],
      defaultValue: defaultValueFor(fieldId),
      derivedFrom: "",
      readonly: false
    },
    help: localized("按当前页面提示填写；系统可带出的上游摘要不需要重复录入。")
  };
}

function readOnlyDefaultValueFor(fieldId, labelZh, packageNo) {
  const defaults = {
    reservationNoDisplay: "RSV-RUNTIME-PRECONDITION",
    reservationNo: "RSV-RUNTIME-PRECONDITION",
    customerInfo: "真实浏览器客户 / 13800001234",
    customerName: "真实浏览器客户",
    contactPhone: "13800001234",
    checkInDate: "2026-07-01",
    checkOutDate: "2026-07-05",
    stayDateRange: "2026-07-01 至 2026-07-05",
    guestCount: "1",
    roomOrBedSummary: "A 301 房间 / 01 床位",
    priceSnapshot: "房费 CNY 180/晚，价格快照已确认",
    paymentItem: "房费/订金",
    receivedAmountSummary: "已收 CNY 0",
    currentAmount: "本次 CNY 180",
    remainingReceivable: "剩余待收 CNY 180",
    currency: "CNY",
    evidenceRequirement: "需上传收款凭证"
  };
  if (defaults[fieldId]) return defaults[fieldId];
  if (/币种|currency/i.test(labelZh)) return "CNY";
  if (/金额|价格|应收|已收|待收|押金|退款|扣费|费用|佣金|amount|price|fee|deposit|refund/i.test(`${fieldId} ${labelZh}`)) {
    return "CNY 180";
  }
  if (/客户|姓名/.test(labelZh)) return "真实浏览器客户";
  if (/电话|联系/.test(labelZh)) return "13800001234";
  if (/预订号/.test(labelZh)) return "RSV-RUNTIME-PRECONDITION";
  if (/房间|床位/.test(labelZh)) return "A 301 房间 / 01 床位";
  if (/日期|入住|离店/.test(labelZh)) return "2026-07-01 至 2026-07-05";
  return `场景 ${packageNo} 当前业务摘要`;
}

function runtimeEvidence(evidence) {
  return {
    evidenceId: evidence.evidenceId,
    label: localized(evidence.labelZh || labelForField(evidence.evidenceId.replace(/^evidence\./, ""))),
    required: evidence.required === true,
    source: evidence.source || "generated-runtime-execution",
    auditEventField: evidence.evidenceId,
    help: localized("系统绑定本次办理证据，作为测试运行证据，不开放生产确认。")
  };
}

function definitionForRuntimeStep(packageNo, workspaceId, sliceId, step, runtimeMirror) {
  const command = (runtimeMirror.commands ?? []).find((item) => item.commandId === step.workItemType);
  return {
    definitionId: step.definitionId,
    businessLineId: "dormitory",
    sliceId,
    workspaceId,
    workItemType: step.workItemType,
    commandType: step.commandType,
    ownerSlice: sliceId,
    migrationRefs: migrationRefsFor(step.cardId),
    allowedFacts: unique([...(command?.writesObjects ?? step.projectionTargets), "EvidenceObject", "DomainEvent", "CommandSubmission"]),
    forbiddenFacts: forbiddenFacts(),
    fieldContractRef: `field.dormitory.scenario${packageNo}.${step.stepId}.v1`,
    evidencePolicyRef: `evidence.dormitory.scenario${packageNo}.${step.stepId}.v1`,
    riskPolicyRef: "risk.dormitory.standard.v1",
    ledgerPolicyRef: "ledger.none.v1",
    admissionPolicyRef: "dormitory_l1_internal_pilot_observation",
    surfacePolicyRef: `surface.mobile.work.dormitory-scenario${packageNo}-${step.stepId}`,
    productionConfirmAllowed: false,
    definitionMode: "oam-certification-current",
    removalImpact: `Generated from Dormitory Scenario ${packageNo} Source Authority; no production confirm.`
  };
}

function startContextFor(packageNo, runtimeMirror, handoff) {
  const upstream = (handoff.upstream?.requiredReadonlyInputs ?? runtimeMirror.upstream?.requiredReadonlyInputs ?? [])
    .join(" / ");
  const common = {
    startContextSource: outputPath,
    startContextKind: `dormitory-scenario${packageNo}-runtime-precondition`,
    upstreamSummary: upstream || "上游摘要由当前运行时受控前置提供",
    finalGoNoGo: "NO_GO"
  };
  const basicReadiness = {
    baseReadyConfirmed: "true",
    basicReadinessSummary: "基础就绪已完成"
  };
  const operableResource = {
    operableConfirmed: "true",
    canEnterPriceMaintenance: "true",
    operationStatus: "可运营",
    operationStatusSummary: "可运营且未阻断",
    operationBlockerReason: ""
  };
  const productAndPrice = {
    productResourceBindingConfirmed: "true",
    productName: "直客住宿商品",
    productActive: "true",
    ratePlanRef: "rate-direct-standard",
    priceSnapshotRef: "price-snapshot-current",
    priceVersionStatus: "已生效",
    priceVersionActive: "true",
    pricingPeriod: "按晚",
    unitRate: "180",
    tariffQuantity: "1",
    amount: "180",
    currency: "CNY"
  };
  const quoteAndDemand = {
    quoteConfirmed: "true",
    quoteStatus: "已确认",
    quoteValid: "true",
    quoteRef: "quote-direct-current",
    quoteVersionRef: "quote-version-current",
    quoteSnapshotRef: "quote-snapshot-current",
    quoteValidUntil: "2026-12-31",
    customerConfirmed: "true",
    customerName: "真实浏览器客户",
    contactPhone: "13800001234",
    checkInDate: "2026-07-01",
    checkOutDate: "2026-07-05",
    stayDateRange: "2026-07-01 至 2026-07-05",
    guestCount: "1",
    guestCountValid: "true"
  };
  const reservationSnapshot = {
    reservationConfirmed: "true",
    reservationStatus: "confirmed",
    reservationNo: "RSV-RUNTIME-PRECONDITION",
    inventoryHoldConfirmed: "true",
    inventoryHoldActive: "true",
    confirmedReservation: "true"
  };
  const financeSnapshot = {
    financeStatus: "confirmed",
    financeGateRoute: "finance-gate",
    authorizedFinanceRole: "true",
    authorizedManager: "true",
    paymentRequirementSource: "reservation",
    receivedAmount: "180",
    depositAmount: "300",
    guaranteeValidityUntil: "2026-12-31"
  };
  const checkInSnapshot = {
    arrivalConfirmed: "true",
    identityVerified: "true",
    agreementConfirmed: "true",
    handoverConfirmed: "true",
    roomBedReady: "true",
    checkInStatus: "checked-in",
    stayRecordRef: "stay-runtime-precondition",
    currentOccupancyBound: "true",
    validOccupancy: "true",
    currentOccupancyStatus: "in-stay",
    currentOccupancyVersion: "1",
    occupancyRef: "occupancy-runtime-precondition",
    occupancyId: "occupancy-runtime-precondition",
    occupancyStatus: "in-stay",
    stayStatus: "在住"
  };
  const bedTransferTargetSnapshot = {
    targetResourceAvailable: "true",
    targetBedAvailable: "true",
    targetResourceAvailability: "可换入",
    targetBedAvailability: "可换入",
    targetResourceStatus: "可运营",
    targetOccupancyStatus: "空置"
  };
  const checkoutSnapshot = {
    checkoutStatus: "checkout-ready",
    checkoutConfirmed: "true",
    settlementConfirmed: "true",
    credentialReturned: "true",
    credentialReturnStatus: "已回收",
    credentialExceptionExplained: "false",
    feeSourceValid: "true",
    priceSnapshotBound: "true",
    financeSnapshotBound: "true",
    finalLedgerTruthInput: "false",
    directRefund: "false",
    directTopUp: "false",
    resourceRecoveryTargetStatus: "待保洁"
  };
  const cancellationSnapshot = {
    cancellationReason: "客户主动取消",
    cancellationCustomerConfirmed: "true",
    cancellationPolicySnapshotRef: "cancel-policy-current",
    refundAmount: "0",
    deductionAmount: "50",
    inventoryReleaseRequested: "true",
    financeRequestBoundary: "finance-request-only",
    authorizedAdjustmentBound: "true"
  };
  const serviceSnapshot = {
    workStatus: "completed",
    workVerified: "true",
    outOfServiceDecision: "恢复运营",
    recoveryRecommended: "true",
    managerApproved: "true"
  };
  const reportSnapshot = {
    reportScopeConfirmed: "true",
    dataCompletenessPassed: "true",
    reportSnapshotGenerated: "true",
    financeReadOnly: "true",
    auditFindingBound: "true",
    reviewConclusionBound: "true"
  };
  const byPackage = {
    3: [basicReadiness, operableResource],
    4: [basicReadiness, operableResource, productAndPrice],
    5: [basicReadiness, operableResource, productAndPrice, quoteAndDemand],
    6: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, financeSnapshot],
    7: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, financeSnapshot, checkInSnapshot],
    8: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, checkInSnapshot, bedTransferTargetSnapshot],
    9: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, financeSnapshot, checkInSnapshot, checkoutSnapshot],
    10: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, cancellationSnapshot],
    11: [basicReadiness, operableResource, serviceSnapshot],
    12: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot],
    13: [basicReadiness, operableResource, productAndPrice, quoteAndDemand, reservationSnapshot, financeSnapshot, checkInSnapshot, checkoutSnapshot, cancellationSnapshot, serviceSnapshot, reportSnapshot]
  };
  return Object.assign(common, ...(byPackage[packageNo] ?? [basicReadiness, operableResource]));
}

function optionSetsFor(runtimeMirror, stepsFields) {
  const result = {
    yesNo: [
      option("true", "是"),
      option("false", "否")
    ],
    resourceScope: [
      option("room", "房间"),
      option("bed", "床位")
    ],
    businessChoice: [
      option("confirmed", "确认"),
      option("not_applicable", "不适用"),
      option("return_previous", "返回上一步")
    ]
  };
  for (const [key, value] of Object.entries(runtimeMirror)) {
    if (!key.endsWith("Options") || !Array.isArray(value)) continue;
    result[key] = value.map((entry) => typeof entry === "string"
      ? option(stableValue(entry), entry)
      : option(entry.value || stableValue(entry.label || entry.nameZh || key), entry.label || entry.nameZh || entry.value || key));
  }
  for (const step of stepsFields.steps ?? []) {
    for (const field of runtimeFieldsForStep(step, runtimeMirror).filter((item) => item.selected)) {
      const optionSet = optionSetForField(field.fieldId, runtimeMirror);
      if (result[optionSet]) continue;
      result[optionSet] = [
        option(defaultValueFor(field.fieldId) || "confirmed", field.labelZh),
        option("not_applicable", "不适用")
      ];
    }
  }
  return result;
}

function optionSetForField(fieldId, runtimeMirror) {
  if (/scope/i.test(fieldId) || String(fieldId).includes("范围")) return "resourceScope";
  if (/status/i.test(fieldId) || String(fieldId).includes("状态")) {
    const statusKey = Object.keys(runtimeMirror).find((key) => key.endsWith("StatusOptions"));
    if (statusKey) return statusKey;
  }
  return `option.${stableValue(fieldId)}`;
}

function optionSetEntries(optionSet, runtimeMirror, fallbackLabel = "") {
  if (optionSet === "resourceScope") return [option("room", "房间"), option("bed", "床位")];
  if (optionSet === "businessChoice") return [option("confirmed", "确认"), option("not_applicable", "不适用")];
  const statusValues = runtimeMirror[optionSet];
  if (Array.isArray(statusValues)) {
    return statusValues.map((entry) => typeof entry === "string"
      ? option(stableValue(entry), entry)
      : option(entry.value || stableValue(entry.label || entry.nameZh || optionSet), entry.label || entry.nameZh || entry.value || optionSet));
  }
  return [
    option(defaultValueFor(optionSet) || "confirmed", fallbackLabel || labelForField(optionSet.replace(/^option\./, ""))),
    option("not_applicable", "不适用")
  ];
}

function option(value, label) {
  return { value, label: localized(label) };
}

function projectionTargetsFor(runtimeMirror, step) {
  const command = (runtimeMirror.commands ?? []).find((item) => item.commandId === step.commandId);
  return unique([...(command?.writesObjects ?? []), ...(step.outputs ?? []), "CommandSubmission", "DomainEvent"]);
}

function patchDefinitionRegistry(document) {
  const registry = readJson(registryPath);
  const generatedDefinitions = document.scenarios.flatMap((scenario) => scenario.definitions ?? []);
  const generatedIds = new Set(generatedDefinitions.map((item) => item.definitionId));
  const definitions = [
    ...(registry.definitions ?? []).filter((item) => !generatedIds.has(item.definitionId)),
    ...generatedDefinitions
  ].sort((left, right) => left.definitionId.localeCompare(right.definitionId));
  writeJson(registryPath, {
    ...registry,
    generatedBy,
    dormitory13ScenarioRuntimeExecutionRef: outputPath,
    definitions
  });
}

function keywordsFor(item, runtimeMirror, stepsFields, surfaceNavigation) {
  return unique([
    `场景${item.packageNo}`,
    `场景 ${item.packageNo}`,
    runtimeMirror.nameZh,
    ...displayAliasesFor(runtimeMirror.nameZh),
    runtimeMirror.scenarioId,
    runtimeMirror.authorityId,
    surfaceNavigation.surfaceNavigation?.searchZh,
    surfaceNavigation.surfaceNavigation?.workbenchZh,
    ...(stepsFields.steps ?? []).flatMap((step) => [
      step.stepId,
      step.nameZh,
      step.commandId,
      step.commandBusinessNameZh
    ]),
    "住宿经营",
    "宿舍经营"
  ].filter(Boolean));
}

function displayAliasesFor(nameZh) {
  const replacements = [
    ...(visibleBusinessCopyContract.displayTermReplacementsZh ?? []),
    ...(visibleBusinessCopyContract.displayTermReplacementsRu ?? []),
    ...(visibleBusinessCopyContract.displayTermReplacementsKy ?? [])
  ];
  return unique(replacements
    .filter((entry) => Array.isArray(entry) && entry[0] === nameZh)
    .flatMap((entry) => entry.slice(1))
    .filter(Boolean));
}

function migrationRefsFor(cardId) {
  return [
    {
      type: "sourceCardId",
      value: cardId,
      readOnly: true,
      executable: false,
      affectsAdmission: false,
      affectsRuntimeConfirm: false,
      affectsBusinessIdentity: false,
      affectsLedger: false,
      deletionProofRef: "docs/contracts/definition/source-id-migration-fence.json"
    }
  ];
}

function forbiddenFacts() {
  return [
    "LedgerEntry",
    "LedgerTransaction",
    "PaymentAllocation",
    "DepositEntry",
    "FinanceTruth",
    "ProductionGo",
    "ReleaseAuthority",
    "FinalGo"
  ];
}

function controlFor(fieldId) {
  if (/notes|remark|description|summary|说明|备注|摘要/i.test(fieldId)) return "textarea";
  if (/date|time|At|截止|日期|时间/i.test(fieldId)) return "text";
  if (/amount|price|rate|count|quantity|金额|价格|数量/i.test(fieldId)) return "number";
  return "text";
}

function typeFor(fieldId) {
  return /amount|price|rate|count|quantity|金额|价格|数量/i.test(fieldId) ? "number" : "text";
}

function defaultValueFor(fieldId) {
  if (/amount|price|rate|金额|价格/i.test(fieldId)) return "180";
  if (/count|quantity|数量/i.test(fieldId)) return "1";
  if (/currency/i.test(fieldId)) return "CNY";
  if (/phone|电话/i.test(fieldId)) return "13800001234";
  if (/status/i.test(fieldId)) return "confirmed";
  return "";
}

function labelForField(fieldId, fallbackLabel = "") {
  const labels = {
    resourceScope: "资源范围",
    targetRoomOrBed: "目标房间/床位",
    sellableResourceSelection: "可售资源选择",
    productName: "商品名称",
    productDescription: "商品说明",
    targetGuestType: "适用客群",
    stayRuleSummary: "入住规则摘要",
    productNotes: "商品备注",
    customerName: "客户姓名",
    contactPhone: "联系电话",
    checkInDate: "入住日期",
    checkOutDate: "离店日期",
    guestCount: "人数",
    customerSource: "客户来源",
    inquiryNotes: "询价备注",
    customerType: "客户类型",
    sourceChannel: "来源渠道",
    followUpOwner: "跟进人",
    amount: "金额",
    currency: "币种",
    unitRate: "单价",
    tariffQuantity: "计费数量",
    refundAmount: "退款金额",
    deductionAmount: "扣费金额",
    paymentItem: "收款项目",
    splitPayment: "是否分笔",
    depositRequired: "是否需要押金",
    guaranteeRequired: "是否需要担保",
    receivedAmount: "实收金额",
    paymentMethod: "收款方式",
    paymentTime: "收款时间",
    payerName: "付款人",
    paymentRemark: "备注",
    depositAmount: "押金金额",
    depositMethod: "押金方式",
    guaranteeMethod: "担保人/担保方式",
    guaranteeValidUntil: "担保有效期",
    depositOption: "押金",
    guaranteeOption: "担保",
    preAuthorizationOption: "预授权",
    financeConfirmRemark: "确认备注",
    financeReturnReason: "退回原因",
    financeConfirm: "确认",
    financeReturnForEvidence: "退回补证",
    financePartialConfirm: "部分确认",
    financeMarkException: "标记异常",
    reservationNo: "预订号",
    reservationNoDisplay: "预订号",
    customerInfo: "客户信息",
    stayDateRange: "入住/离店日期",
    roomOrBedSummary: "房间/床位",
    priceSnapshot: "价格快照",
    receivedAmountSummary: "已收金额",
    currentAmount: "本次金额",
    remainingReceivable: "剩余待收",
    evidenceRequirement: "凭证要求",
    workStatus: "工作状态",
    sellableUnit: "售卖单位",
    resourceBindingSelection: "资源绑定",
    productEnabled: "商品启用状态",
    ratePlanName: "价格方案名称",
    basePrice: "基础价格",
    pricingPeriod: "计价周期",
    minimumStayPeriod: "最短入住周期",
    ratePlanNotes: "价格方案备注",
    pricingPeriodOption: "计价周期选项",
    pricingBasis: "计价依据",
    salesChannel: "销售渠道",
    effectiveDate: "生效日期",
    expiryDate: "失效日期",
    specialDatePrice: "特殊日期价格",
    disableReason: "停用原因",
    voidReason: "作废原因",
    weekdayWeekendRule: "平日/周末规则",
    holidayRule: "节假日规则",
    longTermEffective: "长期有效",
    specificDateRange: "指定日期范围",
    approvalNotes: "审核备注",
    adjustmentReason: "调整原因",
    newBasePrice: "新基础价格",
    supplementEvidenceNotes: "补充证据说明",
    customerSource: "客户来源",
    inquiryNotes: "询价备注",
    sourceChannel: "来源渠道",
    followUpOwner: "跟进人",
    roomOrBedPreference: "房间/床位偏好",
    specialRequests: "特殊需求",
    budgetRange: "预算范围",
    demandNotes: "需求备注",
    resourceScopePreference: "资源范围偏好",
    pricingPeriodPreference: "计价周期偏好",
    roomTypePreference: "房型偏好",
    bedTypePreference: "床型偏好",
    quoteOptionSelection: "报价选项",
    productChoice: "商品选择",
    resourceScopeChoice: "资源范围选择",
    quoteNotes: "报价备注",
    discountDescription: "优惠说明",
    followUpAt: "跟进时间",
    quoteValidityOption: "报价有效期",
    sendToCustomer: "发送给客户",
    sendQuote: "发送报价",
    deliveryNotes: "发送备注",
    customerFeedback: "客户反馈",
    followUpNotes: "跟进备注",
    closeReason: "关闭原因",
    requoteReason: "重报价原因",
    resourceChoice: "资源选择",
    roomOrBedChoice: "房间/床位选择",
    holdDurationOption: "锁定时长",
    reservationNotes: "预订备注",
    customerConfirmationMethod: "客户确认方式",
    specialRequestsSupplement: "特殊需求补充"
  };
  return labels[fieldId] || fallbackLabel || String(fieldId || "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

function evidenceIdFor(label) {
  return `evidence.${stableValue(label)}`;
}

function localized(value) {
  const text = String(value || "");
  return { "zh-CN": text, "ru-RU": text, "ky-KG": text };
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim().length > 0)));
}

function uniqueByFieldId(values) {
  const byId = new Map();
  for (const value of values) {
    if (!value?.fieldId || byId.has(value.fieldId)) continue;
    byId.set(value.fieldId, value);
  }
  return Array.from(byId.values());
}

function uniqueEvidence(values) {
  const byId = new Map();
  for (const value of values) {
    if (!value?.evidenceId || byId.has(value.evidenceId)) continue;
    byId.set(value.evidenceId, value);
  }
  return Array.from(byId.values());
}

function uniqueByActionId(values) {
  const byId = new Map();
  for (const value of values) {
    if (!value?.actionId || byId.has(value.actionId)) continue;
    byId.set(value.actionId, value);
  }
  return Array.from(byId.values());
}

function isLegalActionLike(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^(是否|有无|客户确认方式|确认方式|负责人例外审批说明|确认备注|退回原因)/.test(text)) return false;
  if (/(方式|类型|结果|状态|范围|原因|说明|备注|时间|日期|时长|金额|数量|额度|币种|人|客户|负责人|渠道|商品|房间|床位)$/.test(text) &&
    !/^(查看|进入|返回|提交|发布|导出|创建|办理|确认退房|确认取消|确认未到店|确认入住|确认交付|关闭任务)/.test(text)) {
    return false;
  }
  if (/^(确认|退回补证|部分确认|标记异常|转人工复核|转负责人复核|补充证据|发起纠错|导出摘要)$/.test(text)) return true;
  if (/^(办理|进入|查看|返回|继续|保存|提交|发送|发布|导出|关闭|作废|停用|启用|锁定|释放|创建|登记|申请|标记|生成|输出|同步|审核通过|归档|发起)/.test(text)) return true;
  if (/^(confirm|submit|send|save|back|return|continue|view|start|enter|create|release|lock|publish|export|mark|activate|disable|void|close|record|supplement|correction)/i.test(text) &&
    !/(Method|Status|Type|Reason|Date|Time|Amount|Name|Remark|Notes|Option|Scope|Owner|Channel|Preference)$/i.test(text)) {
    return true;
  }
  return false;
}

function camelFromKebab(value) {
  return String(value)
    .split("-")
    .filter(Boolean)
    .map((part, index) => index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("");
}

function pascalToCamel(value) {
  return value ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}

function kebabToUpper(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
}

function stableValue(value) {
  const raw = String(value || "").trim();
  const ascii = raw
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (ascii) return ascii;
  return `v-${crypto.createHash("sha1").update(raw).digest("hex").slice(0, 10)}`;
}

function commandSuffix(commandId = "") {
  const suffix = String(commandId || "").split(".").filter(Boolean).pop() || "field";
  return suffix.charAt(0).toLowerCase() + suffix.slice(1);
}

function hasCjk(value = "") {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function writeJson(file, value) {
  const full = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileDigest(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function digestObject(value) {
  const normalized = stableStringify(replaceOutputDigest(value));
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function replaceOutputDigest(value) {
  if (Array.isArray(value)) return value.map(replaceOutputDigest);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, key === "outputContentDigest" ? "sha256:pending" : replaceOutputDigest(child)]));
  }
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
