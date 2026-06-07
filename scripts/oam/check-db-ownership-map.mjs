import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapPath = "docs/contracts/database/oam-db-ownership-map.json";
const decisionPath = "docs/business/dormitory/workitem-decision-table.json";
const definitionPath = "docs/contracts/definition/workitem-definition-registry.json";
const reportPath = "artifacts/oam/checks/db-ownership-map-result.json";
const allowedModules = new Set(["accommodation", "finance-gate", "identity", "maintenance"]);
const violations = [];

const ownership = readJson(mapPath);
const decisions = readJson(decisionPath);
const definitions = readJson(definitionPath);
const migrationTables = tablesFromMigrations();
const mappedTables = new Map();
const mappedGroups = new Set();

if (ownership.version !== "oam.db-ownership-map.v1" || ownership.status !== "authoritative") {
  fail("db_map_identity_invalid", "数据库归属总图必须声明 oam.db-ownership-map.v1 authoritative。");
}

for (const group of ownership.tableGroups ?? []) {
  for (const field of ["groupId", "module", "factType", "truthOwner", "writeEntry", "allowedReadSides", "testFile", "appendOnly", "ledgerTable", "auditTable", "projectionTable", "protection", "tables"]) {
    if (!(field in group) || group[field] === "") {
      fail("db_group_field_missing", `${group.groupId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  if (!allowedModules.has(group.module)) {
    fail("db_group_module_unknown", `${group.groupId} 使用未知模块 ${group.module}。`);
  }
  mappedGroups.add(group.groupId);
  requirePath(group.testFile, `${group.groupId} 测试绑定`);
  if ((group.appendOnly || group.ledgerTable || group.auditTable) && !group.protection) {
    fail("db_group_protection_missing", `${group.groupId} 是追加、账务或审计表组，必须声明 protection。`);
  }
  if (group.ledgerTable && !/Money\/Ledger Kernel|append-only ledger/i.test(group.truthOwner + " " + group.writeEntry + " " + group.protection)) {
    fail("db_group_ledger_owner_invalid", `${group.groupId} 账务表组必须绑定 Money/Ledger Kernel 或追加账务策略。`);
  }
  for (const tableRef of group.tables ?? []) {
    for (const field of ["table", "migrationFile"]) {
      if (!tableRef[field]) {
        fail("db_table_field_missing", `${group.groupId} 表登记缺少 ${field}。`);
      }
    }
    if (mappedTables.has(tableRef.table)) {
      fail("db_table_duplicate", `数据库表重复登记：${tableRef.table}`);
    }
    mappedTables.set(tableRef.table, { group, tableRef });
    requirePath(tableRef.migrationFile, `${tableRef.table} 迁移文件`);
    const migrationFile = migrationTables.get(tableRef.table);
    if (!migrationFile) {
      fail("db_table_not_in_migrations", `归属图登记的表不在迁移中：${tableRef.table}`);
    } else if (normalize(migrationFile) !== normalize(tableRef.migrationFile)) {
      fail("db_table_migration_mismatch", `${tableRef.table} 迁移文件不匹配：期望 ${migrationFile}，实际 ${tableRef.migrationFile}`);
    }
  }
}

for (const table of migrationTables.keys()) {
  if (!mappedTables.has(table)) {
    fail("db_table_unowned", `迁移表未登记 owner：${table}`);
  }
}

for (const manifestPath of ownership.moduleManifestRefs ?? []) {
  requirePath(manifestPath, `模块 manifest ${manifestPath}`);
  const manifest = readJson(manifestPath);
  for (const table of manifest.database ?? []) {
    if (!migrationTables.has(table)) {
      fail("manifest_table_missing_in_migration", `${manifest.module} manifest 声明的表不存在于迁移：${table}`);
    }
    if (!mappedTables.has(table)) {
      fail("manifest_table_missing_owner", `${manifest.module} manifest 声明的表缺少 DB owner：${table}`);
    }
  }
}

validateExecutionMappings();

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("DB ownership map check: PASS");

function validateExecutionMappings() {
  if (!Array.isArray(ownership.executionMappings) || ownership.executionMappings.length === 0) {
    fail("execution_mapping_missing", "数据库归属总图必须包含 executionMappings。");
    return;
  }

  const currentDecisions = (decisions.decisions ?? []).filter((item) => item.definitionRequired === true);
  const definitionsById = new Map((definitions.definitions ?? []).map((item) => [item.definitionId, item]));
  const mappingByAction = new Map();
  for (const mapping of ownership.executionMappings) {
    if (!mapping.businessAction) {
      fail("execution_mapping_action_missing", "executionMappings 存在缺少 businessAction 的项。");
      continue;
    }
    if (mappingByAction.has(mapping.businessAction)) {
      fail("execution_mapping_duplicate", `执行映射重复登记：${mapping.businessAction}`);
    }
    mappingByAction.set(mapping.businessAction, mapping);
  }

  if (mappingByAction.size !== currentDecisions.length) {
    fail("execution_mapping_count_mismatch", `执行映射数量必须等于当前 Definition 必需动作数量：expected=${currentDecisions.length}, actual=${mappingByAction.size}`);
  }

  for (const decision of currentDecisions) {
    const mapping = mappingByAction.get(decision.workItemType);
    const definition = definitionsById.get(decision.definitionId);
    if (!mapping) {
      fail("execution_mapping_action_missing", `缺少当前动作执行映射：${decision.workItemType}`);
      continue;
    }
    if (!definition) {
      fail("execution_mapping_definition_missing", `${decision.workItemType} 找不到 Definition：${decision.definitionId}`);
      continue;
    }
    for (const field of ["businessAction", "decision", "definitionId", "commandType", "unitOfWork", "ownerSlice", "tableGroups", "domainEvent", "ledgerEntry", "searchProjectionLens", "tests"]) {
      if (!(field in mapping) || mapping[field] === "") {
        fail("execution_mapping_field_missing", `${decision.workItemType} 执行映射缺少 ${field}。`);
      }
    }
    requireEqual(mapping.decision, decision.decision, decision.workItemType, "decision");
    requireEqual(mapping.definitionId, decision.definitionId, decision.workItemType, "definitionId");
    requireEqual(mapping.commandType, decision.commandType, decision.workItemType, "commandType");
    requireEqual(mapping.ownerSlice, decision.ownerSlice, decision.workItemType, "ownerSlice");
    requireEqual(mapping.unitOfWork, "OperationsUnitOfWork", decision.workItemType, "unitOfWork");
    requireEqual(definition.definitionMode, "oam-certification-current", decision.workItemType, "definitionMode");
    requireEqual(definition.commandType, decision.commandType, decision.workItemType, "definition.commandType");
    requireEqual(definition.ownerSlice, decision.ownerSlice, decision.workItemType, "definition.ownerSlice");
    if (!sameSet(mapping.tableGroups ?? [], decision.dbTableGroups ?? [])) {
      fail("execution_mapping_table_groups_mismatch", `${decision.workItemType} tableGroups 必须与裁决表一致。`);
    }
    for (const group of mapping.tableGroups ?? []) {
      if (!mappedGroups.has(group)) {
        fail("execution_mapping_group_unknown", `${decision.workItemType} 引用未知表组：${group}`);
      }
    }
    for (const requiredGroup of ["operations-runtime", "evidence-audit"]) {
      if (!(mapping.tableGroups ?? []).includes(requiredGroup)) {
        fail("execution_mapping_required_group_missing", `${decision.workItemType} 必须绑定 ${requiredGroup}。`);
      }
    }

    const allowedFacts = new Set(definition.allowedFacts ?? []);
    const requiresDomainEvent = allowedFacts.has("DomainEvent");
    if (mapping.domainEvent?.required !== requiresDomainEvent) {
      fail("execution_mapping_domain_event_mismatch", `${decision.workItemType} DomainEvent 要求必须与 Definition allowedFacts 一致。`);
    }
    if (mapping.domainEvent?.tableGroup && !mappedGroups.has(mapping.domainEvent.tableGroup)) {
      fail("execution_mapping_domain_event_group_unknown", `${decision.workItemType} DomainEvent 引用未知表组：${mapping.domainEvent.tableGroup}`);
    }

    const requiresLedger = allowedFacts.has("LedgerEntry");
    if (mapping.ledgerEntry?.required !== requiresLedger) {
      fail("execution_mapping_ledger_required_mismatch", `${decision.workItemType} LedgerEntry 要求必须与 Definition allowedFacts 一致。`);
    }
    if (mapping.ledgerEntry?.policyRef !== definition.ledgerPolicyRef) {
      fail("execution_mapping_ledger_policy_mismatch", `${decision.workItemType} ledgerPolicyRef 必须与 Definition 一致。`);
    }
    if (requiresLedger) {
      if (mapping.ledgerEntry?.appendOnly !== true || mapping.ledgerEntry?.tableGroup !== "finance-ledger") {
        fail("execution_mapping_ledger_append_only_missing", `${decision.workItemType} LedgerEntry 必须绑定 finance-ledger 追加策略。`);
      }
      if (mapping.ledgerEntry?.mutationPolicy !== "no_update_no_delete") {
        fail("execution_mapping_ledger_mutation_policy_missing", `${decision.workItemType} LedgerEntry 必须禁止 update/delete。`);
      }
    }

    if (mapping.searchProjectionLens?.readOnly !== true) {
      fail("execution_mapping_read_side_not_readonly", `${decision.workItemType} Search / Projection / Lens 必须只读。`);
    }
    for (const testPath of mapping.tests ?? []) {
      requirePath(testPath, `${decision.workItemType} 测试绑定`);
    }
  }

  for (const mapping of ownership.executionMappings) {
    if (!currentDecisions.some((decision) => decision.workItemType === mapping.businessAction)) {
      fail("execution_mapping_non_current_action", `非当前 Definition 必需动作不得进入执行映射：${mapping.businessAction}`);
    }
  }
}

function tablesFromMigrations() {
  const result = new Map();
  const dir = "infra/db/migrations";
  for (const file of fs.readdirSync(abs(dir)).filter((item) => item.endsWith(".sql")).sort()) {
    const repoPath = `${dir}/${file}`;
    const text = fs.readFileSync(abs(repoPath), "utf8");
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:[a-zA-Z_][a-zA-Z0-9_]*)\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
      if (!result.has(match[1])) {
        result.set(match[1], repoPath);
      }
    }
  }
  return result;
}

function readJson(file) {
  requirePath(file, file);
  try {
    return JSON.parse(fs.readFileSync(abs(file), "utf8"));
  } catch (error) {
    fail("json_invalid", `${file} 不是合法 JSON：${error.message}`);
    return {};
  }
}

function requirePath(file, label) {
  if (!fs.existsSync(abs(file))) {
    fail("path_missing", `${label} 不存在：${file}`);
  }
}

function writeReport() {
  const full = abs(reportPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify({
    checkedAt: new Date().toISOString(),
    architecture: "oam.current",
    status: violations.length ? "fail" : "pass",
    tableGroupCount: ownership.tableGroups?.length ?? 0,
    executionMappingCount: ownership.executionMappings?.length ?? 0,
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function requireEqual(actual, expected, scope, field) {
  if (actual !== expected) {
    fail("execution_mapping_value_mismatch", `${scope} ${field} 不一致：expected=${expected}, actual=${actual}`);
  }
}

function sameSet(left, right) {
  const normalizeArray = (value) => [...new Set(value)].sort();
  return JSON.stringify(normalizeArray(left)) === JSON.stringify(normalizeArray(right));
}

function normalize(file) {
  return String(file).replaceAll("\\", "/");
}

function abs(file) {
  return path.join(root, file);
}
