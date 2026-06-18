import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputRoot = process.env.WORKOS_DORMITORY_SCENARIO2_OUTPUT_ROOT || root;
const scenarioSourcePath = "docs/business/domains/dormitory/dormitory-scenario2-resource-operation-status.authority.json";
const packageIndexPath = "docs/business/domains/dormitory/lodging-scenario-package-index.authority.json";
const generatedBy = "scripts/business/generate-dormitory-scenario2-resource-operation-status-contracts.mjs";
const generatorVersion = "oam.dormitory-scenario2-resource-operation-status-generator.v1";
const outputPaths = {
  canonical: "docs/contracts/generated/dormitory/scenario2-resource-operation-status.generated.json",
  objectStateModel: "docs/contracts/generated/dormitory/scenario2-object-state-model.generated.json",
  stepsFields: "docs/contracts/generated/dormitory/scenario2-steps-fields.generated.json",
  crudPolicy: "docs/contracts/generated/dormitory/scenario2-crud-policy.generated.json",
  runtimeRules: "docs/contracts/generated/dormitory/scenario2-runtime-rules.generated.json",
  surfaceNavigation: "docs/contracts/generated/dormitory/scenario2-surface-navigation.generated.json",
  handoff: "docs/contracts/generated/dormitory/scenario2-handoff.generated.json",
  testPlan: "docs/contracts/generated/dormitory/scenario2-test-plan.generated.json",
  mobileMirror: "apps/mobile/src/generated/oam/dormitory-scenario2-resource-operation-status.generated.json",
  runtimeMirror: "services/core-api/WorkOS.Api/Runtime/DormitoryScenario2ResourceOperationStatus.generated.json"
};

const scenario = readJson(scenarioSourcePath);
const packageIndex = readJson(packageIndexPath);
const scenarioDigest = fileDigest(scenarioSourcePath);
const packageIndexDigest = fileDigest(packageIndexPath);
const generatedFrom = [scenarioSourcePath, packageIndexPath];
const inputDigests = [
  { path: scenarioSourcePath, digest: scenarioDigest },
  { path: packageIndexPath, digest: packageIndexDigest }
];
const inputDigest = digestObject({
  version: "oam.dormitory-scenario2-input.v1",
  inputDigests
});

const packageOrder = packageIndex.scenarioPackageOrder ?? [];
const scenario2IndexRow = packageOrder.find((item) => item.packageNo === 2);

const commonBoundary = {
  authorityId: scenario.authorityId,
  scenarioPackageNo: scenario.scenarioPackageNo,
  scenarioId: scenario.scenarioId,
  nameZh: scenario.nameZh,
  businessGoalZh: scenario.businessGoalZh,
  sourceScenarioDigest: scenarioDigest,
  packageIndexDigest,
  experienceContract: scenario.experienceContract ?? null
};

const runtimeExecution = buildRuntimeExecution();

const generated = {
  canonical: {
    ...commonBoundary,
    packageIndexRow: scenario2IndexRow,
    highestAuthorityRef: scenario.highestAuthorityRef,
    methodBenchmarkRef: scenario.methodBenchmarkRef,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    businessBoundaries: scenario.businessBoundaries,
    objects: scenario.objects.map((object) => object.objectName),
    operationStatusOptions: scenario.operationStatusOptions,
    commands: scenario.commands.map((command) => ({
      commandId: command.commandId,
      businessNameZh: command.businessNameZh,
      writesObjects: command.writesObjects
    })),
    readSideOutputs: scenario.readSideOutputs,
    noGo: scenario.NO_GO,
    oldProjectExpressionIsolation: packageIndex.oldProjectExpressionIsolation
  },
  objectStateModel: {
    ...commonBoundary,
    objects: scenario.objects,
    operationStatusOptions: scenario.operationStatusOptions,
    statusOwnership: scenario.statusOwnership,
    invariants: scenario.invariants,
    scopeImpactRules: scenario.scopeImpactRules
  },
  stepsFields: {
    ...commonBoundary,
    steps: scenario.steps,
    fields: scenario.fields,
    operationStatusOptions: scenario.operationStatusOptions
  },
  crudPolicy: {
    ...commonBoundary,
    crudRules: scenario.crudRules,
    requiredLifecyclePerObject: scenario.crudRules.requiredLifecyclePerObject
  },
  runtimeRules: {
    ...commonBoundary,
    commands: scenario.commands,
    failureSemantics: scenario.failureSemantics,
    invariants: scenario.invariants,
    operationStatusOptions: scenario.operationStatusOptions,
    scopeImpactRules: scenario.scopeImpactRules,
    evidence: scenario.evidence,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary
  },
  surfaceNavigation: {
    ...commonBoundary,
    surfaceNavigation: scenario.surfaceNavigation,
    userReadableNamesOnlyZh: scenario.fields.userReadableNamesOnlyZh,
    forbiddenUserInputFields: scenario.fields.forbiddenUserInputFields,
    buttonByState: scenario.surfaceNavigation.buttonByState,
    operationStatusOptions: scenario.operationStatusOptions
  },
  handoff: {
    ...commonBoundary,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    readSideOutputs: scenario.readSideOutputs,
    downstreamNoRefillRuleZh: scenario.downstream.downstreamNoRefillRuleZh
  },
  testPlan: {
    ...commonBoundary,
    positiveBrowserTestPlan: scenario.positiveBrowserTestPlan,
    negativeBrowserTestPlan: scenario.negativeBrowserTestPlan,
    evidence: scenario.evidence,
    screenshotAnalysisRequired: true,
    noSideEffectsProofRequired: true
  },
  mobileMirror: {
    ...commonBoundary,
    consumer: "surface",
    surfaceNavigation: scenario.surfaceNavigation,
    steps: scenario.steps.map((step) => ({
      stepNo: step.stepNo,
      stepId: step.stepId,
      nameZh: step.nameZh,
      commandId: step.commandId,
      commandBusinessNameZh: step.commandBusinessNameZh,
      userSees: step.userSees,
      userFilledFields: step.userFilledFields,
      userSelectedFields: step.userSelectedFields,
      userUploadedOrBoundEvidence: step.userUploadedOrBoundEvidence,
      systemGeneratedFields: step.systemGeneratedFields,
      validations: step.validations,
      outputs: step.outputs,
      primaryBusinessObject: step.primaryBusinessObject,
      requiredReadContext: step.requiredReadContext,
      editableInputs: step.editableInputs,
      fixedSelections: step.fixedSelections,
      financialContext: step.financialContext,
      legalActions: step.legalActions,
      handoffSummary: step.handoffSummary,
      searchReadModel: step.searchReadModel,
      conclusionOptions: step.conclusionOptions
    })),
    fields: scenario.fields,
    operationStatusOptions: scenario.operationStatusOptions,
    readSideOutputs: scenario.readSideOutputs,
    forbiddenUserVisibleTermsZh: scenario.surfaceNavigation.forbiddenUserVisibleTermsZh,
    noGo: scenario.NO_GO
  },
  runtimeMirror: {
    ...commonBoundary,
    consumer: "runtime",
    objects: scenario.objects,
    commands: scenario.commands,
    failureSemantics: scenario.failureSemantics,
    invariants: scenario.invariants,
    operationStatusOptions: scenario.operationStatusOptions,
    scopeImpactRules: scenario.scopeImpactRules,
    fields: scenario.fields,
    runtimeExecution,
    runtimeConsumptionBoundary: scenario.runtimeConsumptionBoundary,
    upstream: scenario.upstream,
    downstream: scenario.downstream,
    noGo: scenario.NO_GO
  }
};

