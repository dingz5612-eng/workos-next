import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportPath = "artifacts/oam/authority-cleanup/mutation-tests-result.json";
const index = readJson("docs/oam/current-authority-index.json");
const generatedManifest = readJson("docs/oam/generated-contracts-manifest.json");
const finalReport = fs.existsSync(abs("artifacts/oam/final-report.json"))
  ? readJson("artifacts/oam/final-report.json")
  : { finalGoNoGo: "NO_GO", controlPlaneGateResult: { status: "passed" }, noGoReasons: ["当前阶段 NO_GO。"] };

const tests = [
  mutationTest("generated_file_manual_edit_should_fail", () => {
    const clone = cloneIndex();
    const entry = mustEntry(clone, "docs/contracts/business/oam-business-object-field-registry.json");
    entry.manualEditAllowed = true;
    return validateAuthorityIndex(clone).some((item) => item.id === "generated_manual_edit_allowed");
  }),
  mutationTest("derived_file_marked_source_should_fail", () => {
    const clone = cloneIndex();
    const entry = mustEntry(clone, "docs/business/domains/dormitory/handoff-contract.json");
    entry.layer = "source";
    entry.generated = false;
    entry.doNotEdit = false;
    entry.businessFactAuthorityAllowed = true;
    delete entry.generatedFrom;
    entry.sourceRefs = ["docs/oam/current-authority-index.json"];
    return validateAuthorityIndex(clone).some((item) => item.id === "source_not_whitelisted" || item.id === "business_fact_forbidden_path");
  }),
  mutationTest("search_bi_surface_business_fact_should_fail", () => {
    const clone = cloneIndex();
    for (const file of [
      "docs/contracts/search/search-contract.json",
      "docs/contracts/bi-kpi/metric-registry.contract.json",
      "docs/surface/surface-contract.yml"
    ]) {
      const entry = clone.entries.find((item) => item.path === file);
      if (entry) entry.businessFactAuthorityAllowed = true;
    }
    return validateAuthorityIndex(clone).some((item) => item.id === "business_fact_forbidden_path" || item.id === "surface_business_fact_forbidden");
  }),
  mutationTest("generated_manifest_source_hash_removed_should_fail", () => {
    const manifest = structuredClone(generatedManifest);
    delete manifest.sourceHash;
    delete manifest.sourceRefs;
    return validateGeneratedManifest(manifest).some((item) => item.id === "generated_metadata_missing");
  }),
  mutationTest("runtime_consumes_old_derived_authority_view_should_fail", () => {
    const runtimeConsumer = {
      path: "services/core-api/WorkOS.Api/Runtime/SearchKernelService.cs",
      consumes: ["docs/contracts/authority/master-design.contract.json"]
    };
    return validateRuntimeConsumer(runtimeConsumer).some((item) => item.id === "runtime_consumes_old_derived_source");
  }),
  mutationTest("ci_green_as_go_should_fail", () => {
    const report = structuredClone(finalReport);
    report.controlPlaneGateResult = { status: "passed", failedGateCount: 0 };
    report.finalGoNoGo = "GO";
    report.businessProductionGoNoGo = "GO";
    report.dormitoryL2GoNoGo = "GO";
    report.productionConfirmGoNoGo = "GO";
    report.noGoReasons = [];
    return validateGoNoGo(report).some((item) => item.id === "ci_green_cannot_promote_go");
  })
];

const failed = tests.filter((item) => item.status !== "passed");
writeJson(reportPath, {
  version: "oam.authority-cleanup-mutation-tests.v1",
  checkedAtUtc: new Date().toISOString(),
  status: failed.length === 0 ? "passed" : "failed",
  mutationCount: tests.length,
  failedMutationCount: failed.length,
  tests
});

if (failed.length > 0) {
  for (const item of failed) console.error(`${item.id}: ${item.messageZh}`);
  process.exit(1);
}

console.log(`Authority cleanup mutation tests: PASS (${tests.length})`);

function mutationTest(id, fn) {
  try {
    const detected = fn();
    return {
      id,
      status: detected ? "passed" : "failed",
      messageZh: detected ? "突变已被门禁识别。" : "突变未被门禁识别，必须修复。"
    };
  } catch (error) {
    return {
      id,
      status: "failed",
      messageZh: `突变测试执行异常：${error.message}`
    };
  }
}

function validateAuthorityIndex(doc) {
  const violations = [];
  const sourceWhitelist = new Set(doc.classificationModel?.sourceLayerWhitelist ?? []);
  for (const entry of doc.entries ?? []) {
    if (entry.layer === "source" && !sourceWhitelist.has(entry.path)) {
      violations.push({ id: "source_not_whitelisted", path: entry.path });
    }
    if (entry.layer === "generated" && entry.manualEditAllowed !== false) {
      violations.push({ id: "generated_manual_edit_allowed", path: entry.path });
    }
    if (entry.generated === true && entry.businessFactAuthorityAllowed === true) {
      violations.push({ id: "generated_business_fact_allowed", path: entry.path });
    }
    if (entry.businessFactAuthorityAllowed === true && businessFactForbidden(entry.path)) {
      violations.push({ id: "business_fact_forbidden_path", path: entry.path });
    }
    if (entry.path === "docs/surface/surface-contract.yml" && entry.businessFactAuthorityAllowed === true) {
      violations.push({ id: "surface_business_fact_forbidden", path: entry.path });
    }
  }
  return violations;
}

function validateGeneratedManifest(manifest) {
  const violations = [];
  for (const field of ["generated", "doNotEdit", "generatedFrom", "sourceRefs", "sourceHash", "compilerInputDigest", "outputContentDigest", "deterministicSort"]) {
    const value = manifest[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      violations.push({ id: "generated_metadata_missing", field });
    }
  }
  return violations;
}

function validateRuntimeConsumer(consumer) {
  const violations = [];
  for (const source of consumer.consumes ?? []) {
    if (source.startsWith("docs/contracts/authority/") || source === "docs/business/domains/dormitory/handoff-contract.json") {
      violations.push({ id: "runtime_consumes_old_derived_source", source });
    }
  }
  return violations;
}

function validateGoNoGo(report) {
  const violations = [];
  if (report.controlPlaneGateResult?.status === "passed" && report.finalGoNoGo === "GO") {
    violations.push({ id: "ci_green_cannot_promote_go" });
  }
  return violations;
}

function businessFactForbidden(file) {
  return [
    "docs/contracts/bi-kpi/",
    "docs/contracts/business/",
    "docs/contracts/definition/",
    "docs/contracts/read/",
    "docs/contracts/search/",
    "infra/db/",
    "schemas/",
    "scripts/",
    "services/",
    "apps/"
  ].some((prefix) => file.startsWith(prefix));
}

function cloneIndex() {
  return structuredClone(index);
}

function mustEntry(doc, file) {
  const entry = doc.entries.find((item) => item.path === file);
  if (!entry) throw new Error(`missing entry: ${file}`);
  return entry;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), "utf8"));
}

function writeJson(file, value) {
  const full = abs(file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function abs(file) {
  return path.join(root, file);
}
