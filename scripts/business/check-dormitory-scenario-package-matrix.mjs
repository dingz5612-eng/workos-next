import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matrixPath = "docs/business/domains/dormitory/scenarios/dormitory-scenario-package-matrix.yml";
const definitionRegistryPath = "docs/contracts/definition/workitem-definition-registry.json";
const resultPath = "artifacts/oam/checks/dormitory-scenario-package-matrix-result.json";
const requiredPackages = [
  "resource-saleability",
  "lead-reservation",
  "check-in",
  "ordinary-payment",
  "deposit-liability",
  "service-task",
  "expense-governance",
  "bed-transfer-extend",
  "checkout-settlement",
  "period-review",
  "exception-correction"
];
const violations = [];
const text = read(matrixPath);
const matrix = parseSimpleYaml(text);
const definitionRegistry = readJson(definitionRegistryPath);
const definitionsByType = new Map((definitionRegistry.definitions ?? []).map((item) => [item.workItemType, item]));

checkSourceIdentity();
checkGlobalRules();
checkWorkItemBindings();
checkPackages();
checkHandoffDag();
writeResult();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}
console.log("Dormitory scenario package matrix check: PASS");

function checkSourceIdentity() {
  requireValue(matrix.version === "oam.dormitory.scenario-package-matrix.v1", "matrix.source_identity_missing", "Scenario matrix version mismatch.");
  requireValue(matrix.status === "authoritative", "matrix.source_identity_missing", "Scenario matrix status must be authoritative.");
  requireValue(matrix.layer === "source", "matrix.source_identity_missing", "Scenario matrix must remain Source Layer.");
  requireValue(matrix.manualEditAllowed === true, "matrix.source_identity_missing", "Scenario matrix must allow manual source edits.");
  requireValue(matrix.generated === false && matrix.doNotEdit === false, "matrix.source_identity_missing", "Scenario matrix must not be generated.");
  requireValue(matrix.matrixNameZh === "宿舍场景包矩阵与衔接合同", "matrix.source_identity_missing", "Scenario matrix Chinese name mismatch.");
  for (const item of ["cardId", "sourceCardId", "workspace card", "old catalog id", "old seed id"]) {
    requireValue((matrix.businessIdentity?.forbidden ?? []).includes(item), "matrix.forbidden_identity_missing", `禁止身份缺少 ${item}。`, { item });
  }
}

function checkGlobalRules() {
  for (const [key, expected] of Object.entries({
    sourceOnly: true,
    generatedViewMayNotOverride: true,
    uiMayNotInferAdmission: true,
    dashboardSearchSurfaceMayNotWriteFacts: true,
    financeKernelOwnsLedgerEntry: true
  })) {
    requireValue(matrix.globalRules?.[key] === expected, "matrix.global_rule_missing", `全局规则 ${key} 必须是 ${expected}。`, { key });
  }
}

function checkWorkItemBindings() {
  const bindings = matrix.workItemBindings ?? [];
  const seenPackages = bindings.map((item) => item.packageId);
  requireValue(JSON.stringify(seenPackages) === JSON.stringify(requiredPackages), "matrix.workitem_binding_order_invalid", "workItemBindings 必须覆盖 11 个场景包且顺序一致。", { seenPackages });
  for (const binding of bindings) {
    assertNonEmptyArray(binding.workItems, `workItemBindings.${binding.packageId}.workItems`, "matrix.workitem_binding_missing");
    for (const workItem of binding.workItems ?? []) {
      requireValue(Boolean(workItem.workItemType), "matrix.workitem_type_missing", `${binding.packageId} 缺少 workItemType。`, { packageId: binding.packageId });
      requireValue(Boolean(workItem.definitionId), "matrix.definition_id_missing", `${binding.packageId} 缺少 definitionId。`, { packageId: binding.packageId, workItemType: workItem.workItemType });
      const registryDefinition = definitionsByType.get(workItem.workItemType);
      requireValue(Boolean(registryDefinition), "matrix.workitem_type_not_registered", `${workItem.workItemType} 不存在于 definition registry。`, { workItemType: workItem.workItemType });
      if (registryDefinition) {
        requireValue(registryDefinition.definitionId === workItem.definitionId, "matrix.definition_id_mismatch", `${workItem.workItemType} definitionId 不匹配。`, {
          workItemType: workItem.workItemType,
          expected: registryDefinition.definitionId,
          actual: workItem.definitionId
        });
      }
    }
  }
}