for (const [key, content] of Object.entries(generated)) {
  writeGenerated(outputPaths[key], key, content);
}
patchDefinitionRegistry(runtimeExecution);

console.log("Dormitory scenario 2 resource operation status contracts generated.");
for (const file of Object.values(outputPaths)) console.log(file);
console.log("docs/contracts/definition/workitem-definition-registry.json");

function buildRuntimeExecution() {
  const workspaceId = "W-DORM-RESOURCE-OPERATION-STATUS";
  const sliceId = "Dormitory.Scenario2.ResourceOperationStatus";
  const steps = (scenario.steps ?? []).map((step, index) => runtimeStep(step, index));
  const startAdapterDefinitionIds = Object.fromEntries(
    steps.map((step) => [`${workspaceId}:${step.cardId}`, step.definitionId])
  );
  const transitions = steps.slice(0, -1).map((step, index) => {
    const next = steps[index + 1];
    return {
      policyId: `generated-transition.dormitory.scenario2.${step.stepId}-to-${next.stepId}.v1`,
      fromDefinitionId: step.definitionId,
      toDefinitionId: next.definitionId,
      sourceContract: outputPaths.runtimeMirror,
      condition: transitionConditionFor(step, next)
    };
  });

  return {
    workspaceId,
    sliceId,
    taskId: "T-DORM-SCENARIO2-OPERATION-STATUS",
    title: copy("scenario2.workspace.title"),
    summary: copy("scenario2.workspace.summary"),
    next: copy("scenario2.workspace.next"),
    status: "runtime-test-admitted",
    generatedExecutionMode: "scenario-source-authority-to-runtime-projection",
    startAdapterDefinitionIds,
    searchCommands: [
      {
        templateWorkspaceId: workspaceId,
        firstCardId: steps[0]?.cardId ?? "",
        title: copy("scenario2.search.title"),
        subtitle: copy("scenario2.search.subtitle"),
        nextAction: copy("scenario2.search.nextAction"),
        keywords: [
          "房源运营",
          "运营状态",
          "设置房间营业状态",
          "房源运营就绪与状态维护",
          "开始运营检查",
          "恢复运营",
          "operation status",
          "room operation status",
          "статус комнаты",
          "эксплуатация комнаты",
          "иштетүү абалы"
        ]
      }
    ],
    optionSets: localizedOptionSets(),
    steps,
    transitions,
    definitions: steps.map((step) => definitionForRuntimeStep(workspaceId, step))
  };
}

function transitionConditionFor(step, next) {
  const guard = (scenario.transitionGuards ?? []).find((item) =>
    item.fromStepId === step.stepId && item.toStepId === next.stepId);
  return guard
    ? {
      conditionId: guard.conditionId,
      fieldId: guard.fieldId,
      operator: guard.operator,
      values: guard.values ?? [],
      whenNotMet: guard.whenNotMet,
      sourceAuthorityRuleZh: guard.sourceAuthorityRuleZh
    }
    : null;
}

