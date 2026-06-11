import {
  failIfViolations,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  validateSchemaFile,
  violation
} from "./lib/oam-business-semantic-lib.mjs";

const checkId = "canonical-scenario-map";
const scannedFiles = [
  "docs/business/dormitory/canonical-scenario-map.json",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/business/dormitory/workitem-catalog.yml",
  "docs/business/dormitory/workitem-decision-table.json",
  "docs/contracts/definition/workitem-definition-registry.json",
  "schemas/business/canonical-scenario-map.schema.json"
];
const map = readJson(scannedFiles[0]);
const scenarios = indexBy(readJson(scannedFiles[1]).scenarios ?? [], "scenarioId");
const fieldSets = indexBy(readJson(scannedFiles[2]).fieldSets ?? [], "scenarioId");
const catalog = indexBy(readJson(scannedFiles[3]).workItems ?? [], "workItemType");
const decisions = indexBy(readJson(scannedFiles[4]).decisions ?? [], "workItemType");
const definitions = indexBy(readJson(scannedFiles[5]).definitions ?? [], "definitionId");
const violations = [
  ...validateSchemaFile(scannedFiles[6], ["$schema", "$id", "required", "properties"])
];

requireValue(map.productionAllowed === false, violations, "canonical.production_allowed", "canonical scenario map 不得允许 production。");
requireValue(map.uniqueness?.ordinaryMobileConfirmCannotUseWorkspaceCardFallback === true, violations, "canonical.fallback_not_forbidden", "ordinary mobile confirm 必须禁止 workspace/card fallback。");
requireValue(map.uniqueness?.scenarioDefinitionWorkItemCommandOwnerSurfaceTuple === true, violations, "canonical.definition_tuple_not_unique", "canonical scenario map 必须以 scenario/definition/workItem/command/surface tuple 作为唯一性口径。");
requireValue(!("scenarioWorkItemCardOwnerSurfaceTuple" in (map.uniqueness ?? {})), violations, "canonical.old_card_tuple_still_present", "canonical scenario map 不得继续声明 cardId 业务 tuple。");

const mappings = map.mappings ?? [];
const mappingByScenario = indexBy(mappings, "scenarioId");
const scenarioIds = new Set();
const workItemIds = new Set();
const tupleIds = new Set();

for (const item of mappings) {
  for (const forbiddenKey of ["cardId", "surfaceCardId", "sourceCardId"]) {
    requireValue(!(forbiddenKey in item), violations, "canonical.forbidden_card_identity_key", `canonical mapping 不得使用 ${forbiddenKey} 作为业务身份字段。`, { scenarioId: item.scenarioId, key: forbiddenKey });
  }

  requireMigrationRefs(item, `canonical mapping ${item.scenarioId}`);

  const tuple = `${item.scenarioId}|${item.definitionId}|${item.workItemType}|${item.workItemId}|${item.commandType}|${item.ownerDomain}|${item.surfaceId}`;
  if (scenarioIds.has(item.scenarioId)) {
    violations.push(violation("canonical.duplicate_scenario", `scenarioId ${item.scenarioId} 重复。`, { scenarioId: item.scenarioId }));
  }
  if (workItemIds.has(item.workItemId)) {
    violations.push(violation("canonical.duplicate_workitem_id", `workItemId ${item.workItemId} 重复。`, { scenarioId: item.scenarioId, workItemId: item.workItemId }));
  }
  if (tupleIds.has(tuple)) {
    violations.push(violation("canonical.duplicate_tuple", `canonical tuple 重复：${tuple}`, { tuple }));
  }
  scenarioIds.add(item.scenarioId);
  workItemIds.add(item.workItemId);
  tupleIds.add(tuple);
}