function checkPackages() {
  const packages = matrix.scenarioPackages ?? [];
  const seen = packages.map((item) => item.packageId);
  requireValue(JSON.stringify(seen) === JSON.stringify(requiredPackages), "matrix.package_order_invalid", "宿舍场景包必须按指定 11 包顺序定义。", { seen });
  const bindingsByPackage = new Map((matrix.workItemBindings ?? []).map((item) => [item.packageId, new Set((item.workItems ?? []).map((workItem) => workItem.workItemType))]));
  for (const scenarioPackage of packages) {
    const packageId = scenarioPackage.packageId;
    for (const key of [
      "nameZh",
      "businessGoalZh",
      "inScope",
      "outOfScope",
      "mainFlowZh",
      "branchFlows",
      "fields",
      "handoff",
      "roles",
      "factOwnership",
      "admission",
      "evidence",
      "ledger",
      "readSideOutputs",
      "uiUxBoundary",
      "goNoGo"
    ]) {
      requireValue(key in scenarioPackage, "matrix.package_section_missing", `${packageId} 缺少 ${key}`, { packageId, key });
    }
    requireValue(/[\u4e00-\u9fff]/.test(scenarioPackage.nameZh ?? ""), "matrix.name_not_chinese", `${packageId} 必须有中文名称。`, { packageId });
    assertNonEmptyArray(scenarioPackage.inScope, `${packageId}.inScope`, "matrix.in_scope_missing");
    const boundWorkItems = bindingsByPackage.get(packageId) ?? new Set();
    for (const workItemType of scenarioPackage.inScope ?? []) {
      requireValue(boundWorkItems.has(workItemType), "matrix.in_scope_not_bound", `${packageId} inScope workItemType 缺少 definition binding: ${workItemType}`, { packageId, workItemType });
    }
    checkFields(packageId, scenarioPackage.fields ?? []);
    checkHandoff(packageId, scenarioPackage.handoff ?? {});
    checkBoundarySections(packageId, scenarioPackage);
  }
}

function checkFields(packageId, fields) {
  requireValue(fields.length >= 2, "matrix.field_count_too_low", `${packageId} 至少需要两个字段定义。`, { packageId });
  for (const field of fields) {
    for (const key of ["fieldId", "displayNameZh", "type", "category", "editable", "source", "truthOwner", "fallbackAllowed", "validationRules", "evidenceRequirements"]) {
      requireValue(key in field, "matrix.field_contract_missing", `${packageId} 字段合同缺少 ${key}`, { packageId, key, fieldId: field.fieldId });
    }
    requireValue(/[\u4e00-\u9fff]/.test(field.displayNameZh ?? ""), "matrix.field_name_not_chinese", `${packageId}.${field.fieldId} 必须有中文字段名。`, { packageId, fieldId: field.fieldId });
    requireValue(field.fallbackAllowed === false, "matrix.field_fallback_allowed", `${packageId}.${field.fieldId} 必须 fallbackAllowed=false。`, { packageId, fieldId: field.fieldId });
    assertNonEmptyArray(field.validationRules, `${packageId}.${field.fieldId}.validationRules`, "matrix.field_validation_missing");
    assertNonEmptyArray(field.evidenceRequirements, `${packageId}.${field.fieldId}.evidenceRequirements`, "matrix.field_evidence_missing");
    requireValue(Boolean(field.truthOwner), "matrix.field_truth_owner_missing", `${packageId}.${field.fieldId} 缺少 truthOwner。`, { packageId, fieldId: field.fieldId });
  }
}

function checkHandoff(packageId, handoff) {
  assertNonEmptyArray(handoff.produces, `${packageId}.handoff.produces`, "matrix.handoff_missing");
  requireValue(Array.isArray(handoff.enablesNext), "matrix.handoff_dag_required", `${packageId}.handoff.enablesNext 必须是数组。`, { packageId });
  assertNonEmptyArray(handoff.carryForwardReadonly, `${packageId}.handoff.carryForwardReadonly`, "matrix.handoff_missing");
  requireValue(Boolean(handoff.nextAdmission), "matrix.handoff_missing", `${packageId}.handoff.nextAdmission 必须存在。`, { packageId });
}