function runtimeStep(step, index) {
  const cardId = `cert.${camelFromKebab(step.stepId)}`;
  const workItemType = step.commandId;
  const definitionSuffix = pascalToCamel(workItemType.split(".").pop() ?? step.stepId);
  const definitionId = `definition.dormitory.${definitionSuffix}.v1`;
  const commandType = commandTypeFor(workItemType);
  const fieldIds = [
    ...(step.userSelectedFields ?? []),
    ...(step.userFilledFields ?? [])
  ];
  return {
    stepNo: step.stepNo,
    stepId: step.stepId,
    cardId,
    status: index === 0 ? "ready" : "notStarted",
    workItemType,
    definitionId,
    commandType,
    eventType: `${workItemType}.confirmed`,
    title: copy(`scenario2.step.${step.stepId}.title`, step.nameZh),
    confirmationLabel: copy(`scenario2.step.${step.stepId}.confirm`, `提交${step.nameZh}`),
    fields: fieldIds.map((fieldId) => runtimeField(fieldId, step.stepId)),
    evidence: (step.userUploadedOrBoundEvidence ?? []).map(runtimeEvidence),
    evidenceIds: (step.userUploadedOrBoundEvidence ?? []).map((label) => evidenceIdFor(label)),
    projectionTargets: projectionTargetsFor(step),
    sourceStep: {
      nameZh: step.nameZh,
      commandBusinessNameZh: step.commandBusinessNameZh,
      userSees: step.userSees,
      outputs: step.outputs,
      primaryBusinessObject: step.primaryBusinessObject,
      requiredReadContext: step.requiredReadContext,
      editableInputs: step.editableInputs,
      fixedSelections: step.fixedSelections,
      financialContext: step.financialContext,
      legalActions: step.legalActions,
      handoffSummary: step.handoffSummary,
      searchReadModel: step.searchReadModel,
      validations: step.validations
    }
  };
}

function runtimeField(fieldId, stepId) {
  const spec = fieldSpec(fieldId, stepId);
  return {
    fieldId,
    label: copy(`scenario2.field.${fieldId}.label`, spec.zh ?? fieldId),
    layer: "business",
    type: spec.type,
    required: requiredFieldIdsFor(stepId).has(fieldId),
    source: spec.source,
    userSubmitted: true,
    visibleToUser: true,
    ui: {
      control: spec.control,
      optionSet: spec.optionSet ?? "",
      options: spec.optionSet ? optionSetEntries(spec.optionSet) : [],
      defaultValue: spec.defaultValue ?? "",
      derivedFrom: "",
      readonly: false
    },
    help: copy(`scenario2.field.${fieldId}.help`, spec.helpZh ?? "按页面提示填写。")
  };
}

function fieldSpec(fieldId, stepId) {
  const base = {
    roomOrBedScope: { zh: "维护范围", control: "select", optionSet: "resourceScope", type: "text", source: "clientSubmitted", helpZh: "选择本次维护房间还是床位。" },
    targetRoomOrBed: { zh: "已基础就绪房源", control: "select", optionSet: "baseReadyResource", type: "text", source: "selectedBusinessObject", helpZh: "只能选择已完成基础检查的房间或床位组。" },
    cleaningInspectionResult: { zh: "保洁检查结果", control: "select", optionSet: "inspectionResult", type: "text", source: "clientSubmitted" },
    maintenanceInspectionResult: { zh: "维修检查结果", control: "select", optionSet: "inspectionResult", type: "text", source: "clientSubmitted" },
    safetyInspectionResult: { zh: "安全检查结果", control: "select", optionSet: "inspectionResult", type: "text", source: "clientSubmitted" },
    facilityInspectionResult: { zh: "设施检查结果", control: "select", optionSet: "inspectionResult", type: "text", source: "clientSubmitted" },
    exceptionFlag: { zh: "是否有异常", control: "select", optionSet: "yesNo", type: "text", source: "clientSubmitted" },
    inspectionConclusion: { zh: "检查结论", control: "select", optionSet: "inspectionConclusion", type: "text", source: "clientSubmitted" },
    exceptionDescription: { zh: "异常说明", control: "textarea", type: "text", source: "clientSubmitted" },
    operationInspectionNotes: { zh: "检查备注", control: "textarea", type: "text", source: "clientSubmitted" },
    newOperationStatus: { zh: "新的营业状态", control: "select", optionSet: "operationStatus", type: "text", source: "clientSubmitted" },
    statusReasonCode: { zh: "状态原因", control: "select", optionSet: "statusReasonCode", type: "text", source: "clientSubmitted" },
    statusReason: { zh: "原因说明", control: "textarea", type: "text", source: "clientSubmitted" },
    impactScope: { zh: "影响范围", control: "select", optionSet: "impactScope", type: "text", source: "clientSubmitted" },
    expectedRestoreAt: { zh: "预计恢复时间", control: "dateTime", type: "text", source: "clientSubmitted" },
    statusOwner: { zh: "跟进负责人", control: "select", optionSet: "ownerRole", type: "text", source: "clientSubmitted" },
    operationStatusNotes: { zh: "营业状态备注", control: "textarea", type: "text", source: "clientSubmitted" },
    submitImpactConfirmation: { zh: "确认影响", control: "select", optionSet: "submitDecision", type: "text", source: "clientSubmitted" },
    impactConfirmationNotes: { zh: "影响确认说明", control: "textarea", type: "text", source: "clientSubmitted" },
    blockerStatus: { zh: "阻断处理状态", control: "select", optionSet: "blockerStatus", type: "text", source: "clientSubmitted" },
    progressUpdate: { zh: "处理进展", control: "textarea", type: "text", source: "clientSubmitted" },
    followUpOwner: { zh: "跟进负责人", control: "select", optionSet: "ownerRole", type: "text", source: "clientSubmitted" },
    blockerNotes: { zh: "阻断备注", control: "textarea", type: "text", source: "clientSubmitted" },
    restoreConclusion: { zh: "恢复结论", control: "select", optionSet: "restoreConclusion", type: "text", source: "clientSubmitted" },
    restoreReason: { zh: "恢复原因", control: "textarea", type: "text", source: "clientSubmitted" },
    recheckResult: { zh: "复查结果", control: "select", optionSet: "recheckResult", type: "text", source: "clientSubmitted" },
    restoreNotes: { zh: "恢复备注", control: "textarea", type: "text", source: "clientSubmitted" }
  };
  return base[fieldId] ?? { zh: fieldId, control: "text", type: "text", source: "clientSubmitted", helpZh: `${stepId} 字段` };
}

