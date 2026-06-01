import {
  failIfViolations,
  includesAll,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  validateSchemaFile,
  violation
} from "./lib/oam02-semantic-lib.mjs";

const checkId = "evidence-coverage-contract";
const scannedFiles = [
  "docs/business/dormitory/evidence-coverage-contract.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/evidence-policy.yml",
  "docs/business/dormitory/evidence-requirements.yml",
  "schemas/business/evidence-coverage-contract.schema.json"
];
const contract = readJson(scannedFiles[0]);
const fields = indexBy(readJson(scannedFiles[1]).fieldSets ?? [], "scenarioId");
const scenarios = indexBy(readJson(scannedFiles[2]).scenarios ?? [], "scenarioId");
const catalog = indexBy(readJson(scannedFiles[3]).workItems ?? [], "workItemType");
const policy = readJson(scannedFiles[4]);
const requirements = indexBy(readJson(scannedFiles[5]).evidenceRequirements ?? [], "requirementId");
const policyById = indexBy(policy.requirements ?? [], "requirementId");
const violations = [
  ...validateSchemaFile(scannedFiles[6], ["$schema", "$id", "required", "properties"])
];

requireValue(contract.productionAllowed === false, violations, "evidence.production_allowed", "证据覆盖合同不得允许 production。");
for (const flag of ["missingEvidenceBlocksConfirm", "rejectedEvidenceBlocksConfirm", "wrongScopeEvidenceBlocksConfirm"]) {
  requireValue(contract.runtimeFlags?.[flag] === true && policy[flag] === true, violations, "evidence.runtime_flag_missing", `${flag} 必须在合同和 runtime policy 中同时为 true。`, { flag });
}

for (const scenarioId of requiredScenarioIds) {
  const scenario = scenarios.get(scenarioId);
  const fieldSet = fields.get(scenarioId);
  const catalogItem = catalog.get(scenario?.workItemType);
  if (!scenario || !fieldSet) continue;
  const expectedEvidence = Array.from(new Set([...(scenario.requiredEvidence ?? []), ...(fieldSet.evidenceFields ?? [])]));
  for (const evidenceId of expectedEvidence) {
    requireValue(Boolean(policyById.get(evidenceId)), violations, "evidence.policy_missing_scenario_requirement", `${scenarioId} 的证据 ${evidenceId} 未进入 evidence-policy。`, { scenarioId, evidenceId });
    requireValue(Boolean(requirements.get(evidenceId)), violations, "evidence.required_fields_missing", `${evidenceId} 未进入 evidence-requirements。`, { scenarioId, evidenceId });
  }
  const missingInCatalog = includesAll(catalogItem?.requiredEvidence ?? [], scenario.requiredEvidence ?? []);
  for (const evidenceId of missingInCatalog) {
    violations.push(violation("evidence.catalog_missing_scenario_requirement", `${scenario.workItemType} catalog 未覆盖场景证据 ${evidenceId}。`, { scenarioId, workItemType: scenario.workItemType, evidenceId }));
  }
}

for (const requirement of policy.requirements ?? []) {
  requireValue(Boolean(requirements.get(requirement.requirementId)), violations, "evidence.policy_requirement_fields_missing", `${requirement.requirementId} 在 policy 中存在但缺少 requiredFields。`, { requirementId: requirement.requirementId });
  for (const workItemType of requirement.workItemTypes ?? []) {
    if (workItemType.startsWith("Gate.")) continue;
    requireValue(Boolean(catalog.get(workItemType)), violations, "evidence.policy_workitem_missing_catalog", `${workItemType} 在 evidence-policy 中存在但缺少 catalog 项。`, { workItemType });
  }
}

failIfViolations(checkId, violations, scannedFiles);