function checkBoundarySections(packageId, scenarioPackage) {
  assertNonEmptyArray(scenarioPackage.roles?.allowed, `${packageId}.roles.allowed`, "matrix.roles_missing");
  assertNonEmptyArray(scenarioPackage.roles?.denied, `${packageId}.roles.denied`, "matrix.roles_missing");
  assertNonEmptyArray(scenarioPackage.factOwnership?.allowedFacts, `${packageId}.factOwnership.allowedFacts`, "matrix.fact_ownership_missing");
  assertNonEmptyArray(scenarioPackage.factOwnership?.forbiddenFacts, `${packageId}.factOwnership.forbiddenFacts`, "matrix.fact_ownership_missing");
  requireValue((scenarioPackage.factOwnership?.forbiddenFacts ?? []).includes("LedgerEntry"), "matrix.ledger_write_block_missing", `${packageId} 必须禁止场景包直接写 LedgerEntry。`, { packageId });
  requireValue(Boolean(scenarioPackage.admission?.policyRef), "matrix.policy_ref_missing", `${packageId} 缺少 admission.policyRef。`, { packageId });
  requireValue(scenarioPackage.admission?.productionConfirmAllowed === false, "matrix.production_block_missing", `${packageId} 必须禁止 production confirm。`, { packageId });
  requireValue(Boolean(scenarioPackage.evidence?.policyRef), "matrix.evidence_policy_missing", `${packageId} 缺少 evidence.policyRef。`, { packageId });
  requireValue(scenarioPackage.evidence?.missingEvidenceOutcome === "NO_GO", "matrix.evidence_no_go_missing", `${packageId} 缺证据必须 NO_GO。`, { packageId });
  requireValue(Boolean(scenarioPackage.ledger?.policyRef), "matrix.ledger_policy_missing", `${packageId} 缺少 ledger.policyRef。`, { packageId });
  requireValue(scenarioPackage.ledger?.ledgerEntryAllowed === false, "matrix.ledger_write_block_missing", `${packageId} 必须禁止场景包直接写 LedgerEntry。`, { packageId });
  requireValue(scenarioPackage.readSideOutputs?.SearchResult === "readonly" && scenarioPackage.readSideOutputs?.Dashboard === "readonly", "matrix.readside_readonly_missing", `${packageId} 读侧输出必须只读。`, { packageId });
  requireValue(scenarioPackage.uiUxBoundary?.readonlyCarryForward === true, "matrix.readonly_carry_forward_missing", `${packageId} UI 必须只读带入上一环上下文。`, { packageId });
  requireValue(scenarioPackage.uiUxBoundary?.confirmPathOnly === true && scenarioPackage.uiUxBoundary?.noInlineConfirm === true, "matrix.confirm_path_boundary_missing", `${packageId} UI 必须只允许 WorkItem confirm path。`, { packageId });
  requireValue(scenarioPackage.goNoGo?.untilAllSatisfied === "NO_GO", "matrix.no_go_missing", `${packageId} 必须声明未满足前 NO_GO。`, { packageId });
}

function checkHandoffDag() {
  const dag = matrix.handoffDag ?? {};
  requireValue(JSON.stringify(dag.nodes ?? []) === JSON.stringify(requiredPackages), "matrix.dag_nodes_invalid", "handoffDag.nodes 必须覆盖 11 个包且顺序一致。", { nodes: dag.nodes });
  const nodeSet = new Set(dag.nodes ?? []);
  const outgoing = new Map(requiredPackages.map((item) => [item, []]));
  for (const edge of dag.edges ?? []) {
    requireValue(nodeSet.has(edge.from), "matrix.dag_edge_from_unknown", `DAG edge from 未知: ${edge.from}`, edge);
    requireValue(nodeSet.has(edge.to), "matrix.dag_edge_to_unknown", `DAG edge to 未知: ${edge.to}`, edge);
    if (nodeSet.has(edge.from) && nodeSet.has(edge.to)) outgoing.get(edge.from)?.push(edge.to);
  }
  for (const scenarioPackage of matrix.scenarioPackages ?? []) {
    const expected = outgoing.get(scenarioPackage.packageId) ?? [];
    const actual = scenarioPackage.handoff?.enablesNext ?? [];
    requireValue(JSON.stringify(actual) === JSON.stringify(expected), "matrix.handoff_dag_mismatch", `${scenarioPackage.packageId}.handoff.enablesNext 必须匹配 handoffDag outgoing edges。`, {
      packageId: scenarioPackage.packageId,
      expected,
      actual
    });
  }
  requireValue(isAcyclic(outgoing), "matrix.handoff_dag_cycle", "handoffDag 必须是 DAG，不能形成环。");
}