function requiredFieldIdsFor(stepId) {
  return new Set({
    "select-base-ready-resource": ["roomOrBedScope", "targetRoomOrBed"],
    "operation-inspection": ["cleaningInspectionResult", "maintenanceInspectionResult", "safetyInspectionResult", "facilityInspectionResult", "exceptionFlag", "inspectionConclusion"],
    "set-operation-status": ["newOperationStatus", "statusReasonCode", "statusReason", "impactScope", "statusOwner"],
    "impact-confirmation": ["submitImpactConfirmation"],
    "daily-status-maintenance": ["blockerStatus", "progressUpdate", "followUpOwner"],
    "restore-operation": ["restoreConclusion", "restoreReason", "recheckResult"]
  }[stepId] ?? []);
}

function localizedOptionSets() {
  return {
    resourceScope: [
      option("room", "房间", "Комната", "Бөлмө"),
      option("bed", "床位", "Койка", "Койка")
    ],
    baseReadyResource: [],
    inspectionResult: [
      option("passed", "通过", "Пройдено", "Өттү"),
      option("needs_follow_up", "需要跟进", "Нужно доработать", "Көзөмөл керек"),
      option("failed", "不通过", "Не пройдено", "Өткөн жок")
    ],
    yesNo: [
      option("no", "否", "Нет", "Жок"),
      option("yes", "是", "Да", "Ооба")
    ],
    inspectionConclusion: [
      option("can_set_status", "可以设置营业状态", "Можно задать статус", "Абалды коюуга болот"),
      option("needs_supplement", "需补充后再设置", "Нужно дополнить перед статусом", "Абалды коюудан мурда толуктоо керек")
    ],
    operationStatus: [
      option("operable", "可运营", "Можно использовать", "Иштетүүгө болот"),
      option("temporarily_unavailable", "暂不可运营", "Временно недоступно", "Убактылуу мүмкүн эмес"),
      option("partially_operable", "部分不可运营", "Частично доступно", "Жарым-жартылай мүмкүн"),
      option("paused", "暂停开放", "Приостановлено", "Убактылуу жабык"),
      option("maintenance", "维修中", "На ремонте", "Оңдоодо"),
      option("cleaning", "保洁中", "На уборке", "Тазалоодо"),
      option("stopped", "停售", "Снято с продажи", "Сатуу токтоду"),
      option("exception_pending", "异常待处理", "Ожидает обработки", "Каралууда"),
      option("needs_recheck", "待复查", "Нужна повторная проверка", "Кайра текшерүү керек"),
      option("restored", "已恢复", "Восстановлено", "Калыбына келди")
    ],
    statusReasonCode: [
      option("normal_ready", "检查通过", "Проверка пройдена", "Текшерүү өттү"),
      option("repair_required", "需要维修", "Нужен ремонт", "Оңдоо керек"),
      option("cleaning_required", "需要保洁", "Нужна уборка", "Тазалоо керек"),
      option("safety_issue", "安全问题", "Вопрос безопасности", "Коопсуздук маселеси")
    ],
    impactScope: [
      option("current_room", "仅当前房间", "Только эта комната", "Ушул бөлмө гана"),
      option("selected_beds", "选定床位", "Выбранные койки", "Тандалган койкалар"),
      option("whole_floor_notice", "同楼层需关注", "Проверить этаж", "Кабатты көзөмөлдөө")
    ],
    ownerRole: [
      option("dormOperator", "住宿经办人", "Оператор проживания", "Жатакана оператору"),
      option("dormHousekeeping", "客房/保洁", "Хозяйственная служба", "Тазалык кызматы"),
      option("dormManager", "住宿主管", "Руководитель проживания", "Жатакана жетекчиси")
    ],
    submitDecision: [
      option("confirm", "确认并提交", "Подтвердить и отправить", "Ырастап тапшыруу"),
      option("return_to_edit", "返回修改", "Вернуться к правке", "Оңдоого кайтуу")
    ],
    blockerStatus: [
      option("open", "处理中", "В работе", "Иштелүүдө"),
      option("closed", "已关闭", "Закрыто", "Жабылды"),
      option("needs_recheck", "待复查", "Нужна повторная проверка", "Кайра текшерүү керек")
    ],
    restoreConclusion: [
      option("operable", "恢复为可运营", "Восстановить как доступную", "Иштетүүгө калыбына келтирүү"),
      option("partially_operable", "恢复为部分可运营", "Восстановить частично", "Жарым-жартылай калыбына келтирүү"),
      option("needs_recheck", "仍需复查", "Нужна повторная проверка", "Кайра текшерүү керек")
    ],
    recheckResult: [
      option("passed", "复查通过", "Повторная проверка пройдена", "Кайра текшерүү өттү"),
      option("failed", "复查不通过", "Повторная проверка не пройдена", "Кайра текшерүү өткөн жок")
    ]
  };
}

