import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = "docs/contracts/business/oam-business-object-field-registry.json";
const reportPath = "artifacts/oam/checks/business-object-field-registry-result.json";
const allowedModules = new Set(["accommodation", "finance-gate", "identity", "maintenance"]);
const allowedFieldOwners = new Set(["accommodation", "finance-gate", "identity", "maintenance"]);
const violations = [];

const registry = readJson(registryPath);
const oam = readJson("docs/contracts/oam.current.json");
const labels = readJson("docs/contracts/language/field-label-catalog.json");
const definitions = readJson("docs/contracts/definition/workitem-definition-registry.json");

if (registry.version !== "oam.business-object-field-registry.v1" || registry.status !== "authoritative") {
  fail("registry_identity_invalid", "业务对象字段总表必须声明 oam.business-object-field-registry.v1 authoritative。");
}

const languageKeys = new Set((labels.fields ?? []).map((field) => field.fieldId));
const capabilities = new Set((oam.productCapabilities ?? []).map((item) => item.id));
const objectIds = new Set();

for (const object of registry.objects ?? []) {
  for (const field of ["objectId", "module", "ownerCapability", "truthOwnerRef", "fields"]) {
    if (!(field in object) || object[field] === "") {
      fail("object_field_missing", `${object.objectId ?? "<missing>"} 缺少 ${field}。`);
    }
  }
  if (objectIds.has(object.objectId)) {
    fail("object_duplicate", `业务对象重复：${object.objectId}`);
  }
  objectIds.add(object.objectId);
  if (!allowedModules.has(object.module)) {
    fail("object_module_unknown", `${object.objectId} 使用未知模块 ${object.module}。`);
  }
  if (!capabilities.has(object.ownerCapability)) {
    fail("object_capability_unknown", `${object.objectId} 使用未知能力 ${object.ownerCapability}。`);
  }
  if (!Array.isArray(object.fields) || object.fields.length === 0) {
    fail("object_fields_empty", `${object.objectId} 必须至少声明一个字段。`);
  }
  for (const field of object.fields ?? []) {
    for (const key of ["fieldId", "owner", "visibleScope", "editableWhen", "auditRequired", "languageKey", "source", "searchable", "ledgerRelevant"]) {
      if (!(key in field) || field[key] === "") {
        fail("business_field_incomplete", `${object.objectId}.${field.fieldId ?? "<missing>"} 缺少 ${key}。`);
      }
    }
    if (!allowedFieldOwners.has(field.owner)) {
      fail("business_field_owner_unknown", `${object.objectId}.${field.fieldId} 使用未知 owner ${field.owner}。`);
    }
    if (!languageKeys.has(field.languageKey)) {
      fail("business_field_language_missing", `${object.objectId}.${field.fieldId} 的 languageKey 不在语言目录：${field.languageKey}`);
    }
    if (!Array.isArray(field.visibleScope) || field.visibleScope.length === 0) {
      fail("business_field_visible_scope_missing", `${object.objectId}.${field.fieldId} 缺少可见范围。`);
    }
    if (field.ledgerRelevant === true && field.owner !== "finance-gate" && !String(field.source).includes("Money/Ledger Kernel")) {
      fail("ledger_field_owner_invalid", `${object.objectId}.${field.fieldId} 是账务相关字段，必须由 finance-gate 或 Money/Ledger Kernel 定真。`);
    }
  }
}

const factsFromDefinitions = new Set();
for (const definition of definitions.definitions ?? []) {
  for (const fact of definition.allowedFacts ?? []) factsFromDefinitions.add(fact);
  for (const fact of definition.forbiddenFacts ?? []) factsFromDefinitions.add(fact);
}
for (const fact of factsFromDefinitions) {
  if (!objectIds.has(fact)) {
    fail("definition_fact_not_registered", `Definition Registry 引用的事实未登记为业务对象：${fact}`);
  }
}

writeReport();

if (violations.length) {
  for (const item of violations) console.error(`${item.id}: ${item.message}`);
  process.exit(1);
}

console.log("Business object field registry check: PASS");

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
    violations
  }, null, 2));
}

function fail(id, message) {
  violations.push({ id, severity: "P0", message });
}

function abs(file) {
  return path.join(root, file);
}