function isAcyclic(outgoing) {
  const visiting = new Set();
  const visited = new Set();
  for (const node of requiredPackages) {
    if (!visit(node)) return false;
  }
  return true;

  function visit(node) {
    if (visiting.has(node)) return false;
    if (visited.has(node)) return true;
    visiting.add(node);
    for (const next of outgoing.get(node) ?? []) {
      if (!visit(next)) return false;
    }
    visiting.delete(node);
    visited.add(node);
    return true;
  }
}

function parseSimpleYaml(source) {
  const lines = source.replace(/\r/g, "").split("\n")
    .filter((line) => line.trim().length > 0 && !line.trim().startsWith("#"))
    .map((raw) => ({ indent: raw.match(/^ */)?.[0].length ?? 0, text: raw.trim() }));
  const [value] = parseNode(0, 0);
  return value;

  function parseNode(index, indent) {
    if (lines[index]?.indent === indent && lines[index]?.text.startsWith("- ")) {
      return parseArray(index, indent);
    }
    return parseObject(index, indent);
  }

  function parseObject(index, indent) {
    const obj = {};
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent < indent) break;
      if (line.indent > indent) break;
      if (line.text.startsWith("- ")) break;
      const parsed = parseKeyValue(line.text);
      if (!parsed) {
        index += 1;
        continue;
      }
      index += 1;
      if (parsed.hasValue) {
        obj[parsed.key] = parseScalar(parsed.value);
      } else if (index < lines.length && lines[index].indent > line.indent) {
        const [child, nextIndex] = parseNode(index, lines[index].indent);
        obj[parsed.key] = child;
        index = nextIndex;
      } else {
        obj[parsed.key] = null;
      }
    }
    return [obj, index];
  }

  function parseArray(index, indent) {
    const arr = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent !== indent || !line.text.startsWith("- ")) break;
      const rest = line.text.slice(2).trim();
      index += 1;
      if (rest.length === 0) {
        const [child, nextIndex] = parseNode(index, lines[index]?.indent ?? indent + 2);
        arr.push(child);
        index = nextIndex;
        continue;
      }
      const parsed = parseKeyValue(rest);
      if (parsed) {
        const item = {};
        item[parsed.key] = parsed.hasValue ? parseScalar(parsed.value) : null;
        if (!parsed.hasValue && index < lines.length && lines[index].indent > indent) {
          const [child, nextIndex] = parseNode(index, lines[index].indent);
          item[parsed.key] = child;
          index = nextIndex;
        }
        if (index < lines.length && lines[index].indent > indent) {
          const [child, nextIndex] = parseObject(index, lines[index].indent);
          Object.assign(item, child);
          index = nextIndex;
        }
        arr.push(item);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return [arr, index];
  }

  function parseKeyValue(value) {
    const index = value.indexOf(":");
    if (index < 0) return null;
    const key = value.slice(0, index).trim();
    const rest = value.slice(index + 1).trim();
    return { key, value: rest, hasValue: rest.length > 0 };
  }

  function parseScalar(value) {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value === "[]") return [];
    if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      return inner.length === 0 ? [] : inner.split(",").map((item) => parseScalar(item.trim()));
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value.replace(/^["']|["']$/g, "");
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assertNonEmptyArray(value, label, id) {
  requireValue(Array.isArray(value) && value.length > 0, id, `${label} 必须是非空数组。`, { label });
}

function requireValue(condition, id, message, extra = {}) {
  if (!condition) violations.push({ id, severity: "P0", message, ...extra });
}

function writeResult() {
  const full = path.join(root, resultPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify({
    version: "oam.dormitory-scenario-package-matrix-check.v2",
    checkedAtUtc: new Date().toISOString(),
    status: violations.length ? "failed" : "passed",
    parser: "structured-yaml-subset",
    packageCount: requiredPackages.length,
    requiredPackages,
    violations
  }, null, 2)}\n`, "utf8");
}