function optionSetEntries(optionSet) {
  return localizedOptionSets()[optionSet] ?? [];
}

function option(value, zh, ru, ky) {
  return { value, label: { "zh-CN": zh, "ru-RU": ru, "ky-KG": ky } };
}

function runtimeEvidence(labelZh) {
  return {
    evidenceId: evidenceIdFor(labelZh),
    label: copy(`scenario2.evidence.${evidenceIdFor(labelZh)}.label`, labelZh),
    required: true,
    source: "scenario2-source-authority",
    auditEventField: evidenceIdFor(labelZh),
    help: copy("scenario2.evidence.help")
  };
}

function evidenceIdFor(labelZh) {
  const table = {
    "运营检查照片": "operation-inspection-photo",
    "维修记录": "maintenance-record",
    "安全检查记录": "safety-inspection-record",
    "设施检查记录": "facility-inspection-record",
    "状态原因证据": "status-reason-proof",
    "阻断原因证据": "blocker-reason-proof",
    "补充影响证据": "impact-proof",
    "进度照片": "progress-photo",
    "维修进度记录": "maintenance-progress-record",
    "补充证据": "supplement-proof",
    "恢复照片": "restore-photo",
    "复查记录": "recheck-record",
    "关闭阻断证据": "blocker-close-proof"
  };
  return table[labelZh] ?? `scenario2-${String(labelZh).replace(/\s+/g, "-")}`;
}

function projectionTargetsFor(step) {
  const byCommand = {
    "Dorm.OperationResourceSelect": ["OperationDraft"],
    "Dorm.OperationInspectionConfirm": ["OperationInspection", "OperationEvidence", "StatusHistory"],
    "Dorm.OperationStatusDraft": ["OperationStatusDraft", "OperationBlockerDraft"],
    "Dorm.OperationStatusChangeConfirm": ["RoomOperationStatus", "BedOperationStatus", "OperationBlocker", "StatusHistory"],
    "Dorm.OperationBlockerUpdate": ["OperationBlocker", "OperationEvidence", "StatusHistory"],
    "Dorm.OperationRestoreConfirm": ["OperationRestore", "RoomOperationStatus", "BedOperationStatus", "StatusHistory"]
  };
  return byCommand[step.commandId] ?? ["CommandSubmission", "DomainEvent"];
}

function definitionForRuntimeStep(workspaceId, step) {
  return {
    definitionId: step.definitionId,
    businessLineId: "dormitory",
    sliceId: "Accommodation.ResourceOperationStatus",
    workspaceId,
    workItemType: step.workItemType,
    commandType: step.commandType,
    ownerSlice: "Accommodation.ResourceOperationStatus",
    migrationRefs: migrationRefsFor(step.cardId),
    allowedFacts: allowedFactsForStep(step),
    forbiddenFacts: forbiddenScenario2Facts(),
    fieldContractRef: `field.dormitory.scenario2.${pascalToCamel(step.workItemType.split(".").pop() ?? step.stepId)}.v1`,
    evidencePolicyRef: `evidence.dormitory.scenario2.${step.stepId}.v1`,
    riskPolicyRef: "risk.dormitory.standard.v1",
    ledgerPolicyRef: "ledger.none.v1",
    admissionPolicyRef: "dormitory_l1_internal_pilot_observation",
    surfacePolicyRef: `surface.mobile.work.dormitory-scenario2-${step.stepId}`,
    productionConfirmAllowed: false,
    definitionMode: "oam-certification-current",
    removalImpact: "Generated from Dormitory Scenario 2 Source Authority; no production confirm."
  };
}

function allowedFactsForStep(step) {
  const command = (scenario.commands ?? []).find((item) => item.commandId === step.workItemType);
  const writes = command?.writesObjects ?? projectionTargetsFor(step);
  return [...new Set([...writes, "EvidenceObject", "DomainEvent", "CommandSubmission"])];
}

function forbiddenScenario2Facts() {
  return [
    "RatePlan",
    "Quote",
    "Reservation",
    "Stay",
    "Payment",
    "Deposit",
    "DepositAccount",
    "Refund",
    "LedgerEntry",
    "LedgerTransaction",
    "PaymentAllocation",
    "AmountBasis",
    "MoneyBasis",
    "FinancialFact",
    "FinanceReceipt",
    "DepositEntry"
  ];
}

