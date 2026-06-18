import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const resultPath = "artifacts/oam/checks/dormitory-field-authority-model-result.json";
const controlPath = "docs/business/domains/dormitory/dormitory-13-scenario-control.authority.json";
const runtimeExecutionPath = "services/core-api/WorkOS.Api/Runtime/Dormitory13ScenarioRuntimeExecution.generated.json";
const languageContractRef = "docs/oam/visible-business-copy-contract.json";
const requiredClasses = [
  "businessInput",
  "businessSelect",
  "systemDerived",
  "readOnlySummary",
  "evidenceBinding",
  "legalAction",
  "auditInternal"
];
const failures = [];

const control = readJson(controlPath);
const scenarioFiles = fs.readdirSync(path.join(root, "docs/business/domains/dormitory"))
  .filter((file) => /^dormitory-scenario\d+-.+\.authority\.json$/.test(file) && !file.includes("benchmark"))
  .sort((left, right) => scenarioNo(left) - scenarioNo(right));

checkControlModel();
for (const file of scenarioFiles) checkScenarioSource(file);
checkGeneratedProjection();
checkRuntimeExecution();

const result = {
  version: "oam.dormitory-field-authority-model-check.v2",
  checkedAtUtc: new Date().toISOString(),
  status: failures.length === 0 ? "PASS" : "NO_GO",
  sourceAuthorities: [
    { path: controlPath, digest: digestFile(controlPath) },
    ...scenarioFiles.map((file) => {
      const sourcePath = `docs/business/domains/dormitory/${file}`;
      return { path: sourcePath, digest: digestFile(sourcePath) };
    })
  ],
  runtimeExecutionPath,
  productionConfirmAllowed: false,
  releaseAuthority: false,
  finalGoNoGo: "NO_GO",
  failures
};

writeJson(resultPath, result);