for (const scenarioId of requiredScenarioIds) {
  const mapping = mappingByScenario.get(scenarioId);
  const scenario = scenarios.get(scenarioId);
  const fields = fieldSets.get(scenarioId);
  const decision = decisions.get(scenario?.workItemType);
  requireValue(Boolean(mapping), violations, "canonical.mapping_missing", `缺少 ${scenarioId} canonical mapping。`, { scenarioId });
  if (!mapping || !scenario || !fields) continue;
  requireValue(mapping.workItemType === scenario.workItemType, violations, "canonical.source_workitem_mismatch", `${scenarioId} mapping 与源场景 workItemType 不一致。`, { scenarioId });
  requireValue(mapping.workItemType === fields.workItemType, violations, "canonical.field_workitem_mismatch", `${scenarioId} mapping 与字段合同 workItemType 不一致。`, { scenarioId });
  requireValue(Boolean(decision), violations, "canonical.decision_missing", `${mapping.workItemType} 不在宿舍动作裁决表中。`, { scenarioId, workItemType: mapping.workItemType });
  requireValue(decision?.definitionRequired === true, violations, "canonical.decision_not_executable", `${mapping.workItemType} 必须是需要 Definition 的当前动作或财务治理动作。`, { scenarioId, workItemType: mapping.workItemType });
  if (decision?.keepInDormitoryCatalog === true) {
    requireValue(Boolean(catalog.get(mapping.workItemType)), violations, "canonical.catalog_missing", `${mapping.workItemType} 裁决为宿舍当前动作但不在 workitem-catalog 中。`, { scenarioId, workItemType: mapping.workItemType });
  } else {
    requireValue(decision?.decision === "externalFinanceGovernance", violations, "canonical.non_catalog_not_external_finance", `${mapping.workItemType} 不在宿舍 catalog 时只能是财务治理动作。`, { scenarioId, workItemType: mapping.workItemType });
  }
  const definition = definitions.get(mapping.definitionId);
  requireValue(Boolean(definition), violations, "canonical.definition_missing", `${mapping.definitionId} 不在 OperationDefinition 注册表中。`, { scenarioId, definitionId: mapping.definitionId });
  if (definition) {
    requireValue(definition.workItemType === mapping.workItemType, violations, "canonical.definition_workitem_mismatch", `${scenarioId} mapping 与 OperationDefinition workItemType 不一致。`, { scenarioId, definitionId: mapping.definitionId, expected: mapping.workItemType, actual: definition.workItemType });
    requireValue(definition.commandType === mapping.commandType, violations, "canonical.definition_command_mismatch", `${scenarioId} mapping 与 OperationDefinition commandType 不一致。`, { scenarioId, definitionId: mapping.definitionId, expected: definition.commandType, actual: mapping.commandType });
    requireMigrationRefs(definition, `definition ${definition.definitionId}`);
    requireValue(definition.productionConfirmAllowed === false, violations, "canonical.definition_production_allowed", `${scenarioId} 对应 OperationDefinition 不得允许 production confirm。`, { scenarioId, definitionId: mapping.definitionId });
  }
  for (const key of ["definitionId", "workItemType", "workItemId", "commandType", "ownerDomain", "surfaceId"]) {
    requireValue(typeof mapping[key] === "string" && mapping[key].length > 0, violations, "canonical.key_missing", `${scenarioId}.${key} 不能为空。`, { scenarioId, key });
  }
}

failIfViolations(checkId, violations, scannedFiles);

function requireMigrationRefs(item, label) {
  const refs = item.migrationRefs ?? [];
  const sourceCardRef = refs.find((ref) => ref.type === "sourceCardId");
  requireValue(Boolean(sourceCardRef), violations, "canonical.migration_ref_missing", `${label} 必须把 sourceCardId 放入 migrationRefs。`, { label });
  if (!sourceCardRef) return;
  for (const [key, value] of [
    ["readOnly", true],
    ["executable", false],
    ["affectsAdmission", false],
    ["affectsRuntimeConfirm", false],
    ["affectsBusinessIdentity", false],
    ["affectsLedger", false]
  ]) {
    requireValue(sourceCardRef[key] === value, violations, "canonical.migration_ref_policy_invalid", `${label} migrationRefs.sourceCardId.${key} 必须是 ${value}。`, { label, key });
  }
  requireValue(sourceCardRef.deletionProofRef === "docs/contracts/definition/source-id-migration-fence.json", violations, "canonical.migration_ref_deletion_proof_missing", `${label} migrationRefs.sourceCardId 必须绑定删除证明。`, { label });
}