function patchDefinitionRegistry(execution) {
  const registryPath = "docs/contracts/definition/workitem-definition-registry.json";
  const registry = readJson(registryPath);
  const scenarioDefinitionIds = new Set(execution.definitions.map((item) => item.definitionId));
  const definitions = [
    ...(registry.definitions ?? []).filter((item) => !scenarioDefinitionIds.has(item.definitionId)),
    ...execution.definitions
  ].sort((left, right) => left.definitionId.localeCompare(right.definitionId));
  writeJson(registryPath, {
    ...registry,
    generatedBy,
    scenario2RuntimeExecutionRef: outputPaths.runtimeMirror,
    definitions
  });
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

function commandTypeFor(workItemType) {
  const suffix = workItemType.split(".").pop() ?? workItemType;
  return suffix
    .replace("OperationResourceSelect", "OperationResource.Select")
    .replace("OperationInspectionConfirm", "OperationInspection.Confirm")
    .replace("OperationStatusDraft", "OperationStatus.Draft")
    .replace("OperationStatusChangeConfirm", "OperationStatusChange.Confirm")
    .replace("OperationBlockerUpdate", "OperationBlocker.Update")
    .replace("OperationRestoreConfirm", "OperationRestore.Confirm");
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

function copy(copyId, zhFallback = "") {
  const table = localizedCopies();
  return table[copyId] ?? {
    "zh-CN": zhFallback,
    "ru-RU": zhFallback,
    "ky-KG": zhFallback
  };
}

function localizedCopies() {
  return {
    "scenario2.workspace.title": {
      "zh-CN": "设置房间营业状态",
      "ru-RU": "Статус эксплуатации комнат",
      "ky-KG": "Бөлмө иштетүү абалы"
    },
    "scenario2.workspace.summary": {
      "zh-CN": "选择已完成基础检查的房间或床位，完成运营检查、状态设置、阻断维护和恢复确认。",
      "ru-RU": "Выберите комнату или койку с базовой готовностью, затем проверьте, задайте статус, ведите блокировки и восстановление.",
      "ky-KG": "Негизги текшерүүсү бүткөн бөлмө же койканы тандап, абалын, бөгөтүн жана калыбына келтирүүнү жүргүзүңүз."
    },
    "scenario2.workspace.next": {
      "zh-CN": "先选择已基础就绪房源，再完成运营检查和营业状态确认。",
      "ru-RU": "Сначала выберите готовый ресурс, затем выполните проверку и подтвердите статус.",
      "ky-KG": "Алгач даяр ресурс тандаңыз, анан текшерип абалын ырастаңыз."
    },
    "scenario2.search.title": {
      "zh-CN": "设置房间营业状态",
      "ru-RU": "Настроить статус комнаты",
      "ky-KG": "Бөлмө абалын коюу"
    },
    "scenario2.search.subtitle": {
      "zh-CN": "对已完成基础检查的房间或床位做运营检查、暂停、停售、恢复等处理；不设置价格或预订。",
      "ru-RU": "Проверьте готовые комнаты или койки, приостановите, снимите с продажи или восстановите; цены и бронь не меняются.",
      "ky-KG": "Даяр бөлмө же койканы текшерип, токтотуп же калыбына келтириңиз; баа жана бронь өзгөрбөйт."
    },
    "scenario2.search.nextAction": {
      "zh-CN": "开始设置营业状态",
      "ru-RU": "Начать настройку статуса",
      "ky-KG": "Абал коюуну баштоо"
    },
    "scenario2.evidence.help": {
      "zh-CN": "材料会随本次提交绑定到办理记录。",
      "ru-RU": "Материалы будут привязаны к этой записи.",
      "ky-KG": "Материалдар ушул иш жазуусуна байланат."
    },
    ...evidenceCopies(),
    ...Object.fromEntries((scenario.steps ?? []).flatMap((step) => [
      [`scenario2.step.${step.stepId}.title`, stepCopy(step.stepId, step.nameZh)],
      [`scenario2.step.${step.stepId}.confirm`, confirmCopy(step.stepId, step.nameZh)]
    ])),
    ...fieldCopies()
  };
}

function evidenceCopies() {
  const pairs = {
    "operation-inspection-photo": ["运营检查照片", "Фото операционной проверки", "Иштетүү текшерүүсүнүн сүрөтү"],
    "maintenance-record": ["维修记录", "Запись ремонта", "Оңдоо жазуусу"],
    "safety-inspection-record": ["安全检查记录", "Запись проверки безопасности", "Коопсуздук текшерүү жазуусу"],
    "facility-inspection-record": ["设施检查记录", "Запись проверки оснащения", "Жабдык текшерүү жазуусу"],
    "status-reason-proof": ["状态原因证据", "Подтверждение причины статуса", "Абал себебинин далили"],
    "blocker-reason-proof": ["阻断原因证据", "Подтверждение причины блокировки", "Бөгөт себебинин далили"],
    "impact-proof": ["补充影响证据", "Дополнительное подтверждение влияния", "Таасир боюнча кошумча далил"],
    "progress-photo": ["进度照片", "Фото хода работ", "Иш жүрүшүнүн сүрөтү"],
    "maintenance-progress-record": ["维修进度记录", "Запись хода ремонта", "Оңдоо жүрүшүнүн жазуусу"],
    "supplement-proof": ["补充证据", "Дополнительный материал", "Кошумча далил"],
    "restore-photo": ["恢复照片", "Фото восстановления", "Калыбына келтирүү сүрөтү"],
    "recheck-record": ["复查记录", "Запись повторной проверки", "Кайра текшерүү жазуусу"],
    "blocker-close-proof": ["关闭阻断证据", "Подтверждение закрытия блокировки", "Бөгөт жабылганын далилдөө"]
  };
  return Object.fromEntries(Object.entries(pairs).map(([evidenceId, labels]) => [
    `scenario2.evidence.${evidenceId}.label`,
    { "zh-CN": labels[0], "ru-RU": labels[1], "ky-KG": labels[2] }
  ]));
}

function stepCopy(stepId, zh) {
  const table = {
    "select-base-ready-resource": ["选择已基础就绪房源", "Выбрать готовую комнату или койку", "Даяр бөлмө же койка тандоо"],
    "operation-inspection": ["运营检查", "Операционная проверка", "Иштетүү текшерүүсү"],
    "set-operation-status": ["设置营业状态", "Задать статус эксплуатации", "Иштетүү абалын коюу"],
    "impact-confirmation": ["影响确认", "Подтверждение влияния", "Таасирин ырастоо"],
    "daily-status-maintenance": ["日常状态维护", "Ежедневное ведение статуса", "Күнүмдүк абалды жүргүзүү"],
    "restore-operation": ["恢复运营", "Восстановить эксплуатацию", "Иштетүүнү калыбына келтирүү"]
  }[stepId] ?? [zh, zh, zh];
  return { "zh-CN": table[0], "ru-RU": table[1], "ky-KG": table[2] };
}

function confirmCopy(stepId, zh) {
  const title = stepCopy(stepId, zh);
  return {
    "zh-CN": `提交${title["zh-CN"]}`,
    "ru-RU": `Отправить: ${title["ru-RU"]}`,
    "ky-KG": `Тапшыруу: ${title["ky-KG"]}`
  };
}

function fieldCopies() {
  const pairs = {
    roomOrBedScope: ["维护范围", "Область", "Чөйрө"],
    targetRoomOrBed: ["已基础就绪房源", "Готовая комната или койка", "Даяр бөлмө же койка"],
    cleaningInspectionResult: ["保洁检查结果", "Проверка уборки", "Тазалык текшерүүсү"],
    maintenanceInspectionResult: ["维修检查结果", "Проверка ремонта", "Оңдоо текшерүүсү"],
    safetyInspectionResult: ["安全检查结果", "Проверка безопасности", "Коопсуздук текшерүүсү"],
    facilityInspectionResult: ["设施检查结果", "Проверка оснащения", "Жабдык текшерүүсү"],
    exceptionFlag: ["是否有异常", "Есть отклонение", "Маселе барбы"],
    inspectionConclusion: ["检查结论", "Итог проверки", "Текшерүү жыйынтыгы"],
    exceptionDescription: ["异常说明", "Описание отклонения", "Маселе сүрөттөмөсү"],
    operationInspectionNotes: ["检查备注", "Комментарий проверки", "Текшерүү эскертүүсү"],
    newOperationStatus: ["新的营业状态", "Новый статус", "Жаңы абал"],
    statusReasonCode: ["状态原因", "Причина статуса", "Абал себеби"],
    statusReason: ["原因说明", "Описание причины", "Себеп түшүндүрмөсү"],
    impactScope: ["影响范围", "Область влияния", "Таасир чөйрөсү"],
    expectedRestoreAt: ["预计恢复时间", "Ожидаемое восстановление", "Калыбына келүү убактысы"],
    statusOwner: ["跟进负责人", "Ответственный", "Жооптуу"],
    operationStatusNotes: ["营业状态备注", "Комментарий к статусу", "Абал эскертүүсү"],
    submitImpactConfirmation: ["确认影响", "Подтвердить влияние", "Таасирин ырастоо"],
    impactConfirmationNotes: ["影响确认说明", "Комментарий влияния", "Таасир түшүндүрмөсү"],
    blockerStatus: ["阻断处理状态", "Статус блокировки", "Бөгөт абалы"],
    progressUpdate: ["处理进展", "Ход работ", "Иш жүрүшү"],
    followUpOwner: ["跟进负责人", "Ответственный", "Жооптуу"],
    blockerNotes: ["阻断备注", "Комментарий блокировки", "Бөгөт эскертүүсү"],
    restoreConclusion: ["恢复结论", "Итог восстановления", "Калыбына келтирүү жыйынтыгы"],
    restoreReason: ["恢复原因", "Причина восстановления", "Калыбына келтирүү себеби"],
    recheckResult: ["复查结果", "Результат повторной проверки", "Кайра текшерүү жыйынтыгы"],
    restoreNotes: ["恢复备注", "Комментарий восстановления", "Калыбына келтирүү эскертүүсү"]
  };
  return Object.fromEntries(Object.entries(pairs).flatMap(([fieldId, labels]) => [
    [`scenario2.field.${fieldId}.label`, { "zh-CN": labels[0], "ru-RU": labels[1], "ky-KG": labels[2] }],
    [`scenario2.field.${fieldId}.help`, fieldHelpCopy(fieldId)]
  ]));
}

function fieldHelpCopy(fieldId) {
  const table = {
    roomOrBedScope: ["选择本次维护房间还是床位。", "Выберите, что обслуживаете: комнату или койку.", "Бул жолу бөлмөбү же койкабы тандаңыз."],
    targetRoomOrBed: ["只能选择已完成基础检查的房间或床位。", "Можно выбрать только ресурс с завершенной базовой проверкой.", "Негизги текшерүүсү бүткөн бөлмө же койка гана тандалат."],
    cleaningInspectionResult: ["选择保洁是否通过。", "Выберите результат проверки уборки.", "Тазалык текшерүүсүнүн жыйынтыгын тандаңыз."],
    maintenanceInspectionResult: ["选择维修是否通过。", "Выберите результат проверки ремонта.", "Оңдоо текшерүүсүнүн жыйынтыгын тандаңыз."],
    safetyInspectionResult: ["选择安全检查是否通过。", "Выберите результат проверки безопасности.", "Коопсуздук текшерүүсүнүн жыйынтыгын тандаңыз."],
    facilityInspectionResult: ["选择设施检查是否通过。", "Выберите результат проверки оснащения.", "Жабдык текшерүүсүнүн жыйынтыгын тандаңыз."],
    exceptionFlag: ["有异常时，后面需要补充说明和材料。", "Если есть отклонение, добавьте описание и материалы.", "Маселе болсо, түшүндүрмө жана материал кошуңуз."],
    inspectionConclusion: ["确认是否可以进入营业状态设置。", "Подтвердите, можно ли перейти к статусу эксплуатации.", "Иштетүү абалын коюуга өтсө болобу ырастоо."],
    exceptionDescription: ["仅在有异常时填写，说明需要跟进的点。", "Заполняется только при отклонении: что нужно доработать.", "Маселе болгондо гана толтуруңуз."],
    operationInspectionNotes: ["可补充检查备注；没有可留空。", "Дополнительный комментарий к проверке, можно оставить пустым.", "Кошумча эскертүү, жок болсо бош калат."],
    newOperationStatus: ["选择这次要设置的营业状态。", "Выберите новый статус эксплуатации.", "Бул жолу коюла турган иштетүү абалын тандаңыз."],
    statusReasonCode: ["选择最主要的状态原因。", "Выберите основную причину статуса.", "Абалдын негизги себебин тандаңыз."],
    statusReason: ["补充一句原因说明，便于后续复核。", "Кратко поясните причину для последующей проверки.", "Кийин текшерүү үчүн кыскача себеп жазыңыз."],
    impactScope: ["选择本次状态影响的范围。", "Выберите область влияния этого статуса.", "Бул абалдын таасир чөйрөсүн тандаңыз."],
    expectedRestoreAt: ["只有暂停、维修、保洁或待复查时填写；设为可运营时可留空。", "Заполняйте только для паузы, ремонта, уборки или повторной проверки; для доступного статуса можно оставить пустым.", "Токтотуу, оңдоо, тазалоо же кайра текшерүүдө гана толтуруңуз; иштетүүгө болсо бош калса болот."],
    statusOwner: ["选择后续跟进负责人。", "Выберите ответственного за дальнейшие действия.", "Кийинки жооптуу адамды тандаңыз."],
    operationStatusNotes: ["可补充状态备注；没有可留空。", "Дополнительный комментарий к статусу, можно оставить пустым.", "Кошумча абал эскертүүсү, жок болсо бош калат."],
    submitImpactConfirmation: ["确认影响无误后再提交。", "Отправляйте только после проверки влияния.", "Таасирин текшергенден кийин гана тапшырыңыз."],
    impactConfirmationNotes: ["可补充影响说明；没有可留空。", "Дополнительный комментарий о влиянии, можно оставить пустым.", "Кошумча таасир түшүндүрмөсү, жок болсо бош калат."],
    blockerStatus: ["选择阻断事项当前处理状态。", "Выберите текущий статус блокировки.", "Бөгөттүн учурдагы абалын тандаңыз."],
    progressUpdate: ["填写本次处理进展，关闭阻断时说明已处理结果。", "Опишите ход работ; при закрытии укажите результат.", "Бул жолку иш жүрүшүн жазыңыз; жабууда жыйынтыгын көрсөтүңүз."],
    followUpOwner: ["选择继续跟进的人。", "Выберите ответственного за продолжение.", "Уланта турган жооптууну тандаңыз."],
    blockerNotes: ["可补充阻断备注；没有可留空。", "Дополнительный комментарий к блокировке, можно оставить пустым.", "Кошумча бөгөт эскертүүсү, жок болсо бош калат."],
    restoreConclusion: ["选择恢复后的运营结论。", "Выберите итог восстановления.", "Калыбына келгенден кийинки жыйынтыкты тандаңыз."],
    restoreReason: ["说明为什么可以恢复运营。", "Укажите, почему эксплуатацию можно восстановить.", "Эмне үчүн иштетүүнү калыбына келтирсе болорун жазыңыз."],
    recheckResult: ["选择复查是否通过。", "Выберите результат повторной проверки.", "Кайра текшерүү жыйынтыгын тандаңыз."],
    restoreNotes: ["可补充恢复备注；没有可留空。", "Дополнительный комментарий к восстановлению, можно оставить пустым.", "Кошумча калыбына келтирүү эскертүүсү, жок болсо бош калат."]
  };
  const fallback = ["按页面提示填写。", "Заполните по подсказке на странице.", "Беттеги көрсөтмөгө ылайык толтуруңуз."];
  const copy = table[fieldId] ?? fallback;
  return { "zh-CN": copy[0], "ru-RU": copy[1], "ky-KG": copy[2] };
}

function writeGenerated(file, key, content) {
  const base = {
    generated: true,
    doNotEdit: true,
    kind: `dormitory-scenario2-${key}.generated`,
    version: `oam.dormitory-scenario2-${key}.generated.v1`,
    generatorVersion,
    generatedBy,
    generatedFrom,
    inputDigest,
    inputDigests,
    sourceContentDigest: scenarioDigest,
    packageIndexContentDigest: packageIndexDigest,
    authorityId: scenario.authorityId,
    scenarioPackageNo: 2,
    scenarioId: scenario.scenarioId,
    outputContentDigest: "sha256:pending",
    productionConfirmAllowed: false,
    releaseAuthority: false,
    finalGoNoGo: "NO_GO",
    ...content
  };
  const finalized = {
    ...base,
    outputContentDigest: digestObject(base)
  };
  const full = path.join(outputRoot, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(finalized, null, 2)}\n`, "utf8");
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
  const normalized = stableStringify(value, (key, child) => key === "outputContentDigest" ? "sha256:pending" : child);
  return `sha256:${crypto.createHash("sha256").update(normalized).digest("hex")}`;
}

function stableStringify(value, replacer = (_key, child) => child) {
  return JSON.stringify(sortValue(replacer("", value)));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}