if (result.status !== "PASS") {
  console.error("Dormitory field authority model check: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dormitory field authority model check: PASS (${scenarioFiles.length} scenarios)`);

function checkControlModel() {
  const model = control.fieldAuthorityModel ?? {};
  requireEqual(model.version, "oam.dormitory.field-authority-model.v1", "control.fieldAuthorityModel.version");
  requireEqual(model.languageContractRef, languageContractRef, "control.fieldAuthorityModel.languageContractRef");
  const classIds = new Set((model.classes ?? []).map((item) => item.classId));
  for (const classId of requiredClasses) {
    if (!classIds.has(classId)) fail(`control.fieldAuthorityModel.classes missing ${classId}.`);
  }
  const enforcement = model.generatorEnforcement ?? {};
  for (const key of [
    "legalActionNeverInForm",
    "readOnlySummaryMaterializedInRuntime",
    "workSurfaceContractRequiredForEveryStep",
    "amountRequiresCurrencyBusinessObjectDirectionAndStage",
    "visibleCopyMustUseLanguageContract"
  ]) {
    if (enforcement[key] !== true) fail(`control.fieldAuthorityModel.generatorEnforcement.${key} must be true.`);
  }
  const experience = control.operationExperienceContract ?? {};
  requireEqual(experience.version, "oam.dormitory.operation-experience-contract.v1", "control.operationExperienceContract.version");
  for (const field of [
    "primaryBusinessObject",
    "requiredReadContext",
    "editableInputs",
    "fixedSelections",
    "financialContext",
    "legalActions",
    "handoffSummary",
    "searchReadModel"
  ]) {
    if (!(experience.requiredStepFields ?? []).includes(field)) {
      fail(`control.operationExperienceContract.requiredStepFields missing ${field}.`);
    }
  }
}

function checkScenarioSource(file) {
  const no = scenarioNo(file);
  const sourcePath = `docs/business/domains/dormitory/${file}`;
  const source = readJson(sourcePath);
  const authority = source.fields?.fieldAuthority ?? {};
  requireEqual(authority.modelRef, `${controlPath}#fieldAuthorityModel`, `scenario${no}.fields.fieldAuthority.modelRef`);
  requireEqual(authority.languageContractRef, languageContractRef, `scenario${no}.fields.fieldAuthority.languageContractRef`);
  requireEqual(source.experienceContract?.modelRef, `${controlPath}#operationExperienceContract`, `scenario${no}.experienceContract.modelRef`);

  for (const classId of requiredClasses) {
    if (!Array.isArray(authority[classId]) || authority[classId].length === 0) {
      fail(`scenario${no}.fields.fieldAuthority.${classId} must be a non-empty array.`);
    }
  }

  const businessInputs = authorityTokens(authority.businessInput);
  const businessSelects = authorityTokens(authority.businessSelect);
  const conditionalInputs = authorityTokens(authority.conditionalInput);
  const legalActions = new Set([
    ...Array.from(authorityTokens(authority.legalAction)),
    ...Array.from(authorityTokens(authority.actionControl))
  ]);
  const readOnlySummaries = authorityTokens(authority.readOnlySummary);
  const auditInternal = authorityTokens(authority.auditInternal);

  for (const field of source.fields?.userFilled ?? []) {
    if (!businessInputs.has(field) && !conditionalInputs.has(field)) {
      fail(`scenario${no}.${field} is userFilled but missing businessInput/conditionalInput authority.`);
    }
    if (legalActions.has(field) || isLegalActionLike(field)) fail(`scenario${no}.${field} legal action must not be userFilled.`);
    if (auditInternal.has(field) || isInternalField(field)) fail(`scenario${no}.${field} internal/audit field must not be userFilled.`);
  }
  for (const field of source.fields?.userSelected ?? []) {
    if (!businessSelects.has(field)) fail(`scenario${no}.${field} is userSelected but missing businessSelect authority.`);
    if (legalActions.has(field) || isLegalActionLike(field)) fail(`scenario${no}.${field} legal action must not be userSelected.`);
    if (auditInternal.has(field) || isInternalField(field)) fail(`scenario${no}.${field} internal/audit field must not be userSelected.`);
  }
  for (const item of authority.businessSelect ?? []) {
    requireFieldKeys(item, `scenario${no}.businessSelect.${item.fieldId}`, ["labelKey", "helpKey", "errorKey", "control", "optionSet"]);
    if (!String(item.control ?? "").includes("select")) fail(`scenario${no}.${item.fieldId} businessSelect must use select/searchable-select.`);
    if (isLegalActionLike(item.fieldId)) fail(`scenario${no}.${item.fieldId} legal action must not be businessSelect.`);
  }
  for (const item of authority.readOnlySummary ?? []) {
    requireFieldKeys(item, `scenario${no}.readOnlySummary.${item.fieldId}`, ["labelKey", "helpKey", "sourceScenario"]);
  }
  for (const item of authority.legalAction ?? []) {
    requireFieldKeys(item, `scenario${no}.legalAction.${item.fieldId}`, ["labelKey", "legalActionRef"]);
  }
  for (const item of authority.auditInternal ?? []) {
    if (item.internalOnly !== true) fail(`scenario${no}.${item.fieldId} auditInternal must set internalOnly=true.`);
  }

  for (const step of source.steps ?? []) {
    const stepLabel = `scenario${no}.${step.stepId}`;
    if (!Array.isArray(step.userSees) || step.userSees.length === 0) fail(`${stepLabel}.userSees is required.`);
    if (!step.primaryBusinessObject) fail(`${stepLabel}.primaryBusinessObject is required.`);
    if (!Array.isArray(step.requiredReadContext) || step.requiredReadContext.length === 0) fail(`${stepLabel}.requiredReadContext is required.`);
    if (!Array.isArray(step.editableInputs)) fail(`${stepLabel}.editableInputs must be an array.`);
    if (!Array.isArray(step.fixedSelections)) fail(`${stepLabel}.fixedSelections must be an array.`);
    if (!Array.isArray(step.legalActions)) fail(`${stepLabel}.legalActions must be an array.`);
    if (!step.handoffSummary?.noRefillRuleZh) fail(`${stepLabel}.handoffSummary.noRefillRuleZh is required.`);
    if (!Array.isArray(step.searchReadModel) || step.searchReadModel.length === 0) fail(`${stepLabel}.searchReadModel is required.`);
    for (const field of [...(step.userFilledFields ?? []), ...(step.userSelectedFields ?? [])]) {
      if (isLegalActionLike(field)) fail(`${stepLabel}.${field} legal action must not remain in form fields.`);
      if (readOnlySummaries.has(field)) fail(`${stepLabel}.${field} readOnlySummary must not be a user form field.`);
      if (auditInternal.has(field) || isInternalField(field)) fail(`${stepLabel}.${field} audit/internal must not be a user form field.`);
    }
    const moneyLike = stepHasMoney(step);
    if (moneyLike) {
      if (step.financialContext?.applies !== true) fail(`${stepLabel}.financialContext.applies must be true for money page.`);
      for (const key of ["businessObject", "currency", "direction", "stage"]) {
        if (!String(step.financialContext?.[key] ?? "").trim()) fail(`${stepLabel}.financialContext.${key} is required.`);
      }
      if (!Array.isArray(step.financialContext?.amountFields) || step.financialContext.amountFields.length === 0) {
        fail(`${stepLabel}.financialContext.amountFields is required.`);
      }
    }
  }

  const paymentStep = no === 6
    ? (source.steps ?? []).find((step) => step.stepId === "submit-payment-receipt-evidence")
    : null;
  if (paymentStep) {
    for (const required of ["客户信息", "联系电话", "预订号", "入住日期", "离店日期", "人数", "房间/床位", "价格快照", "应收项目", "已收金额", "本次金额", "剩余待收", "币种", "凭证要求"]) {
      if (!(paymentStep.requiredReadContext ?? []).includes(required)) {
        fail(`scenario6 submit-payment-receipt-evidence missing payment read context ${required}.`);
      }
    }
  }
}

function checkGeneratedProjection() {
  for (const file of scenarioFiles) {
    const no = scenarioNo(file);
    const slug = file.replace(/^dormitory-scenario\d+-/, "").replace(/\.authority\.json$/, "");
    const generatedCandidates = [
      `docs/contracts/generated/dormitory/scenario${no}-steps-fields.generated.json`,
      `apps/mobile/src/generated/oam/dormitory-scenario${no}-${slug}.generated.json`,
      runtimeMirrorPath(no, slug)
    ];
    for (const generatedPath of generatedCandidates) {
      const document = readJsonIfExists(generatedPath);
      if (!document) {
        fail(`${generatedPath} missing.`);
        continue;
      }
      if (!document.fields?.fieldAuthority) fail(`${generatedPath} must project fields.fieldAuthority.`);
      if (!document.experienceContract) fail(`${generatedPath} must project experienceContract.`);
      const stepWithoutContract = (document.steps ?? []).find((step) => !step.requiredReadContext || !step.searchReadModel);
      if (stepWithoutContract) fail(`${generatedPath}.${stepWithoutContract.stepId} missing generated step experience contract.`);
    }
  }
}

function checkRuntimeExecution() {
  const document = readJsonIfExists(runtimeExecutionPath);
  if (!document) {
    fail(`${runtimeExecutionPath} missing.`);
    return;
  }
  if ((document.scenarios ?? []).length !== 11) fail("runtime execution must cover executable scenarios 3-13.");
  for (const scenario of document.scenarios ?? []) {
    for (const step of scenario.steps ?? []) {
      const label = `runtime.scenario${scenario.scenarioPackageNo}.${step.stepId}`;
      if (!Array.isArray(step.readOnlySummary) || step.readOnlySummary.length === 0) fail(`${label}.readOnlySummary is required.`);
      if (!Array.isArray(step.legalActions)) fail(`${label}.legalActions must be an array.`);
      if (!step.primaryBusinessObject) fail(`${label}.primaryBusinessObject is required.`);
      if (!Array.isArray(step.requiredReadContext) || step.requiredReadContext.length === 0) fail(`${label}.requiredReadContext is required.`);
      for (const field of step.readOnlySummary ?? []) {
        if (field.ui?.readonly !== true || field.userSubmitted === true) fail(`${label}.${field.fieldId} readOnlySummary must be readonly and not user submitted.`);
      }
      for (const field of step.fields ?? []) {
        const fieldId = field.fieldId ?? field.id ?? "";
        const zh = field.label?.["zh-CN"] ?? "";
        if (isLegalActionLike(fieldId) || isLegalActionLike(zh)) fail(`${label}.${fieldId} legal action must not render as field.`);
        if (field.ui?.readonly === true || field.source === "readOnlySummary") fail(`${label}.${fieldId} readOnlySummary must not render in business fields.`);
        if (!zh || zh === fieldId || /^[a-z][A-Za-z0-9_.-]*$/.test(zh)) fail(`${label}.${fieldId} must have business zh label, actual ${JSON.stringify(zh)}.`);
      }
      if (scenario.scenarioPackageNo === 6 && step.stepId === "submit-payment-receipt-evidence") {
        const labels = new Set((step.readOnlySummary ?? []).map((field) => field.label?.["zh-CN"]));
        for (const required of ["客户信息", "联系电话", "预订号", "入住日期", "离店日期", "人数", "房间/床位", "价格快照", "应收项目", "已收金额", "本次金额", "剩余待收", "币种", "凭证要求"]) {
          if (!labels.has(required)) fail(`${label}.readOnlySummary missing ${required}.`);
        }
      }
    }
  }
}

function runtimeMirrorPath(no, slug) {
  const names = {
    1: "DormitoryScenario1ResourceBasicReadiness.generated.json",
    2: "DormitoryScenario2ResourceOperationStatus.generated.json",
    3: "DormitoryScenario3ProductAndPricing.generated.json",
    4: "DormitoryScenario4InquiryAndQuote.generated.json",
    5: "DormitoryScenario5ReservationAndInventoryHold.generated.json",
    6: "DormitoryScenario6PaymentDepositAndGuarantee.generated.json",
    7: "DormitoryScenario7CheckInProcessing.generated.json",
    8: "DormitoryScenario8InStayManagement.generated.json",
    9: "DormitoryScenario9CheckoutSettlement.generated.json",
    10: "DormitoryScenario10CancelNoShowRefund.generated.json",
    11: "DormitoryScenario11HousekeepingMaintenanceOutOfService.generated.json",
    12: "DormitoryScenario12ChannelCorporateCustomer.generated.json",
    13: "DormitoryScenario13ReportingAuditReview.generated.json"
  };
  return `services/core-api/WorkOS.Api/Runtime/${names[no] ?? slug}`;
}

function stepHasMoney(step) {
  const material = {
    nameZh: step.nameZh,
    commandBusinessNameZh: step.commandBusinessNameZh,
    userSees: step.userSees,
    userFilledFields: step.userFilledFields,
    userSelectedFields: step.userSelectedFields,
    systemCalculatedFields: step.systemCalculatedFields,
    outputs: step.outputs,
    requiredReadContext: step.requiredReadContext
  };
  return /金额|价格|应收|已收|待收|押金|担保|退款|扣费|应退|应补|费用|佣金|结算|收款|财务|price|amount|currency|deposit|refund|payment|fee|commission/i
    .test(JSON.stringify(material));
}

function isLegalActionLike(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^(是否|有无|客户确认方式|确认方式|负责人例外审批说明|确认备注|退回原因)/.test(text)) return false;
  if (/(方式|类型|结果|状态|范围|原因|说明|备注|时间|日期|时长|金额|数量|额度|币种|人|客户|负责人|渠道|商品|房间|床位)$/.test(text) &&
    !/^(查看|进入|返回|提交|发布|导出|创建|办理|确认退房|确认取消|确认未到店|确认入住|确认交付|关闭任务)/.test(text)) {
    return false;
  }
  if (/^(确认|退回补证|部分确认|标记异常|转人工复核|转负责人复核|补充证据|发起纠错|导出摘要)$/.test(text)) return true;
  if (/^(办理|进入|查看|返回|继续|保存|提交|发送|发布|导出|关闭|作废|停用|启用|锁定|释放|创建|登记|申请|标记|生成|输出|同步|审核通过|归档|发起)/.test(text)) return true;
  return /^(confirm|submit|send|save|back|return|continue|view|start|enter|create|release|lock|publish|export|mark|activate|disable|void|close|record|supplement|correction)/i.test(text) &&
    !/(Method|Status|Type|Reason|Date|Time|Amount|Name|Remark|Notes|Option|Scope|Owner|Channel|Preference|Confirmation)$/i.test(text);
}

function isInternalField(value = "") {
  const text = String(value || "");
  if (/ContextRef$/i.test(text)) return false;
  return /(^|[._-])(roomId|bedId|ratePlanId|quoteId|reservationId|stayId|paymentId|depositId|refundId|ledgerEntryId|ledgerTransactionId|stableRef|digest|projectionVersion|domainEventId|commandSubmissionRef)$/i.test(text) ||
    /内部|哈希/.test(text);
}

function requireFieldKeys(item, label, keys) {
  for (const key of keys) {
    if (item?.[key] === undefined || item?.[key] === "") fail(`${label}.${key} is required.`);
  }
}

function authorityTokens(items = []) {
  return new Set((items ?? []).flatMap((item) => [
    item.fieldId,
    item.labelZh
  ]).filter(Boolean));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}.`);
}

function scenarioNo(file) {
  return Number(file.match(/scenario(\d+)/)?.[1] ?? 0);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8").replace(/^\uFEFF/, ""));
}

function readJsonIfExists(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "")) : null;
}

function writeJson(file, value) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function digestFile(file) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")}`;
}

function fail(message) {
  failures.push(message);
}
