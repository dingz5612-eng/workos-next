import {
  failIfViolations,
  indexBy,
  readJson,
  requireValue,
  requiredScenarioIds,
  validateSchemaFile,
  violation
} from "./lib/oam02-semantic-lib.mjs";

const checkId = "canonical-scenario-map";
const scannedFiles = [
  "docs/business/dormitory/canonical-scenario-map.json",
  "docs/scenarios/dormitory/golden-pilot.yml",
  "docs/business/dormitory/scenario-field-contract.yml",
  "docs/business/dormitory/workitem-catalog.yml",
  "schemas/business/canonical-scenario-map.schema.json"
];
const map = readJson(scannedFiles[0]);
const scenarios = indexBy(readJson(scannedFiles[1]).scenarios ?? [], "scenarioId");
const fieldSets = indexBy(readJson(scannedFiles[2]).fieldSets ?? [], "scenarioId");
const catalog = indexBy(readJson(scannedFiles[3]).workItems ?? [], "workItemType");
const violations = [
  ...validateSchemaFile(scannedFiles[4], ["$schema", "$id", "required", "properties"])
];

requireValue(map.productionAllowed === false, violations, "canonical.production_allowed", "canonical scenario map 不得允许 production。");
requireValue(map.uniqueness?.ordinaryMobileConfirmCannotUseWorkspaceCardFallback === true, violations, "canonical.fallback_not_forbidden", "ordinary mobile confirm 必须禁止 workspace/card fallback。");

const mappings = map.mappings ?? [];
const mappingByScenario = indexBy(mappings, "scenarioId");
const scenarioIds = new Set();
const tupleIds = new Set();

for (const item of mappings) {
  const tuple = `${item.scenarioId}|${item.workItemType}|${item.cardId}|${item.ownerDomain}|${item.surfaceCardId}`;
  if (scenarioIds.has(item.scenarioId)) {
    violations.push(violation("canonical.duplicate_scenario", `scenarioId ${item.scenarioId} 重复。`, { scenarioId: item.scenarioId }));
  }
  if (tupleIds.has(tuple)) {
    violations.push(violation("canonical.duplicate_tuple", `canonical tuple 重复：${tuple}`, { tuple }));
  }
  scenarioIds.add(item.scenarioId);
  tupleIds.add(tuple);
}

for (const scenarioId of requiredScenarioIds) {
  const mapping = mappingByScenario.get(scenarioId);
  const scenario = scenarios.get(scenarioId);
  const fields = fieldSets.get(scenarioId);
  requireValue(Boolean(mapping), violations, "canonical.mapping_missing", `缺少 ${scenarioId} canonical mapping。`, { scenarioId });
  if (!mapping || !scenario || !fields) continue;
  requireValue(mapping.workItemType === scenario.workItemType, violations, "canonical.source_workitem_mismatch", `${scenarioId} mapping 与源场景 workItemType 不一致。`, { scenarioId });
  requireValue(mapping.workItemType === fields.workItemType, violations, "canonical.field_workitem_mismatch", `${scenarioId} mapping 与字段合同 workItemType 不一致。`, { scenarioId });
  requireValue(Boolean(catalog.get(mapping.workItemType)), violations, "canonical.catalog_missing", `${mapping.workItemType} 不在 workitem-catalog 中。`, { scenarioId, workItemType: mapping.workItemType });
  for (const key of ["cardId", "ownerDomain", "surfaceCardId"]) {
    requireValue(typeof mapping[key] === "string" && mapping[key].length > 0, violations, "canonical.key_missing", `${scenarioId}.${key} 不能为空。`, { scenarioId, key });
  }
}

failIfViolations(checkId, violations, scannedFiles);
